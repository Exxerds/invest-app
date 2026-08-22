// ============================================================
//  ADMIN: user management from the CRM / admin panel
//  - list users
//  - change the password of ANY user (admin only)
//  - block / unblock / change role
// ============================================================
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as store from '../db.js';
import { logActivity } from './workspace.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// ---------- middleware: verify JWT and role ----------
function auth(requiredRole = 'ADMIN') {
  return async (req, res, next) => {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Not authorized' });

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const user = await store.byId('users', payload.userId);
      if (!user) return res.status(401).json({ error: 'User not found' });
      if (requiredRole === 'ADMIN' && user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      if (requiredRole === 'STAFF' && !['ADMIN', 'MANAGER'].includes(user.role)) {
        return res.status(403).json({ error: 'Staff access required' });
      }
      req.user = user;
      next();
    } catch {
      res.status(401).json({ error: 'Session expired, sign in again' });
    }
  };
}

// ------------------------------------------------------------
//  CREATE USER / CLIENT (CRM action: "Create client")
// ------------------------------------------------------------
router.post('/users', auth('STAFF'), async (req, res) => {
  try {
    const { name, email, password, phone, balance, role = 'CLIENT', status = 'active' } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const lowerEmail = String(email).toLowerCase().trim();
    if (await store.findBy('users', 'email', lowerEmail)) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    if (phone) {
      const existingWithPhone = await store.findBy('users', 'phone', String(phone).trim());
      if (existingWithPhone) {
        return res.status(409).json({ error: `A user with phone ${phone} already exists (${existingWithPhone.name})` });
      }
    }

    const hash = await bcrypt.hash(String(password), 10);
    const userRole = req.user.role === 'ADMIN' && ['CLIENT', 'MANAGER', 'ADMIN'].includes(role) ? role : 'CLIENT';
    
    const assignedToCreator = req.user.role === 'MANAGER' && userRole === 'CLIENT';
    const user = await store.insert('users', {
      name: String(name).trim(),
      email: lowerEmail,
      phone: String(phone || '').trim(),
      password: hash,
      role: userRole,
      status: ['active', 'pending', 'blocked'].includes(status) ? status : 'active',
      balance: Number(balance) || 0,
      created_at: new Date().toISOString(),
      createdBy: req.user.name,
      assignedManagerId: assignedToCreator ? req.user.id : null,
      assignedManagerName: assignedToCreator ? req.user.name : '',
      defaultLeverage: 10,
    });

    res.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        balance: user.balance,
      },
      message: `Client ${user.name} created successfully`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
router.get('/users', auth('STAFF'), async (req, res) => {
  const all = await store.all('users');
  let rows;
  if (req.user.role === 'ADMIN') {
    rows = all;
  } else {
    // A manager sees only the clients assigned to them
    rows = all.filter(u =>
      u.role === 'CLIENT' && Number(u.assignedManagerId) === Number(req.user.id),
    );
  }
  const users = rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    balance: Number(u.balance) || 0,
    phone: u.phone || '',
    created_at: u.created_at,
    lastSeen: u.lastSeen || null,
    assignedManagerId: u.assignedManagerId || null,
    assignedManagerName: u.assignedManagerName || '',
    defaultLeverage: Number(u.defaultLeverage) || 10,
  }));
  res.json({ users });
});

// ------------------------------------------------------------
//  ACTIVITY LOG OF A USER (View user logs in the CRM)
// ------------------------------------------------------------
router.get('/users/:id/activity', auth('STAFF'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid user id' });

  // entries BY the user (logins etc.) and ABOUT the user (staff actions on them)
  const rows = (await store.allWhere('activity', (a) =>
    a.actorId === id || a.target === `user ${id}` || Number(a.target) === id || String(a.target).includes(`#${id}`),
  ))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 100);

  res.json({ entries: rows });
});

// ------------------------------------------------------------
//  CHANGE PASSWORD FOR ANY USER
// ------------------------------------------------------------
router.post('/users/:id/password', auth('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  const { newPassword } = req.body || {};

  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const user = await store.byId('users', id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const hash = await bcrypt.hash(String(newPassword), 10);
  await store.update('users', id, { password: hash });

  logActivity({ actor: req.user, action: 'password_changed', target: `user ${id}`, details: user.email }).catch(() => undefined);

  res.json({ ok: true, message: `Password for ${user.email} has been changed` });
});

// ------------------------------------------------------------
//  Block / unblock / role
// ------------------------------------------------------------
router.patch('/users/:id', auth('STAFF'), async (req, res) => {
  const id = Number(req.params.id);
  const { status, role, assignedManagerId, defaultLeverage } = req.body || {};

  const user = await store.byId('users', id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (id === req.user.id && (status || role)) {
    return res.status(400).json({ error: 'You cannot change your own account here' });
  }

  const fields = {};
  if (req.user.role === 'ADMIN') {
    if (status && ['active', 'blocked', 'pending'].includes(status)) fields.status = status;
    if (role && ['CLIENT', 'MANAGER', 'ADMIN'].includes(role)) fields.role = role;
  } else if (status || role) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  if (assignedManagerId !== undefined) {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });
    if (assignedManagerId === null || assignedManagerId === '') {
      fields.assignedManagerId = null;
      fields.assignedManagerName = '';
    } else {
      const mgr = await store.byId('users', Number(assignedManagerId));
      if (!mgr || !['ADMIN', 'MANAGER'].includes(mgr.role)) {
        return res.status(400).json({ error: 'Manager not found' });
      }
      fields.assignedManagerId = mgr.id;
      fields.assignedManagerName = mgr.name;
    }
  }

  if (defaultLeverage !== undefined) {
    const lev = Math.max(1, Math.min(500, Number(defaultLeverage) || 1));
    fields.defaultLeverage = lev;
  }

  await store.update('users', id, fields);

  logActivity({
    actor: req.user,
    action: status === 'blocked' ? 'user_blocked' : status === 'active' ? 'user_unblocked' : 'user_updated',
    target: `user ${id}`,
    details: JSON.stringify(fields),
  }).catch(() => undefined);

  res.json({ ok: true, message: 'User updated' });
});

/* ------------------------------------------------------------
   SET CLIENT BALANCE — CRM → Trading → "Change balance"
   The desk types the exact balance the client account must show.
   Staff-only (ADMIN or MANAGER), clients only. Even a blocked
   account may be corrected; every change is written into the
   transaction journal as an approved manual deposit so both the
   audit trail and the client's own history stay complete.
   ------------------------------------------------------------ */
router.put('/users/:id/balance', auth('STAFF'), async (req, res) => {
  const id = Number(req.params.id);
  const target = await store.byId('users', id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.role !== 'CLIENT') {
    return res.status(400).json({ error: 'Only client balances can be changed' });
  }

  const raw = Number(req.body?.balance);
  if (!Number.isFinite(raw)) return res.status(400).json({ error: 'Enter a valid balance' });
  // Never negative, always rounded to cents
  const balance = Math.max(0, Math.round(raw * 100) / 100);

  const updated = await store.update('users', id, { balance });
  const transaction = await store.insert('transactions', {
    userId: target.id,
    userName: target.name,
    userEmail: target.email,
    type: 'deposit',
    amount: balance,
    method: `Manual balance adjustment by ${req.user.name}`,
    status: 'approved',
    createdAt: new Date().toISOString(),
    reviewedBy: req.user.name,
    reviewedAt: new Date().toISOString(),
    balanceAfter: balance,
    manual: true,
  });

  logActivity({ actor: req.user, action: 'balance_set', target: `user ${id}`, details: `$${balance}` }).catch(() => undefined);

  res.json({ ok: true, balance: updated.balance, transaction });
});

/* ------------------------------------------------------------
   IMPERSONATION — "Login as user"
   Issues a short-lived token for the client so support can see
   exactly what the client sees. Admin only, and the token carries
   an `impersonatedBy` claim so the action is traceable.
   ------------------------------------------------------------ */
router.post('/users/:id/impersonate', auth('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  const target = await store.byId('users', id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.role !== 'CLIENT') {
    return res.status(400).json({ error: 'Only client accounts can be viewed this way' });
  }

  const token = jwt.sign(
    { userId: target.id, role: target.role, impersonatedBy: req.user.email },
    JWT_SECRET,
    { expiresIn: '1h' },
  );

  console.log(`[admin] ${req.user.email} signed in as ${target.email}`);
  logActivity({ actor: req.user, action: 'impersonated', target: `user ${id}`, details: target.email }).catch(() => undefined);

  res.json({
    ok: true,
    token,
    user: { id: target.id, name: target.name, email: target.email, role: target.role, status: target.status },
  });
});

/* ------------------------------------------------------------
   RESET PORTFOLIO — wipe test positions for a fresh account
   Admin only, CLIENT only. Removes all trades + investments,
   zeroes the cash balance and writes an audit withdrawal so the
   history does not go silent.
   ------------------------------------------------------------ */
router.post('/users/:id/reset-portfolio', auth('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  const user = await store.byId('users', id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role !== 'CLIENT') return res.status(400).json({ error: 'Only client portfolios can be reset' });

  const deletedTrades = await store.removeWhere('trades', t => Number(t.userId) === id);
  const deletedInvestments = await store.removeWhere('investments', inv => Number(inv.userId) === id);
  await store.update('users', id, { balance: 0 });
  await store.insert('transactions', {
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    type: 'withdrawal',
    amount: 0,
    method: `Portfolio reset by ${req.user.name} (test data cleanup)`,
    status: 'approved',
    createdAt: new Date().toISOString(),
    balanceAfter: 0,
  });

  res.json({ ok: true, deletedTrades, deletedInvestments });
});

export default router;
