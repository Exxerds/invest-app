// ============================================================
//  Notification feed
//    GET  /api/notifications          list + unread counter
//    POST /api/notifications/read     mark one or all as read
// ============================================================
import express from 'express';
import jwt from 'jsonwebtoken';
import * as store from '../db.js';
import { listFor } from '../notifications.js';

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

router.get('/', auth, async (req, res) => {
  const items = await listFor(req.user);
  res.json({
    notifications: items.slice(0, 50),
    unread: items.filter((n) => !n.read).length,
  });
});

router.post('/read', auth, async (req, res) => {
  const { id } = req.body || {};
  const mine = await listFor(req.user);

  if (id) {
    if (mine.some((n) => n.id === id)) await store.update('notifications', id, { read: true });
  } else {
    for (const n of mine) if (!n.read) await store.update('notifications', n.id, { read: true });
  }

  const items = await listFor(req.user);
  res.json({ ok: true, unread: items.filter((n) => !n.read).length });
});

export default router;
