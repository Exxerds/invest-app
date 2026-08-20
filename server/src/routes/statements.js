// ============================================================
//  Account statements.
//
//  The server builds the statement DATA (positions, transactions,
//  totals for a period). An admin may override any headline figure
//  before it is issued — the PDF itself is rendered in the browser
//  so no binary PDF library is needed on a serverless host.
//
//    GET  /api/statements/:userId          build a statement
//    PUT  /api/statements/:userId/override admin edits the figures
// ============================================================
import express from 'express';
import jwt from 'jsonwebtoken';
import * as store from '../db.js';
import { pnlOf } from '../margin.js';
import { livePrice } from './symbols.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

async function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authorized' });
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Session expired, sign in again' });
  }
  let user;
  try {
    user = await store.byId('users', payload.userId);
  } catch (e) {
    console.error('[auth] DB error:', e.message);
    return res.status(503).json({ error: 'Service temporarily unavailable. Please try again.' });
  }
    if (!user) return res.status(401).json({ error: 'User not found' });
        req.user = user;
    next();
  }

const isStaff = (u) => u.role === 'ADMIN' || u.role === 'MANAGER';
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

router.get('/:userId', auth, async (req, res) => {
  const userId = Number(req.params.userId);

  // A client may only pull their own statement
  if (!isStaff(req.user) && req.user.id !== userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const client = await store.byId('users', userId);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const from = req.query.from ? new Date(String(req.query.from)) : null;
  const to = req.query.to ? new Date(String(req.query.to)) : null;
  const inRange = (iso) => {
    if (!iso) return true;
    const d = new Date(iso);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  };

  const allTrades = await store.manyByField('trades', 'userId', userId);
  const allTx = await store.manyByField('transactions', 'userId', userId);

  const trades = allTrades.filter(t => inRange(t.openedAt));
  const transactions = allTx.filter(t => inRange(t.createdAt) && t.status === 'approved');

  // Mark open positions to market so the statement shows a live valuation
  const open = trades.filter(t => t.status === 'OPEN');
  let unrealised = 0;
  for (const t of open) {
    const price = Number(await livePrice(t.symbol)) || Number(t.entryPrice) || 0;
    const units = Number(t.units) || 0;
    unrealised += pnlOf({ side: t.side, entryPrice: t.entryPrice, currentPrice: price, units });
  }

  const closed = trades.filter(t => t.status === 'CLOSED');
  const realised = closed.reduce((s, t) => s + (Number(t.pnl) || 0), 0);
  const wins = closed.filter(t => (Number(t.pnl) || 0) > 0).length;

  const deposits = transactions
    .filter(t => t.type === 'deposit')
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const withdrawals = transactions
    .filter(t => t.type === 'withdrawal')
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);

  const volume = trades.reduce((s, t) => s + (Number(t.notional) || Number(t.amount) || 0), 0);

  const overrideRec = await store.byField('settings', 'key', `statement:${userId}`);
  const overrides = overrideRec?.value || {};

  const computed = {
    balance: round2(client.balance),
    deposits: round2(deposits),
    withdrawals: round2(withdrawals),
    realisedPnl: round2(realised),
    unrealisedPnl: round2(unrealised),
    volume: round2(volume),
    tradeCount: trades.length,
    closedCount: closed.length,
    openCount: open.length,
    winRate: closed.length ? Math.round((wins / closed.length) * 1000) / 10 : 0,
  };

  res.json({
    client: { id: client.id, name: client.name, email: client.email },
    period: {
      from: from ? from.toISOString() : null,
      to: to ? to.toISOString() : null,
    },
    // What the numbers really are, before any manual edit
    computed,
    // What should be printed (admin overrides win)
    figures: { ...computed, ...overrides },
    overrides,
    notes: overrides.notes || '',
    trades: trades
      .sort((a, b) => (a.openedAt < b.openedAt ? 1 : -1))
      .slice(0, 200)
      .map(t => ({
        symbol: t.symbol,
        side: t.side,
        units: t.units,
        notional: t.notional ?? t.amount,
        entryPrice: t.entryPrice,
        exitPrice: t.exitPrice ?? null,
        pnl: t.pnl ?? 0,
        status: t.status,
        openedAt: t.openedAt,
        closedAt: t.closedAt ?? null,
      })),
    transactions: transactions
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 200)
      .map(t => ({
        type: t.type,
        amount: t.amount,
        method: t.method,
        status: t.status,
        createdAt: t.createdAt,
      })),
    issuedAt: new Date().toISOString(),
  });
});

/** Admin: hand-edit the headline figures printed on the statement. */
router.put('/:userId/override', auth, async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Administrator access only' });

  const userId = Number(req.params.userId);
  const client = await store.byId('users', userId);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const body = req.body?.overrides || {};
  const numericKeys = [
    'balance', 'deposits', 'withdrawals', 'realisedPnl',
    'unrealisedPnl', 'volume', 'tradeCount', 'closedCount', 'openCount', 'winRate',
  ];

  const value = {};
  for (const k of numericKeys) {
    if (body[k] !== undefined && body[k] !== null && body[k] !== '') {
      const n = Number(body[k]);
      if (Number.isFinite(n)) value[k] = n;
    }
  }
  if (body.notes !== undefined) value.notes = String(body.notes).slice(0, 2000);

  const rec = await store.byField('settings', 'key', `statement:${userId}`);
  const payload = { value, updatedBy: req.user.name, updatedAt: new Date().toISOString() };
  if (rec) await store.update('settings', rec.id, payload);
  else await store.insert('settings', { key: `statement:${userId}`, ...payload });

  res.json({ ok: true, overrides: value });
});

export default router;
