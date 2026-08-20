// ============================================================
//  Notifications.
//
//  Two audiences:
//    "staff"  — visible to every admin / manager (back office bell)
//    "client" — visible only to the user in `userId`
//
//  Stored in data.json so they survive a restart. The newest 200
//  are kept; older ones are trimmed to stop the file growing.
// ============================================================
import * as store from './db.js';
import { pushToUser } from './routes/push.js';

const KEEP = 200;

/**
 * Create a notification.
 * @param {object} n
 * @param {'staff'|'client'} n.audience  who should see it
 * @param {number} [n.userId]  the client it concerns (required for audience \"client\")
 * @param {string} n.kind      machine-readable event type
 * @param {string} n.title     short headline
 * @param {string} n.message   human-readable text
 * @param {string} [n.link]    screen to open when clicked
 */
export async function notify({ audience, userId, kind, title, message, link }) {
  const record = await store.insert('notifications', {
    audience,
    userId: userId ?? null,
    kind,
    title,
    message,
    link: link || null,
    read: false,
    createdAt: new Date().toISOString(),
  });

  // Mirror client-facing alerts to the browser, if push is switched on
  if (audience === 'client' && userId) {
    pushToUser(userId, { title, body: message }).catch(() => undefined);
  }

  // keep the collection bounded
  const all = await store.all('notifications');
  if (all.length > KEEP) {
    const cutoff = all[all.length - KEEP].id;
    await store.removeWhere('notifications', (r) => r.id < cutoff);
  }

  return record;
}

/** Notifications a given user is allowed to see, newest first */
export async function listFor(user) {
  const isStaff = user.role === 'ADMIN' || user.role === 'MANAGER';
  if (isStaff) {
    // one indexed query instead of full table scan
    const rows = await store.manyByField('notifications', 'audience', 'staff');
    return rows.sort((a, b) => b.id - a.id);
  } else {
    const rows = await store.manyByField('notifications', 'userId', user.id);
    // manyByField returns only those where userId === id, then filter audience
    const filtered = rows.filter(n => n.audience === 'client');
    return filtered.sort((a, b) => b.id - a.id);
  }
}
