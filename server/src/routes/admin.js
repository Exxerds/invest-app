// ============================================================
//  ADMIN: управление пользователями из CRM/админки
//  - список пользователей
//  - смена пароля ЛЮБОМУ пользователю (админ)
//  - блокировка / разблокировка / смена роли
// ============================================================
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as store from '../store.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// ---------- middleware: проверка JWT и роли ----------
function auth(requiredRole = 'ADMIN') {
  return (req, res, next) => {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Not authorized' });

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const user = store.findBy('users', 'id', payload.userId);
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
//  Список пользователей
// ------------------------------------------------------------
router.get('/users', auth('ADMIN'), (req, res) => {
  const users = store
    .all('users')
    .map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, created_at: u.created_at }));
  res.json({ users });
});

// ------------------------------------------------------------
//  СМЕНА ПАРОЛЯ ЛЮБОМУ ПОЛЬЗОВАТЕЛЮ
// ------------------------------------------------------------
router.post('/users/:id/password', auth('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  const { newPassword } = req.body || {};

  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const user = store.findBy('users', 'id', id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const hash = await bcrypt.hash(String(newPassword), 10);
  store.update('users', id, { password: hash });

  res.json({ ok: true, message: `Password for ${user.email} has been changed` });
});

// ------------------------------------------------------------
//  Блокировка / разблокировка / роль
// ------------------------------------------------------------
router.patch('/users/:id', auth('ADMIN'), (req, res) => {
  const id = Number(req.params.id);
  const { status, role } = req.body || {};

  const user = store.findBy('users', 'id', id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (id === req.user.id) return res.status(400).json({ error: 'You cannot change your own account here' });

  const fields = {};
  if (status && ['active', 'blocked', 'pending'].includes(status)) fields.status = status;
  if (role && ['CLIENT', 'MANAGER', 'ADMIN'].includes(role)) fields.role = role;
  store.update('users', id, fields);

  res.json({ ok: true, message: 'User updated' });
});

export default router;
