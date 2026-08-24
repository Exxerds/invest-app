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

/** Remind staff 1 day, 3 hours and 10 minutes before a calendar slot. */
export async function fireDueAppointments() {
  const now = Date.now();
  const stages = [
    { key: '1d', ms: 24 * 3600000, label: 'in 1 day' },
    { key: '3h', ms: 3 * 3600000, label: 'in 3 hours' },
    { key: '10m', ms: 10 * 60000, label: 'in 10 minutes' },
  ];
  const items = await store.all('appointments');
  for (const a of items) {
    const t = new Date(a.startsAt).getTime();
    if (!Number.isFinite(t)) continue;
    if (t < now - 2 * 60000) continue;
    const done = { ...(a.notifiedStages || {}) };
    if (a.notifiedAt && !done['10m']) done['10m'] = true;
    const when = new Date(a.startsAt).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    let changed = false;
    for (const s of stages) {
      if (done[s.key]) continue;
      if (t - now > s.ms) continue;
      await notify({
        audience: 'staff',
        kind: 'calendar',
        title: `Calendar reminder — ${s.label}`,
        message: `${a.clientName} — ${a.title || 'appointment'} at ${when}${a.notes ? `. ${a.notes}` : ''}`,
        link: 'calendar',
      });
      done[s.key] = true;
      changed = true;
    }
    if (changed) await store.update('appointments', a.id, { notifiedStages: done });
  }
}

/** Notifications a given user is allowed to see, newest first */
export async function listFor(user) {
  const isStaff = user.role === 'ADMIN' || user.role === 'MANAGER';
  const rows = await store.allWhere('notifications', (n) =>
    isStaff ? n.audience === 'staff' : n.audience === 'client' && n.userId === user.id,
  );
  return rows.sort((a, b) => b.id - a.id);
}
