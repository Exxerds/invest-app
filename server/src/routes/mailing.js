// ============================================================
//  Mass mailing ("Happy letter") — real delivery through SMTP.
//
//    GET  /api/mailing/audience
//    POST /api/mailing/send
// ============================================================
import express from 'express';
import jwt from 'jsonwebtoken';
import * as store from '../db.js';
import { sendMail, letterLayout } from '../mailer.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

async function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authorized' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await store.byId('users', payload.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (!['ADMIN', 'MANAGER'].includes(user.role)) {
      return res.status(403).json({ error: 'Staff access only' });
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired, sign in again' });
  }
}

function bodyToHtml(text) {
  const escaped = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .split(/\n{2,}/)
    .map(p => `<p style="color:#213532;font-size:14px;line-height:1.65;margin:0 0 12px;">${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function visibleClients(allUsers, staff) {
  let clients = allUsers.filter(u => u.role === 'CLIENT');
  if (staff.role === 'MANAGER') {
    clients = clients.filter(u => Number(u.assignedManagerId) === Number(staff.id));
  }
  return clients;
}

router.get('/audience', auth, async (req, res) => {
  const users = await store.all('users');
  const clients = visibleClients(users, req.user);
  res.json({
    all: clients.length,
    active: clients.filter(u => u.status === 'active').length,
    noDeposit: clients.filter(u => !Number(u.balance)).length,
    clients: clients.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      status: u.status,
    })),
  });
});

router.post('/send', auth, async (req, res) => {
  const subject = String(req.body?.subject || '').trim().slice(0, 200);
  const body = String(req.body?.body || '').trim().slice(0, 10_000);
  const audience = String(req.body?.audience || 'all');
  const userId = req.body?.userId != null ? Number(req.body.userId) : null;

  if (!subject) return res.status(400).json({ error: 'Subject is required' });
  if (!body) return res.status(400).json({ error: 'Message is required' });

  if (!process.env.SMTP_HOST) {
    return res.status(503).json({
      error: 'Mail provider is not configured on the server (SMTP_HOST in server/.env) — letters would not be delivered. Nothing was sent.',
    });
  }

  const users = await store.all('users');
  let pool = visibleClients(users, req.user).filter(u => u.status !== 'blocked' && u.email);

  let recipients;
  if (audience === 'one') {
    if (!userId) return res.status(400).json({ error: 'Pick a client' });
    recipients = pool.filter(u => Number(u.id) === userId);
  } else if (audience === 'active') {
    recipients = pool.filter(u => u.status === 'active');
  } else if (audience === 'noDeposit') {
    recipients = pool.filter(u => !Number(u.balance));
  } else {
    recipients = pool;
  }

  if (!recipients.length) return res.status(400).json({ error: 'No recipients match this selection' });

  const html = letterLayout(subject, bodyToHtml(body));

  let sent = 0;
  const failed = [];
  for (const u of recipients) {
    try {
      const delivered = await sendMail({ to: u.email, subject, html });
      if (delivered) sent += 1;
      else failed.push(u.email);
    } catch (err) {
      failed.push(u.email);
      console.error('[mailing] failed for', u.email, err.message);
    }
  }

  res.json({
    ok: true,
    sent,
    failed: failed.length,
    total: recipients.length,
    message: failed.length
      ? `Sent to ${sent} of ${recipients.length} recipients — ${failed.length} failed.`
      : `Letter delivered to ${sent} recipient(s).`,
  });
});

export default router;
