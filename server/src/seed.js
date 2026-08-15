// ============================================================
//  Автоматическое создание демо-пользователей при старте сервера.
//  Работает идемпотентно: если пользователь уже есть — не трогает.
// ============================================================
import bcrypt from 'bcryptjs';
import * as store from './store.js';

const SEED_USERS = [
  { name: 'Admin Boss', email: 'admin@trade.io', password: 'admin123', role: 'ADMIN', status: 'active' },
  { name: 'Elena Smirnova', email: 'manager@trade.io', password: 'manager123', role: 'MANAGER', status: 'active' },
  { name: 'Alexander Gromov', email: 'client@trade.io', password: 'client123', role: 'CLIENT', status: 'active' }
];

export async function seedUsers() {
  for (const u of SEED_USERS) {
    const exists = store.findBy('users', 'email', u.email);
    if (!exists) {
      const hash = await bcrypt.hash(u.password, 10);
      store.insert('users', {
        name: u.name,
        email: u.email,
        password: hash,
        role: u.role,
        status: u.status,
        created_at: new Date().toISOString()
      });
      console.log(`[seed] Created demo user: ${u.email} (${u.role})`);
    }
  }
  console.log('[seed] Demo users ready:');
  console.log('[seed]   ADMIN   → admin@trade.io / admin123');
  console.log('[seed]   MANAGER → manager@trade.io / manager123');
  console.log('[seed]   CLIENT  → client@trade.io / client123');
}
