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
import { notify } from '../notifications.js';

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
    if (user.status === 'blocked') return res.status(403).json({ error: 'Account is blocked' });
    if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      return res.status(403).json({ error: 'Staff access only' });
    }
        req.user = user;
    next();
  }

const clean = (v, max = 200) => String(v ?? '').slice(0, max);

/** Digits only, so +1 (415) 555-0182 and 14155550182 match. */
const normPhone = (v) => String(v ?? '').replace(/\D/g, '');
const normEmail = (v) => String(v ?? '').trim().toLowerCase();

/**
 * Duplicate Control (PDF p.13).
 * A lead is a duplicate when the phone or the e-mail already exists —
 * either in the funnel or among registered platform accounts.
 */
async function findDuplicate({ phone, email }, { leads, users }) {
  const p = normPhone(phone);
  const e = normEmail(email);
  if (!p && !e) return null;

  for (const l of leads) {
    if (p && normPhone(l.phone) === p) return { type: 'lead', field: 'phone', match: l.name };
    if (e && normEmail(l.email) === e) return { type: 'lead', field: 'email', match: l.name };
  }
  for (const u of users) {
    if (e && normEmail(u.email) === e) return { type: 'client', field: 'email', match: u.name };
    if (p && u.phone && normPhone(u.phone) === p) return { type: 'client', field: 'phone', match: u.name };
  }
  return null;
}

router.post('/public', async (req, res) => {
  const b = req.body || {};
  const name = clean(b.name, 120).trim();
  if (!name || name.length < 1) return res.status(400).json({ error: 'Name is required' });

  const emailRaw = clean(b.email, 120).trim();
  if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }
  if (emailRaw.length > 120) return res.status(400).json({ error: 'Email is too long' });

  const phone = clean(b.phone, 40);
  const message = clean(b.message ?? b.notes ?? '', 2000);
  const source = clean(b.source, 120).trim() || 'Landing';

  // Duplicate — same phone or email already in leads or users (do not reveal who owns it)
  const [leads, users] = await Promise.all([store.all('leads'), store.all('users')]);
  const dup = await findDuplicate({ phone, email: emailRaw }, { leads, users });
  if (dup) return res.status(409).json({ error: 'This contact already exists' });

  // Anti-spam: max 3 leads per normalized email per 24h
  const eNorm = normEmail(emailRaw);
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recent = leads.filter(l => normEmail(l.email) === eNorm && l.createdAt && new Date(l.createdAt).getTime() >= cutoff).length;
  if (recent >= 3) return res.status(429).json({ error: 'Too many requests, try again later' });

  const lead = await store.insert('leads', {
    name,
    phone,
    email: emailRaw,
    potentialAmount: 0,
    stage: 'New',
    notes: message ? `From website: ${message}` : '',
    source,
    manager: '',
    comments: [],
    createdBy: 'Website',
    createdAt: new Date().toISOString(),
  });

  // Notify staff (bell + push)
  notify({
    audience: 'staff',
    kind: 'lead',
    title: 'New lead from the website',
    message: `${name} (${emailRaw || phone}) — ${source}`,
    link: 'leads',
  }).catch(() => undefined);

  res.json({ ok: true, id: lead.id });
});

router.get('/', auth, async (req, res) => {
  const leads = await store.all('leads');
  res.json({ leads: leads.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) });
});

router.post('/', auth, async (req, res) => {
  const b = req.body || {};
  if (!clean(b.name).trim()) return res.status(400).json({ error: 'Name is required' });

  // Duplicate protection — can be overridden deliberately
  if (!b.force) {
    const [leads, users] = await Promise.all([store.all('leads'), store.all('users')]);
    const dup = await findDuplicate({ phone: b.phone, email: b.email }, { leads, users });
    if (dup) {
      return res.status(409).json({
        error: `Duplicate: this ${dup.field} already belongs to ${dup.match} (${dup.type}).`,
        duplicate: dup,
      });
    }
  }

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

/* ---------------- bulk import (PDF p.12, 14) ---------------- */

/**
 * Import leads from a pasted CSV.
 * Duplicates are skipped and reported rather than silently dropped, and
 * the rows can be spread across managers round-robin.
 */
router.post('/import', auth, async (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows.slice(0, 2000) : [];
  if (!rows.length) return res.status(400).json({ error: 'Nothing to import' });

  const assignees = Array.isArray(req.body?.assignTo) && req.body.assignTo.length
    ? req.body.assignTo.map(a => clean(a, 120))
    : [req.user.name];

  const [existingLeads, users] = await Promise.all([store.all('leads'), store.all('users')]);
  const pool = [...existingLeads];

  const imported = [];
  const duplicates = [];
  const invalid = [];

  for (const [i, row] of rows.entries()) {
    const name = clean(row.name, 120).trim();
    if (!name) {
      invalid.push({ row: i + 1, reason: 'missing name' });
      continue;
    }

    const dup = await findDuplicate({ phone: row.phone, email: row.email }, { leads: pool, users });
    if (dup) {
      duplicates.push({ row: i + 1, name, reason: `${dup.field} matches ${dup.match}` });
      continue;
    }

    const lead = await store.insert('leads', {
      name,
      phone: clean(row.phone, 40),
      email: normEmail(row.email),
      potentialAmount: Number(row.potentialAmount) || 0,
      stage: clean(row.stage, 60) || 'new',
      notes: clean(row.notes, 2000),
      manager: assignees[imported.length % assignees.length],
      comments: [],
      source: 'import',
      createdBy: req.user.name,
      createdAt: new Date().toISOString(),
    });

    pool.push(lead);
    imported.push(lead);
  }

  res.json({
    ok: true,
    imported: imported.length,
    duplicates,
    invalid,
    message: `Imported ${imported.length}, skipped ${duplicates.length} duplicate(s), ${invalid.length} invalid row(s).`,
  });
});

/** Check a phone / e-mail before the agent finishes typing. */
router.post('/check-duplicate', auth, async (req, res) => {
  const [leads, users] = await Promise.all([store.all('leads'), store.all('users')]);
  const dup = await findDuplicate(
    { phone: req.body?.phone, email: req.body?.email },
    { leads, users },
  );
  res.json({ duplicate: dup });
});

export default router;
