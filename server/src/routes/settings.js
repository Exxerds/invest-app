// ============================================================
//  Platform settings — a single persisted key/value record.
//
//  Today it holds the deposit wallet addresses. Clients need to
//  READ them (to know where to send funds), but only an ADMIN may
//  change them, so the two routes have different guards.
//
//    GET   /api/settings/deposit-wallets   any signed-in user
//    PUT   /api/settings/deposit-wallets   admin only
// ============================================================
import express from 'express';
import jwt from 'jsonwebtoken';
import * as store from '../db.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

/** Crypto networks the client can pick when depositing. */
export const CRYPTO_TYPES = ['BTC', 'ETH', 'USDC'];

async function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authorized' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await store.byId('users', payload.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired, sign in again' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Administrator access only' });
  next();
}

const empty = () => CRYPTO_TYPES.reduce((acc, t) => ({ ...acc, [t]: '' }), {});
const normalise = (raw = {}) =>
  CRYPTO_TYPES.reduce((acc, t) => ({ ...acc, [t]: String(raw[t] ?? '').trim().slice(0, 200) }), {});

/** Fallback addresses used when a client has no personal ones. */
async function readDefaults() {
  const rec = await store.byField('settings', 'key', 'depositWallets');
  return { ...empty(), ...normalise(rec?.value) };
}

/** Per-client addresses, keyed by user id. */
async function readForUser(userId) {
  const rec = await store.byField('settings', 'key', `depositWallets:${userId}`);
  return { ...empty(), ...normalise(rec?.value) };
}

async function writeSetting(key, value, adminName) {
  const rec = await store.byField('settings', 'key', key);
  const payload = { value, updatedBy: adminName, updatedAt: new Date().toISOString() };
  if (rec) await store.update('settings', rec.id, payload);
  else await store.insert('settings', { key, ...payload });
}

/**
 * What the signed-in client should pay into.
 * Personal address wins; otherwise the shared default is used, so a new
 * client is never left without payment details.
 */
router.get('/deposit-wallets', auth, async (req, res) => {
  const defaults = await readDefaults();
  const personal = await readForUser(req.user.id);
  const wallets = CRYPTO_TYPES.reduce(
    (acc, t) => ({ ...acc, [t]: personal[t] || defaults[t] || '' }),
    {},
  );
  res.json({ wallets, types: CRYPTO_TYPES });
});

/** Admin: shared fallback addresses. */
router.put('/deposit-wallets', auth, adminOnly, async (req, res) => {
  const value = normalise(req.body?.wallets);
  await writeSetting('depositWallets', value, req.user.name);
  res.json({ ok: true, wallets: value });
});

/** Admin: read one client's own addresses (empty string = falls back). */
router.get('/deposit-wallets/:userId', auth, adminOnly, async (req, res) => {
  const userId = Number(req.params.userId);
  const user = await store.byId('users', userId);
  if (!user) return res.status(404).json({ error: 'Client not found' });
  res.json({
    wallets: await readForUser(userId),
    defaults: await readDefaults(),
    types: CRYPTO_TYPES,
  });
});

/** Admin: set one client's own addresses. */
router.put('/deposit-wallets/:userId', auth, adminOnly, async (req, res) => {
  const userId = Number(req.params.userId);
  const user = await store.byId('users', userId);
  if (!user) return res.status(404).json({ error: 'Client not found' });

  const value = normalise(req.body?.wallets);
  await writeSetting(`depositWallets:${userId}`, value, req.user.name);
  res.json({ ok: true, wallets: value });
});

export default router;
