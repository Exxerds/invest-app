// ============================================================
//  One-off production migration for the staff login credentials.
//
//  The new values are read from server/.env:
//    STAFF_ADMIN_EMAIL / STAFF_ADMIN_PASSWORD
//    STAFF_MANAGER_EMAIL / STAFF_MANAGER_PASSWORD
//
//  It keeps the existing user IDs and related records. If a new
//  account already exists, the old bootstrap account is blocked;
//  otherwise the old bootstrap account is renamed in place.
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

async function migrate() {
  const users = readCredentials();
  const records = await Promise.all(users.map(async (u) => ({
    spec: u,
    target: await store.findBy('users', 'email', u.email),
    legacy: u.email === u.legacyEmail
      ? null
      : await store.findBy('users', 'email', u.legacyEmail),
  })));

  // Preflight all records before changing either account.
  for (const { spec, target, legacy } of records) {
    if (target && target.role !== spec.role) {
      throw new Error(`The target e-mail for ${spec.role} already belongs to another role; nothing was changed.`);
    }
    if (legacy && legacy.role !== spec.role) {
      throw new Error(`The legacy ${spec.role} e-mail belongs to another role; nothing was changed.`);
    }
  }

  for (const { spec, target, legacy } of records) {
    const hash = await bcrypt.hash(spec.password, 10);

    if (target) {
      await store.update('users', target.id, {
        email: spec.email,
        password: hash,
        role: spec.role,
        status: 'active',
      });
      console.log(`[credentials] Updated ${spec.role} account: ${spec.email}`);

      if (legacy && legacy.id !== target.id) {
        await store.update('users', legacy.id, { status: 'blocked' });
        console.log(`[credentials] Blocked legacy ${spec.role} account.`);
      }
      continue;
    }

    if (legacy) {
      await store.update('users', legacy.id, {
        email: spec.email,
        password: hash,
        role: spec.role,
        status: 'active',
      });
      console.log(`[credentials] Renamed ${spec.role} account in place: ${spec.email}`);
      continue;
    }

    await store.insert('users', {
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

  console.log('[credentials] Staff credential migration completed.');
}

try {
  await migrate();
} catch (err) {
  console.error(`[credentials] Migration failed: ${err.message}`);
  process.exitCode = 1;
}
