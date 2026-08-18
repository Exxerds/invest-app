// ============================================================
//  Leads — the CRM sales funnel, stored on the server.
//
//  Everything staff types here used to live in React state only,
//  so a page refresh threw it away. Now every lead, stage change
//  and comment is persisted.
//
//    GET    /api/leads            staff: whole funnel
//    POST   /api/leads            staff: create a lead
//    PATCH  /api/leads/:id        staff: edit any field (incl. stage)
//    POST   /api/leads/:id/comment staff: append a comment
//    DELETE /api/leads/:id        admin: remove a lead
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
    if (user.status === 'blocked') return res.status(403).json({ error: 'Account is blocked' });
    if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      return res.status(403).json({ error: 'Staff access only' });
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired, sign in again' });
  }
}

const clean = (v, max = 200) => String(v ?? '').slice(0, max);

router.get('/', auth, async (req, res) => {
  const leads = await store.all('leads');
  res.json({ leads: leads.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) });
});

router.post('/', auth, async (req, res) => {
  const b = req.body || {};
  if (!clean(b.name).trim()) return res.status(400).json({ error: 'Name is required' });

  const lead = await store.insert('leads', {
    name: clean(b.name, 120).trim(),
    phone: clean(b.phone, 40),
    email: clean(b.email, 120),
    potentialAmount: Number(b.potentialAmount) || 0,
    stage: clean(b.stage, 60) || 'New',
    notes: clean(b.notes, 2000),
    manager: clean(b.manager, 120) || req.user.name,
    comments: [],
    createdBy: req.user.name,
    createdAt: new Date().toISOString(),
  });

  res.json({ ok: true, lead });
});

router.patch('/:id', auth, async (req, res) => {
  const id = Number(req.params.id);
  const existing = await store.byId('leads', id);
  if (!existing) return res.status(404).json({ error: 'Lead not found' });

  const b = req.body || {};
  const patch = {};
  if (b.name !== undefined) patch.name = clean(b.name, 120);
  if (b.phone !== undefined) patch.phone = clean(b.phone, 40);
  if (b.email !== undefined) patch.email = clean(b.email, 120);
  if (b.potentialAmount !== undefined) patch.potentialAmount = Number(b.potentialAmount) || 0;
  if (b.stage !== undefined) patch.stage = clean(b.stage, 60);
  if (b.notes !== undefined) patch.notes = clean(b.notes, 2000);
  if (b.manager !== undefined) patch.manager = clean(b.manager, 120);
  patch.updatedAt = new Date().toISOString();

  const lead = await store.update('leads', id, patch);
  res.json({ ok: true, lead });
});

router.post('/:id/comment', auth, async (req, res) => {
  const id = Number(req.params.id);
  const existing = await store.byId('leads', id);
  if (!existing) return res.status(404).json({ error: 'Lead not found' });

  const text = clean(req.body?.text, 2000).trim();
  if (!text) return res.status(400).json({ error: 'Comment cannot be empty' });

  // Comments are append-only by design: an agent can add, never rewrite history
  const comments = Array.isArray(existing.comments) ? existing.comments : [];
  comments.push({
    id: `c-${Date.now()}`,
    author: req.user.name,
    text,
    date: new Date().toISOString(),
  });

  const lead = await store.update('leads', id, { comments });
  res.json({ ok: true, lead });
});

router.delete('/:id', auth, async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Administrator access only' });
  const id = Number(req.params.id);
  const removed = await store.removeWhere('leads', (l) => l.id === id);
  if (!removed) return res.status(404).json({ error: 'Lead not found' });
  res.json({ ok: true });
});

export default router;
