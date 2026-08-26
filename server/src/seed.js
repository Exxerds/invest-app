// ============================================================
//  Creates the staff bootstrap accounts automatically on startup.
//  Idempotent: existing users are left untouched.
//
//  Production credentials are read from server/.env and are never
//  stored in the repository. Local development keeps the legacy
//  demo values as a convenience only.
// ============================================================
import bcrypt from 'bcryptjs';
import * as store from './db.js';

const LEGACY_STAFF = [
  { role: 'ADMIN', name: 'Admin', email: 'admin@trade.io', password: 'admin123' },
  { role: 'MANAGER', name: 'Laura Bennett', email: 'manager@trade.io', password: 'manager123' },
];

function configuredStaff() {
  const fields = [
    ['STAFF_ADMIN_EMAIL', 'STAFF_ADMIN_PASSWORD'],
    ['STAFF_MANAGER_EMAIL', 'STAFF_MANAGER_PASSWORD'],
  ];
  const configured = fields.flatMap(([emailKey, passwordKey]) => [
    process.env[emailKey],
    process.env[passwordKey],
  ]).some(value => value !== undefined && value !== '');

  if (!configured) {
    if (process.env.NODE_ENV === 'production' && process.env.SEED_DEMO !== 'off') {
      throw new Error(
        'Production staff bootstrap is not configured. Set STAFF_ADMIN_EMAIL, STAFF_ADMIN_PASSWORD, STAFF_MANAGER_EMAIL and STAFF_MANAGER_PASSWORD, or set SEED_DEMO=off.',
      );
    }
    return LEGACY_STAFF;
  }

  const adminEmail = String(process.env.STAFF_ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = String(process.env.STAFF_ADMIN_PASSWORD || '');
  const managerEmail = String(process.env.STAFF_MANAGER_EMAIL || '').trim().toLowerCase();
  const managerPassword = String(process.env.STAFF_MANAGER_PASSWORD || '');

  if (!adminEmail || !adminPassword || !managerEmail || !managerPassword) {
    throw new Error(
      'Staff bootstrap is incomplete. Set all four STAFF_* email/password variables together.',
    );
  }
  if (adminPassword.length < 6 || managerPassword.length < 6) {
    throw new Error('Staff bootstrap passwords must be at least 6 characters long.');
  }
  if (adminEmail === managerEmail) {
    throw new Error('STAFF_ADMIN_EMAIL and STAFF_MANAGER_EMAIL must be different.');
  }

  return [
    { role: 'ADMIN', name: 'Admin', email: adminEmail, password: adminPassword },
    { role: 'MANAGER', name: 'Manager', email: managerEmail, password: managerPassword },
  ];
}

export async function seedUsers() {
  const users = configuredStaff();

  for (const u of users) {
    const exists = await store.findBy('users', 'email', u.email);
    if (!exists) {
      const hash = await bcrypt.hash(u.password, 10);
      await store.insert('users', {
        name: u.name,
        email: u.email,
        password: hash,
        role: u.role,
        status: 'active',
        balance: 0,
        created_at: new Date().toISOString(),
      });
      console.log(`[seed] Created staff bootstrap account: ${u.email} (${u.role})`);
    }
  }
  console.log(`[seed] Staff bootstrap accounts ready (${users.map(u => u.email).join(', ')})`);
}

export { LEGACY_STAFF };
