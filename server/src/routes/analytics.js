// ============================================================
//  Analytics computed from the database (PDF p.16).
//
//  Everything here used to be typed into the JSX by hand —
//  FTD 80.8%, Win Rate 62.4%, calls 145/140/5. Now the numbers
//  come from the records themselves, so the dashboard tells the
//  truth even when it is unflattering.
//
//    GET /api/analytics/overview   headline figures + charts
//    GET /api/analytics/managers   per-manager performance
// ============================================================
import express from 'express';
import jwt from 'jsonwebtoken';
import * as store from '../db.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

async function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authorized' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await store.byId('users', payload.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      return res.status(403).json({ error: 'Staff access only' });
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired, sign in again' });
  }
}

const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const pct = (part, total) => (total > 0 ? round1((part / total) * 100) : 0);

/** Month key like "2026-08" for grouping. */
const monthKey = (iso) => String(iso || '').slice(0, 7);

router.get('/overview', auth, async (req, res) => {
  const [users, trades, transactions, calls, leads] = await Promise.all([
    store.all('users'),
    store.all('trades'),
    store.all('transactions'),
    store.all('calls'),
    store.all('leads'),
  ]);

  const clients = users.filter(u => u.role === 'CLIENT');
  const approved = transactions.filter(t => t.status === 'approved');
  const deposits = approved.filter(t => t.type === 'deposit');
  const withdrawals = approved.filter(t => t.type === 'withdrawal');

  // FTD = share of registered clients who funded at least once
  const funded = new Set(deposits.map(d => d.userId));
  const depositTotal = deposits.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const withdrawTotal = withdrawals.reduce((s, t) => s + (Number(t.amount) || 0), 0);

  const closed = trades.filter(t => t.status === 'CLOSED');
  const wins = closed.filter(t => (Number(t.pnl) || 0) > 0);
  const grossProfit = wins.reduce((s, t) => s + (Number(t.pnl) || 0), 0);
  const grossLoss = closed
    .filter(t => (Number(t.pnl) || 0) < 0)
    .reduce((s, t) => s + Math.abs(Number(t.pnl) || 0), 0);

  const answered = calls.filter(c => c.answeredAt);

  // Assets under management: what clients actually hold right now
  const aum = clients.reduce((s, c) => s + (Number(c.balance) || 0), 0);

  // 6-month history of deposits, so the chart is real
  const months = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const inMonth = deposits.filter(t => monthKey(t.createdAt) === key);
    months.push({
      month: d.toLocaleString('en-US', { month: 'short' }),
      key,
      deposits: round2(inMonth.reduce((s, t) => s + (Number(t.amount) || 0), 0)),
      count: inMonth.length,
    });
  }

  res.json({
    clients: {
      total: clients.length,
      active: clients.filter(u => u.status === 'active').length,
      pending: clients.filter(u => u.status === 'pending').length,
      blocked: clients.filter(u => u.status === 'blocked').length,
      funded: funded.size,
      ftd: pct(funded.size, clients.length),
    },
    money: {
      aum: round2(aum),
      deposits: round2(depositTotal),
      withdrawals: round2(withdrawTotal),
      net: round2(depositTotal - withdrawTotal),
      avgDeposit: deposits.length ? round2(depositTotal / deposits.length) : 0,
      pendingRequests: transactions.filter(t => t.status === 'pending').length,
    },
    trading: {
      total: trades.length,
      open: trades.filter(t => t.status === 'OPEN').length,
      pending: trades.filter(t => t.status === 'PENDING').length,
      closed: closed.length,
      winRate: pct(wins.length, closed.length),
      volume: round2(trades.reduce((s, t) => s + (Number(t.notional) || Number(t.amount) || 0), 0)),
      netPnl: round2(closed.reduce((s, t) => s + (Number(t.pnl) || 0), 0)),
      profitFactor: grossLoss > 0 ? round2(grossProfit / grossLoss) : 0,
    },
    calls: {
      total: calls.length,
      answered: answered.length,
      missed: calls.length - answered.length,
      answerRate: pct(answered.length, calls.length),
      avgSec: answered.length
        ? Math.round(answered.reduce((s, c) => s + (Number(c.durationSec) || 0), 0) / answered.length)
        : 0,
      recorded: calls.filter(c => c.recordingUrl).length,
    },
    leads: {
      total: leads.length,
      byStage: leads.reduce((acc, l) => {
        const k = l.stage || 'new';
        return { ...acc, [k]: (acc[k] || 0) + 1 };
      }, {}),
      potential: round2(leads.reduce((s, l) => s + (Number(l.potentialAmount) || 0), 0)),
    },
    months,
  });
});

router.get('/managers', auth, async (req, res) => {
  const [users, calls, leads, activity] = await Promise.all([
    store.all('users'),
    store.all('calls'),
    store.all('leads'),
    store.all('activity'),
  ]);

  const staff = users.filter(u => u.role === 'MANAGER' || u.role === 'ADMIN');

  const rows = staff.map(m => {
    const mine = calls.filter(c => c.managerId === m.id);
    const answered = mine.filter(c => c.answeredAt);
    const myLeads = leads.filter(l => l.manager === m.name);
    const acts = activity.filter(a => a.actorId === m.id);
    const last = acts[0]?.createdAt || null;

    return {
      id: m.id,
      name: m.name,
      role: m.role,
      calls: mine.length,
      answered: answered.length,
      answerRate: pct(answered.length, mine.length),
      talkTimeSec: answered.reduce((s, c) => s + (Number(c.durationSec) || 0), 0),
      leads: myLeads.length,
      converted: myLeads.filter(l => l.stage === 'active').length,
      actions: acts.length,
      lastActive: last,
    };
  });

  res.json({ managers: rows.sort((a, b) => b.calls - a.calls) });
});

export default router;
