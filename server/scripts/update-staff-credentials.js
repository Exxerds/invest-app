// ============================================================
//  One-off production migration for the staff login credentials.
//
//  The new values are read from server/.env:
//    STAFF_ADMIN_EMAIL / STAFF_ADMIN_PASSWORD
//    STAFF_MANAGER_EMAIL / STAFF_MANAGER_PASSWORD
//
//  It creates or updates the new accounts, transfers references
//  that use the old bootstrap IDs, and permanently removes the
//  old admin@trade.io / manager@trade.io user rows.
//
//  Run ON THE VPS after pulling this version:
//    cd /opt/oakhaven/server
//    sudo -u oakhaven node scripts/update-staff-credentials.js
//
//  Passwords are hashed before storage and are never printed.
// ============================================================
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import * as store from '../src/db.js';
import { LEGACY_STAFF } from '../src/seed.js';

const STAFF = [
  {
    role: 'ADMIN',
    name: 'Admin',
    emailKey: 'STAFF_ADMIN_EMAIL',
    passwordKey: 'STAFF_ADMIN_PASSWORD',
    legacyEmail: LEGACY_STAFF.find(u => u.role === 'ADMIN').email,
  },
  {
    role: 'MANAGER',
    name: 'Manager',
    emailKey: 'STAFF_MANAGER_EMAIL',
    passwordKey: 'STAFF_MANAGER_PASSWORD',
    legacyEmail: LEGACY_STAFF.find(u => u.role === 'MANAGER').email,
  },
];

function readCredentials() {
  const users = STAFF.map(spec => ({
    ...spec,
    email: String(process.env[spec.emailKey] || '').trim().toLowerCase(),
    password: String(process.env[spec.passwordKey] || ''),
  }));

  if (users.some(u => !u.email || !u.password)) {
    throw new Error(
      'Set STAFF_ADMIN_EMAIL, STAFF_ADMIN_PASSWORD, STAFF_MANAGER_EMAIL and STAFF_MANAGER_PASSWORD in server/.env before running the migration.',
    );
  }
  if (users.some(u => u.password.length < 6)) {
    throw new Error('Staff passwords must be at least 6 characters long.');
  }
  if (new Set(users.map(u => u.email)).size !== users.length) {
    throw new Error('The new staff e-mail addresses must be different.');
  }
  if (users.some(u => !/^\S+@\S+\.\S+$/.test(u.email))) {
    throw new Error('The new staff e-mail addresses are invalid.');
  }

  return users;
}

async function transferReferences(oldUser, newUser) {
  const oldId = Number(oldUser.id);
  const newId = Number(newUser.id);

  // Keep existing client assignments with the new moderator account.
  for (const user of await store.all('users')) {
    if (user.id !== oldId && Number(user.assignedManagerId) === oldId) {
      await store.update('users', user.id, {
        assignedManagerId: newId,
        assignedManagerName: newUser.name,
      });
    }
  }

  // Keep call history and calendar entries linked to the new staff account.
  for (const call of await store.all('calls')) {
    if (Number(call.managerId) === oldId) {
      await store.update('calls', call.id, {
        managerId: newId,
        managerName: newUser.name,
      });
    }
  }
  for (const appointment of await store.all('appointments')) {
    if (Number(appointment.createdById) === oldId) {
      await store.update('appointments', appointment.id, {
        createdById: newId,
        createdByName: newUser.name,
      });
    }
  }

  // Preserve the audit trail while making it point at the replacement account.
  for (const activity of await store.all('activity')) {
    if (Number(activity.actorId) === oldId) {
      await store.update('activity', activity.id, {
        actorId: newId,
        actorName: newUser.name,
        actorRole: newUser.role,
      });
    }
  }

  // Tokens and staff notifications belong to the old account and should not
  // survive its deletion. Client conversations and other customer records are
  // deliberately left untouched.
  await store.removeWhere('tokens', token => Number(token.user_id) === oldId);
  await store.removeWhere('notifications', notification => Number(notification.userId) === oldId);
}

async function migrate() {
  const users = readCredentials();
  const records = await Promise.all(users.map(async (u) => ({
    spec: u,
    targets: await store.manyByField('users', 'email', u.email),
    legacyUsers: u.email === u.legacyEmail
      ? []
      : await store.manyByField('users', 'email', u.legacyEmail),
  })));

  // Preflight all records before changing either account.
  for (const { spec, targets, legacyUsers } of records) {
    if (targets.some(user => user.role !== spec.role)) {
      throw new Error(`The target e-mail for ${spec.role} already belongs to another role; nothing was changed.`);
    }
    if (legacyUsers.some(user => user.role !== spec.role)) {
      throw new Error(`The legacy ${spec.role} e-mail belongs to another role; nothing was changed.`);
    }
  }

  for (const { spec, targets, legacyUsers } of records) {
    const target = targets[0];
    const hash = await bcrypt.hash(spec.password, 10);
    let replacement;

    if (target) {
      replacement = await store.update('users', target.id, {
        email: spec.email,
        password: hash,
        role: spec.role,
        status: 'active',
      });
      console.log(`[credentials] Updated ${spec.role} account: ${spec.email}`);
    } else {
      replacement = await store.insert('users', {
        name: spec.name,
        email: spec.email,
        password: hash,
        role: spec.role,
        status: 'active',
        balance: 0,
        created_at: new Date().toISOString(),
      });
      console.log(`[credentials] Created ${spec.role} account: ${spec.email}`);
    }

    for (const legacy of legacyUsers) {
      if (legacy.id === replacement.id) continue;
      await transferReferences(legacy, replacement);
      await store.removeWhere('users', user => user.id === legacy.id);
      console.log(`[credentials] Deleted legacy ${spec.role} account.`);
    }
  }

  console.log('[credentials] Staff credential migration completed.');
}

try {
  await migrate();
} catch (err) {
  console.error(`[credentials] Migration failed: ${err.message}`);
  process.exitCode = 1;
}
