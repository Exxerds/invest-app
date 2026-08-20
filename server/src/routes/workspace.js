// ============================================================
//  Everything the back office types by hand.
//
//  These used to live in React state and vanished on refresh:
//  client notes, support conversations, per-client statuses,
//  CRM preferences and the staff activity log.
//
//    GET/POST   /api/workspace/notes            client notes
//    GET/POST   /api/workspace/messages         support chat
//    GET/PUT    /api/workspace/crm-settings     CRM preferences
//    GET/PUT    /api/workspace/client-status    lead/client status
//    GET        /api/workspace/activity         staff action log
//    PUT        /api/workspace/me               update own profile
//    POST       /api/workspace/me/password      change own password
// ============================================================
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
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
    if (user.status === 'blocked') return res.status(403).json({ error: 'Account is blocked' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired, sign in again' });
  }
}

const isStaff = (u) => u.role === 'ADMIN' || u.role === 'MANAGER';
const staffOnly = (req, res, next) =>
  isStaff(req.user) ? next() : res.status(403).json({ error: 'Staff access only' });

const clean = (v, max = 2000) => String(v ?? '').slice(0, max);

/**
 * Append an entry to the audit trail.
 * Exported so other routes can record their own actions.
 */
export async function logActivity({ actor, action, target, details }) {
  try {
    await store.insert('activity', {
      actorId: actor?.id ?? null,
      actorName: actor?.name || 'system',
      actorRole: actor?.role || 'SYSTEM',
      action: clean(action, 60),
      target: clean(target, 120),
      details: clean(details, 500),
      createdAt: new Date().toISOString(),
    });
  } catch {
    /* logging must never break the request it describes */
  }
}

/* ---------------- own profile (any signed-in user) ---------------- */

/**
 * Same idea as publicUser() in auth.js: everything the client may see,
 * never the password hash. Kept local because auth.js does not export it.
 */
const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone || '',
  role: u.role,
  status: u.status,
  balance: Number(u.balance) || 0,
  created_at: u.created_at,
});

/**
 * PUT /workspace/me — update MY OWN profile: name, e-mail, phone.
 * Available to every authenticated account (client or staff).
 */
router.put('/me', auth, async (req, res) => {
  const b = req.body || {};

  const name = clean(b.name, 100).trim();
  if (!name) return res.status(400).json({ error: 'Name cannot be empty' });

  const patch = { name };

  const email = String(b.email ?? '').toLowerCase().trim();
  if (email) {
    // Simple format check — enough for a login identifier
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Enter a valid e-mail address' });
    }
    // Changing to an address somebody else already owns is forbidden
    if (email !== String(req.user.email || '').toLowerCase()) {
      const taken = await store.findBy('users', 'email', email);
      if (taken && taken.id !== req.user.id) {
        return res.status(409).json({ error: 'E-mail is already in use' });
      }
    }
    patch.email = email;
  }

  patch.phone = clean(b.phone, 30).trim();

  const updated = await store.update('users', req.user.id, patch);
  if (!updated) return res.status(404).json({ error: 'User not found' });

  await logActivity({
    actor: req.user,
    action: 'profile_updated',
    target: `user-${req.user.id}`,
    details: name,
  });
  res.json({ ok: true, user: publicUser(updated) });
});

/**
 * POST /workspace/me/password — change MY OWN password.
 * The current password must be confirmed first.
 */
router.post('/me/password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};

  let matches = false;
  try {
    matches = await bcrypt.compare(String(currentPassword || ''), String(req.user.password || ''));
  } catch {
    matches = false;
  }
  if (!matches) return res.status(400).json({ error: 'Current password is incorrect' });

  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  const hash = await bcrypt.hash(String(newPassword), 10);
  await store.update('users', req.user.id, { password: hash });

  res.json({ ok: true });
});

/* ---------------- client notes ---------------- */

router.get('/investments', auth, async (req, res) => {
  const userId = req.user.id;
  const all = await store.manyByField('investments', 'userId', userId);
  // Only live positions — closed ones live in the transaction history
  res.json({ investments: all.filter(i => i.status !== 'closed') });
});

router.post('/investments', auth, async (req, res) => {
  const userId = req.user.id;
  const b = req.body || {};
  const amount = Number(b.amount) || 0;
  if (amount <= 0) return res.status(400).json({ error: 'Enter an amount' });

  const user = await store.byId('users', userId);
  const balance = Number(user?.balance) || 0;
  if (balance < amount && req.user.role === 'CLIENT') {
    return res.status(400).json({ error: 'Not enough balance' });
  }

  // Debit user balance
  const nextBalance = Math.max(0, Math.round((balance - amount) * 100) / 100);
  await store.update('users', userId, { balance: nextBalance });

  const investment = await store.insert('investments', {
    userId,
    userName: req.user.name,
    projectId: b.projectId || `p-${Date.now()}`,
    projectTitle: b.projectTitle || 'Asset Position',
    categoryLabel: b.categoryLabel || 'Trading Asset',
    amount,
    date: b.date || new Date().toISOString().split('T')[0],
    apr: Number(b.apr) || 24.5,
    nextPayoutDate: b.nextPayoutDate || '2026-09-01',
    accruedProfit: Number(b.accruedProfit) || 0,
    entryPrice: Number(b.entryPrice) || 0,
    symbol: b.symbol || '',
    tv: b.tv || '',
    status: 'active',
    createdAt: new Date().toISOString(),
  });

  res.json({ ok: true, investment, balance: nextBalance });
});

router.post('/investments/:id/claim', auth, async (req, res) => {
  const id = Number(req.params.id);
  const inv = await store.byId('investments', id);
  if (!inv || inv.userId !== req.user.id) return res.status(404).json({ error: 'Investment not found' });
  if (inv.status === 'closed') return res.status(400).json({ error: 'Position already closed' });
  const amount = Number(inv.amount) || 0;
  let profit = Number(req.body?.profit);
  if (!Number.isFinite(profit)) profit = Number(inv.accruedProfit) || 0;
  profit = Math.max(-amount, Math.min(profit, amount * 5));   // защита от абьюза
  profit = Math.round(profit * 100) / 100;
  const payout = Math.max(0, Math.round((amount + profit) * 100) / 100);
  const user = await store.byId('users', req.user.id);
  const nextBalance = Math.round(((Number(user?.balance) || 0) + payout) * 100) / 100;
  await store.update('users', req.user.id, { balance: nextBalance });
  await store.update('investments', id, {
    status: 'closed', accruedProfit: 0, finalProfit: profit, payout,
    lastClaimedAt: new Date().toISOString(), closedAt: new Date().toISOString(),
  });
  await store.insert('transactions', {
    userId: req.user.id, userName: req.user.name, userEmail: req.user.email,
    type: 'deposit', amount: payout,
    method: `Position closed — ${inv.projectTitle} (P/L ${profit >= 0 ? '+' : '-'}$${Math.abs(profit).toLocaleString('en-US')})`,
    status: 'approved', createdAt: new Date().toISOString(), balanceAfter: nextBalance,
  });
  res.json({ ok: true, closed: true, profit, payout, balance: nextBalance });
});

router.get('/notes', auth, staffOnly, async (req, res) => {
  const notes = await store.all('notes');
  res.json({ notes: notes.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) });
});

router.post('/notes', auth, staffOnly, async (req, res) => {
  const text = clean(req.body?.text).trim();
  const clientId = clean(req.body?.clientId, 60);
  if (!text) return res.status(400).json({ error: 'Note cannot be empty' });
  if (!clientId) return res.status(400).json({ error: 'Client is required' });

  // Notes are append-only by design: an agent can add, never rewrite history
  const note = await store.insert('notes', {
    clientId,
    author: req.user.name,
    authorRole: req.user.role,
    text,
    createdAt: new Date().toISOString(),
  });

  await logActivity({ actor: req.user, action: 'note_added', target: clientId, details: text.slice(0, 120) });
  res.json({ ok: true, note });
});

/* ---------------- support chat ---------------- */

/**
 * One thread per client. Staff read any thread, a client only their own.
 */
router.get('/messages', auth, async (req, res) => {
  const threadId = isStaff(req.user)
    ? Number(req.query.clientId) || 0
    : req.user.id;

  if (isStaff(req.user) && !threadId) {
    // Inbox view: latest message per client
    const all = await store.all('messages');
    const threads = new Map();
    for (const m of all) {
      const prev = threads.get(m.threadId);
      if (!prev || prev.createdAt < m.createdAt) threads.set(m.threadId, m);
    }
    return res.json({ threads: [...threads.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) });
  }

  const messages = await store.manyByField('messages', 'threadId', threadId);
  res.json({ messages: messages.sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1)) });
});

router.post('/messages', auth, async (req, res) => {
  const text = clean(req.body?.text, 4000).trim();
  if (!text) return res.status(400).json({ error: 'Message cannot be empty' });

  // Clients always write into their own thread; staff pick one
  const threadId = isStaff(req.user) ? Number(req.body?.clientId) || 0 : req.user.id;
  if (!threadId) return res.status(400).json({ error: 'Client is required' });

  const message = await store.insert('messages', {
    threadId,
    fromStaff: isStaff(req.user),
    author: req.user.name,
    text,
    createdAt: new Date().toISOString(),
  });

  if (isStaff(req.user)) {
    await notify({
      audience: 'client',
      userId: threadId,
      kind: 'support_reply',
      title: 'New message from support',
      message: text.slice(0, 140),
    });
  } else {
    await notify({
      audience: 'staff',
      userId: req.user.id,
      kind: 'support_message',
      title: `Support message from ${req.user.name}`,
      message: text.slice(0, 140),
      link: 'support',
    });
  }

  res.json({ ok: true, message });
});

/* ---------------- CRM preferences ---------------- */

router.get('/crm-settings', auth, staffOnly, async (req, res) => {
  const rec = await store.byField('settings', 'key', 'crmSettings');
  res.json({ settings: {
    hidePhonesFromAgents: false,
    duplicateControl: true,   // block repeated leads by default
    manualClosing: false,     // clients cannot close positions by default
    callRecording: true,
    ...(rec?.value || {}),
  } });
});

router.put('/crm-settings', auth, async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Administrator access only' });

  const value = {
    hidePhonesFromAgents: Boolean(req.body?.hidePhonesFromAgents),
    duplicateControl: req.body?.duplicateControl !== false,
    manualClosing: Boolean(req.body?.manualClosing),
    callRecording: req.body?.callRecording !== false,
  };
  const rec = await store.byField('settings', 'key', 'crmSettings');
  const payload = { value, updatedBy: req.user.name, updatedAt: new Date().toISOString() };
  if (rec) await store.update('settings', rec.id, payload);
  else await store.insert('settings', { key: 'crmSettings', ...payload });

  await logActivity({ actor: req.user, action: 'settings_changed', target: 'crmSettings', details: JSON.stringify(value) });
  res.json({ ok: true, settings: value });
});

/* ---------------- per-client status ---------------- */

router.get('/client-status', auth, staffOnly, async (req, res) => {
  const rec = await store.byField('settings', 'key', 'clientStatuses');
  res.json({ statuses: rec?.value || {} });
});

router.put('/client-status', auth, staffOnly, async (req, res) => {
  const clientId = clean(req.body?.clientId, 60);
  const status = clean(req.body?.status, 60);
  if (!clientId) return res.status(400).json({ error: 'Client is required' });

  const rec = await store.byField('settings', 'key', 'clientStatuses');
  const value = { ...(rec?.value || {}), [clientId]: status };
  const payload = { value, updatedBy: req.user.name, updatedAt: new Date().toISOString() };
  if (rec) await store.update('settings', rec.id, payload);
  else await store.insert('settings', { key: 'clientStatuses', ...payload });

  await logActivity({ actor: req.user, action: 'status_changed', target: clientId, details: status });
  res.json({ ok: true, statuses: value });
});

/* ---------------- activity log ---------------- */

router.get('/activity', auth, staffOnly, async (req, res) => {
  const all = await store.all('activity');
  const target = req.query.target ? String(req.query.target) : null;
  const filtered = target ? all.filter(a => a.target === target) : all;
  res.json({
    activity: filtered.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 300),
  });
});

export default router;
