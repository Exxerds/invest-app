// ============================================================
//  Trades — stored on the server so they survive a reload and
//  are editable from the CRM.
//
//    GET    /api/trades/mine        client: own positions
//    POST   /api/trades             client or staff: open a position
//    GET    /api/trades/all         staff: every position
//    PATCH  /api/trades/:id         staff: edit ANY field
//    POST   /api/trades/:id/close   staff or owner: close it
// ============================================================
import express from 'express';
import jwt from 'jsonwebtoken';
import * as store from '../db.js';
import { notify } from '../notifications.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

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

const isStaff = (u) => u.role === 'ADMIN' || u.role === 'MANAGER';

function staffOnly(req, res, next) {
  if (!isStaff(req.user)) return res.status(403).json({ error: 'Staff access only' });
  next();
}

const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/* ---------------- read ---------------- */

router.get('/mine', auth, async (req, res) => {
  const trades = await store.manyByField('trades', 'userId', req.user.id);
  res.json({ trades });
});

router.get('/all', auth, staffOnly, async (req, res) => {
  res.json({ trades: await store.all('trades') });
});

/* ---------------- open ---------------- */

router.post('/', auth, async (req, res) => {
  const b = req.body || {};

  // Staff may open a position on behalf of a client
  let owner = req.user;
  if (b.userId && isStaff(req.user)) {
    const target = await store.byId('users', Number(b.userId));
    if (!target) return res.status(404).json({ error: 'Client not found' });
    owner = target;
  }

  if (!b.symbol) return res.status(400).json({ error: 'Instrument is required' });
  const amount = num(b.amount);
  if (amount <= 0) return res.status(400).json({ error: 'Amount must be greater than zero' });

  const trade = await store.insert('trades', {
    userId: owner.id,
    userName: owner.name,
    userEmail: owner.email,
    symbol: String(b.symbol).slice(0, 40),
    tv: String(b.tv || b.symbol).slice(0, 60),
    name: String(b.name || '').slice(0, 120),
    side: ['LONG', 'SHORT', 'SPOT'].includes(b.side) ? b.side : 'LONG',
    amount,
    entryPrice: num(b.entryPrice),
    currentPrice: num(b.currentPrice, num(b.entryPrice)),
    leverage: Math.max(1, num(b.leverage, 1)),
    stopLoss: b.stopLoss ? num(b.stopLoss) : null,
    takeProfit: b.takeProfit ? num(b.takeProfit) : null,
    pnl: num(b.pnl),
    margin: num(b.margin, Math.max(1, num(b.leverage, 1)) > 0 ? amount / Math.max(1, num(b.leverage, 1)) : amount),
    liquidationPrice: num(b.liquidationPrice),
    status: 'OPEN',
    openedAt: b.openedAt || new Date().toISOString(),
    createdBy: req.user.name,
  });

  // Let the desk know a client opened something themselves
  if (!isStaff(req.user)) {
    await notify({
      audience: 'staff',
      userId: owner.id,
      kind: 'trade_opened',
      title: 'New position opened',
      message: `${owner.name} opened ${trade.side} ${trade.symbol} for $${amount.toLocaleString('en-US')}.`,
      link: 'trading',
    });
  }

  res.json({ ok: true, trade });
});

/* ---------------- edit (staff) ---------------- */

router.patch('/:id', auth, staffOnly, async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const patch = {};

  // Every parameter the desk is allowed to adjust
  if (b.side !== undefined && ['LONG', 'SHORT', 'SPOT'].includes(b.side)) patch.side = b.side;
  if (b.amount !== undefined) patch.amount = num(b.amount);
  if (b.entryPrice !== undefined) patch.entryPrice = num(b.entryPrice);
  if (b.currentPrice !== undefined) patch.currentPrice = num(b.currentPrice);
  if (b.leverage !== undefined) patch.leverage = Math.max(1, num(b.leverage, 1));
  if (b.pnl !== undefined) patch.pnl = num(b.pnl);
  if (b.stopLoss !== undefined) patch.stopLoss = b.stopLoss === null ? null : num(b.stopLoss);
  if (b.takeProfit !== undefined) patch.takeProfit = b.takeProfit === null ? null : num(b.takeProfit);
  if (b.openedAt !== undefined) patch.openedAt = b.openedAt;
  if (b.margin !== undefined) patch.margin = num(b.margin);
  if (b.liquidationPrice !== undefined) patch.liquidationPrice = num(b.liquidationPrice);
  if (b.status !== undefined && ['OPEN', 'CLOSED'].includes(b.status)) patch.status = b.status;

  patch.editedBy = req.user.name;
  patch.editedAt = new Date().toISOString();

  const trade = await store.update('trades', id, patch);
  if (!trade) return res.status(404).json({ error: 'Position not found' });

  res.json({ ok: true, trade });
});

/* ---------------- close ---------------- */

router.post('/:id/close', auth, async (req, res) => {
  const id = Number(req.params.id);
  const existing = await store.byId('trades', id);
  if (!existing) return res.status(404).json({ error: 'Position not found' });

  if (!isStaff(req.user) && existing.userId !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const trade = await store.update('trades', id, {
    status: 'CLOSED',
    closedAt: new Date().toISOString(),
    closedBy: req.user.name,
  });

  res.json({ ok: true, trade });
});

export default router;
