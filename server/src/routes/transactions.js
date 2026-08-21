// ============================================================
//  Deposits & withdrawals.
//
//  A client can only REQUEST money movement. Nothing touches the
//  balance until a member of staff approves the request in the CRM.
//  That mirrors how a real brokerage works: funds arrive by wire,
//  card or crypto, the finance desk confirms receipt, and only then
//  the account is credited.
//
//    GET    /api/transactions/mine        client: own requests + balance
//    POST   /api/transactions/deposit     client: request a deposit
//    POST   /api/transactions/withdraw    client: request a withdrawal
//    GET    /api/transactions/all         staff: every request
//    POST   /api/transactions/:id/approve staff: credit / debit the account
//    POST   /api/transactions/:id/reject  staff: decline with a reason
//    POST   /api/transactions/adjust      staff: manual balance correction
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
    if (user.status === 'blocked') return res.status(403).json({ error: 'Account is blocked' });
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

const money = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100) / 100;
};

/** Current balance = whatever the back office has credited so far. */
async function balanceOf(userId) {
  const user = await store.byId('users', userId);
  return money(user?.balance || 0);
}

/* ---------------- client: own data ---------------- */

router.get('/mine', auth, async (req, res) => {
  const items = await store.manyByField('transactions', 'userId', req.user.id);
  res.json({
    balance: await balanceOf(req.user.id),
    transactions: items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
  });
});

/* ---------------- client: request a deposit ---------------- */

router.post('/deposit', auth, async (req, res) => {
  const amount = money(req.body?.amount);
  const method = String(req.body?.method || 'Bank transfer').slice(0, 80);
  const cryptoType = String(req.body?.cryptoType || '').slice(0, 10);

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Enter a valid amount' });
  }
  if (amount > 10_000_000) {
    return res.status(400).json({ error: 'Amount is too large — please contact your advisor' });
  }

  // Record which address the client was told to pay into, so the finance
  // desk can match the incoming transfer later.
  let walletAddress = '';
  if (cryptoType) {
    // Personal address first, shared default second — must match what the
    // client was actually shown in the deposit dialog.
    const personal = await store.byField('settings', 'key', `depositWallets:${req.user.id}`);
    const shared = await store.byField('settings', 'key', 'depositWallets');
    walletAddress = String(personal?.value?.[cryptoType] || shared?.value?.[cryptoType] || '');
  }

  const tx = await store.insert('transactions', {
    userId: req.user.id,
    userName: req.user.name,
    userEmail: req.user.email,
    type: 'deposit',
    amount,
    method,
    cryptoType: cryptoType || undefined,
    walletAddress: walletAddress || undefined,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });

  await notify({
    audience: 'staff',
    userId: req.user.id,
    kind: 'deposit_request',
    title: 'New deposit request',
    message: `${req.user.name} requested a $${amount.toLocaleString('en-US')} deposit via ${method}.`,
    link: 'transactions',
  });

  res.json({
    ok: true,
    transaction: tx,
    message:
      'Your deposit request has been received. Funds are credited once our finance team confirms the payment.',
  });
});

/* ---------------- client: request a withdrawal ---------------- */

router.post('/withdraw', auth, async (req, res) => {
  const amount = money(req.body?.amount);
  const method = String(req.body?.method || 'Bank transfer').slice(0, 80);
  const destination = String(req.body?.destination || '').slice(0, 200);
  const cryptoType = String(req.body?.cryptoType || '').slice(0, 10);

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Enter a valid amount' });
  }

  // "WITHDRAWAL BLOCKED" is a CRM workflow status (Settings → client card).
  // It must actually stop withdrawals, not just look like a label.
  const statusesRec = await store.byField('settings', 'key', 'clientStatuses');
  const myStatus = String(statusesRec?.value?.[String(req.user.id)] || '')
    .toLowerCase().replace(/[-_]/g, ' ');
  if (myStatus.includes('withdrawal blocked') || myStatus.includes('withdrawals blocked') || myStatus === 'blocked') {
    return res.status(403).json({
      error: 'Withdrawals are temporarily disabled on your account. Please contact your manager or support for details.',
    });
  }

  const balance = await balanceOf(req.user.id);
  const pending = (await store.allWhere('transactions', (t) =>
    t.userId === req.user.id && t.type === 'withdrawal' && t.status === 'pending'))
    .reduce((s, t) => s + Number(t.amount || 0), 0);

  if (amount > balance - pending) {
    return res.status(400).json({
      error: `Insufficient available balance. You can withdraw up to $${money(balance - pending).toLocaleString('en-US')}.`,
    });
  }

  const tx = await store.insert('transactions', {
    userId: req.user.id,
    userName: req.user.name,
    userEmail: req.user.email,
    type: 'withdrawal',
    amount,
    method,
    destination,
    cryptoType: cryptoType || undefined,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });

  await notify({
    audience: 'staff',
    userId: req.user.id,
    kind: 'withdrawal_request',
    title: 'New withdrawal request',
    message: `${req.user.name} requested a $${amount.toLocaleString('en-US')} withdrawal.`,
    link: 'transactions',
  });

  res.json({
    ok: true,
    transaction: tx,
    message: 'Your withdrawal request is being reviewed by our compliance team.',
  });
});

/* ---------------- staff: review queue ---------------- */

router.get('/all', auth, staffOnly, async (req, res) => {
  const items = await store.all('transactions');
  res.json({ transactions: items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) });
});

router.post('/:id/approve', auth, staffOnly, async (req, res) => {
  const id = Number(req.params.id);
  const tx = await store.byId('transactions', id);
  if (!tx) return res.status(404).json({ error: 'Request not found' });
  if (tx.status !== 'pending') return res.status(400).json({ error: 'Request is already processed' });

  const client = await store.byId('users', tx.userId);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const current = money(client.balance || 0);
  const delta = tx.type === 'deposit' ? tx.amount : -tx.amount;
  const next = money(current + delta);

  if (next < 0) {
    return res.status(400).json({ error: 'Client balance would go negative — decline or adjust the request' });
  }

  await store.update('users', client.id, { balance: next });
  const updated = await store.update('transactions', id, {
    status: 'approved',
    reviewedBy: req.user.name,
    reviewedAt: new Date().toISOString(),
    balanceAfter: next,
  });

  await notify({
    audience: 'client',
    userId: client.id,
    kind: tx.type === 'deposit' ? 'deposit_approved' : 'withdrawal_approved',
    title: tx.type === 'deposit' ? 'Deposit credited' : 'Withdrawal approved',
    message:
      tx.type === 'deposit'
        ? `$${tx.amount.toLocaleString('en-US')} has been credited to your account.`
        : `Your withdrawal of $${tx.amount.toLocaleString('en-US')} has been approved and sent.`,
  });

  res.json({ ok: true, transaction: updated, balance: next });
});

router.post('/:id/reject', auth, staffOnly, async (req, res) => {
  const id = Number(req.params.id);
  const reason = String(req.body?.reason || '').slice(0, 300);
  const tx = await store.byId('transactions', id);
  if (!tx) return res.status(404).json({ error: 'Request not found' });
  if (tx.status !== 'pending') return res.status(400).json({ error: 'Request is already processed' });

  const updated = await store.update('transactions', id, {
    status: 'rejected',
    reviewedBy: req.user.name,
    reviewedAt: new Date().toISOString(),
    rejectReason: reason,
  });

  await notify({
    audience: 'client',
    userId: tx.userId,
    kind: 'transaction_rejected',
    title: tx.type === 'deposit' ? 'Deposit declined' : 'Withdrawal declined',
    message: reason
      ? `Your ${tx.type} request of $${tx.amount.toLocaleString('en-US')} was declined: ${reason}`
      : `Your ${tx.type} request of $${tx.amount.toLocaleString('en-US')} was declined. Please contact your advisor.`,
  });

  res.json({ ok: true, transaction: updated });
});

/* ---------------- staff: manual correction ---------------- */

router.post('/adjust', auth, staffOnly, async (req, res) => {
  const userId = Number(req.body?.userId);
  const amount = money(req.body?.amount); // may be negative
  const note = String(req.body?.note || 'Manual adjustment').slice(0, 200);

  if (!Number.isFinite(amount) || amount === 0) {
    return res.status(400).json({ error: 'Enter a non-zero amount' });
  }

  const client = await store.byId('users', userId);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const next = money(money(client.balance || 0) + amount);
  if (next < 0) return res.status(400).json({ error: 'Resulting balance cannot be negative' });

  await store.update('users', client.id, { balance: next });
  const tx = await store.insert('transactions', {
    userId: client.id,
    userName: client.name,
    userEmail: client.email,
    type: amount > 0 ? 'deposit' : 'withdrawal',
    amount: Math.abs(amount),
    method: note,
    status: 'approved',
    manual: true,
    reviewedBy: req.user.name,
    reviewedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    balanceAfter: next,
  });

  await notify({
    audience: 'client',
    userId: client.id,
    kind: 'balance_adjusted',
    title: 'Balance updated',
    message: `Your balance has been updated to $${next.toLocaleString('en-US')}.`,
  });

  res.json({ ok: true, transaction: tx, balance: next });
});

export default router;
