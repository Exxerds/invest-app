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

async function readWallets() {
  const rec = await store.byField('settings', 'key', 'depositWallets');
  const saved = rec?.value || {};
  // Always return every supported network so the UI can render the full list
  return CRYPTO_TYPES.reduce((acc, t) => ({ ...acc, [t]: saved[t] || '' }), {});
}

router.get('/deposit-wallets', auth, async (req, res) => {
  res.json({ wallets: await readWallets(), types: CRYPTO_TYPES });
});

router.put('/deposit-wallets', auth, adminOnly, async (req, res) => {
  const incoming = req.body?.wallets || {};
  const value = CRYPTO_TYPES.reduce(
    (acc, t) => ({ ...acc, [t]: String(incoming[t] ?? '').trim().slice(0, 200) }),
    {},
  );

  const rec = await store.byField('settings', 'key', 'depositWallets');
  if (rec) {
    await store.update('settings', rec.id, { value, updatedBy: req.user.name, updatedAt: new Date().toISOString() });
  } else {
    await store.insert('settings', {
      key: 'depositWallets',
      value,
      updatedBy: req.user.name,
      updatedAt: new Date().toISOString(),
    });
  }

  res.json({ ok: true, wallets: value });
});

export default router;
