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
//  List users
// ------------------------------------------------------------
router.get('/users', auth('ADMIN'), async (req, res) => {
  const rows = await store.all('users');
  const users = rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    created_at: u.created_at,
  }));
  res.json({ users });
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

  res.json({ ok: true, message: `Password for ${user.email} has been changed` });
});

// ------------------------------------------------------------
//  Block / unblock / role
// ------------------------------------------------------------
router.patch('/users/:id', auth('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  const { status, role } = req.body || {};

  const user = await store.byId('users', id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (id === req.user.id) return res.status(400).json({ error: 'You cannot change your own account here' });

  const fields = {};
  if (status && ['active', 'blocked', 'pending'].includes(status)) fields.status = status;
  if (role && ['CLIENT', 'MANAGER', 'ADMIN'].includes(role)) fields.role = role;
  await store.update('users', id, fields);

  res.json({ ok: true, message: 'User updated' });
});

export default router;
