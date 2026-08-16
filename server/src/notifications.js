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

const KEEP = 200;

/**
 * Create a notification.
 * @param {object} n
 * @param {'staff'|'client'} n.audience  who should see it
 * @param {number} [n.userId]  the client it concerns (required for audience "client")
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
  const rows = await store.allWhere('notifications', (n) =>
    isStaff ? n.audience === 'staff' : n.audience === 'client' && n.userId === user.id,
  );
  return rows.sort((a, b) => b.id - a.id);
}
