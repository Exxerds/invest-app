// ============================================================
//  Manager client ownership.
//
//  An ADMIN sees everything. A MANAGER sees and may act on
//  clients assigned to them (by assignedManagerId, falling back
//  to an exact assignedManagerName match for legacy rows).
//
//  Every staff endpoint that can expose client data (lists,
//  lookups, mutations) runs its rows through these helpers.
// ============================================================
import * as store from './db.js';

const emailOf = (v) => String(v ?? '').trim().toLowerCase();

/**
 * null  → no restriction (admin)
 * Set   → the numeric ids of the clients assigned to this manager
 */
export async function ownClientIds(user) {
  if (!user || user.role !== 'MANAGER') return null;
  const all = await store.all('users');
  const mine = String(user.name || '').trim().toLowerCase();
  const ids = new Set();
  for (const u of all) {
    if (u.role !== 'CLIENT') continue;
    if (Number(u.assignedManagerId) === Number(user.id)) {
      ids.add(u.id);
      continue;
    }
    if (mine && String(u.assignedManagerName || '').trim().toLowerCase() === mine) ids.add(u.id);
  }
  return ids;
}

/** true when the row (admin: always) references one of the manager's clients */
export function isOwnId(own, id) {
  if (own === null) return true;
  const n = Number(String(id ?? '').replace(/^acc-/, '').replace(/\D/g, ''));
  return Number.isFinite(n) && n > 0 && own.has(n);
}

/** true when a client email belongs to one of the manager's clients (admin: always) */
export function isOwnEmail(own, users, email) {
  if (own === null) return true;
  const e = emailOf(email);
  if (!e) return false;
  return users.some(
    u => u.role === 'CLIENT' && own.has(u.id) && emailOf(u.email) === e,
  );
}

/**
 * 403 guard for point mutations: returns true when the request may
 * proceed, otherwise has already answered with 403.
 */
export function denyIfNotOwn(req, res, own, id, message = 'This client is not assigned to you.') {
  if (isOwnId(own, id)) return true;
  res.status(403).json({ error: message });
  return false;
}
