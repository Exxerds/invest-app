// ============================================================
//  One-off cleanup: remove the OLD demo client account
//  (client@trade.io, "Michael Carter" with the $26,500 play
//  balance) and every row that belongs to it.
//
//  Run ON THE SERVER (from the server/ directory):
//    cd /opt/oakhaven/server
//    sudo -u oakhaven node scripts/remove-demo-client.js
//
//  Safe to run repeatedly — with no demo client it exits quietly.
// ============================================================
import 'dotenv/config';
import * as store from '../src/db.js';

const EMAIL = 'client@trade.io';

const user = await store.findBy('users', 'email', EMAIL);
if (!user) {
  console.log('[cleanup] Demo client not found — nothing to remove.');
  process.exit(0);
}

const id = user.id;
console.log(`[cleanup] Removing demo client ${EMAIL} (id ${id})…`);

await store.removeWhere('trades', (t) => Number(t.userId) === id);
await store.removeWhere('transactions', (t) => Number(t.userId) === id);
await store.removeWhere('investments', (i) => Number(i.userId) === id);
await store.removeWhere('kyc', (k) => Number(k.userId) === id);
await store.removeWhere('notifications', (n) => Number(n.userId) === id);
await store.removeWhere('messages', (m) => Number(m.clientId) === id);
await store.removeWhere('notes', (n) => n.clientId === String(id));
await store.removeWhere('calls', (c) => Number(c.clientId) === id);
await store.removeWhere('activity', (a) => Number(a.actorId) === id);
await store.removeWhere('leads', (l) => String(l.email || '').toLowerCase() === EMAIL);
await store.removeWhere('tokens', (t) => Number(t.user_id) === id);
await store.removeWhere('users', (u) => u.id === id);

console.log('[cleanup] Done. Demo client and all related rows removed.');
process.exit(0);
