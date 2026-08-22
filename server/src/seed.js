// ============================================================
//  Creates the demo users automatically on server startup.
//  Idempotent: existing users are left untouched.
// ============================================================
import bcrypt from 'bcryptjs';
import * as store from './db.js';

const SEED_USERS = [
  { name: 'Admin', email: 'admin@trade.io', password: 'admin123', role: 'ADMIN', status: 'active', balance: 0 },
  { name: 'Laura Bennett', email: 'manager@trade.io', password: 'manager123', role: 'MANAGER', status: 'active', balance: 0 },
  { name: 'Michael Carter', email: 'client@trade.io', password: 'client123', role: 'CLIENT', status: 'active', balance: 26500 }
];

export async function seedUsers() {
  for (const u of SEED_USERS) {
    const exists = await store.findBy('users', 'email', u.email);
    if (!exists) {
      const hash = await bcrypt.hash(u.password, 10);
      await store.insert('users', {
        name: u.name,
        email: u.email,
        password: hash,
        role: u.role,
        status: u.status,
        balance: u.balance || 0,
        created_at: new Date().toISOString()
      });
      console.log(`[seed] Created demo user: ${u.email} (${u.role})`);
    } else if (u.role === 'CLIENT' && (!exists.balance || Number(exists.balance) <= 0)) {
      await store.update('users', exists.id, { balance: u.balance });
    }
  }
  console.log('[seed] Demo users ready:');
  console.log('[seed]   ADMIN   → admin@trade.io / admin123');
  console.log('[seed]   MANAGER → manager@trade.io / manager123');
  console.log('[seed]   CLIENT  → client@trade.io / client123');
}
