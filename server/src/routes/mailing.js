// ============================================================
//  Mass mailing ("Happy letter") — real delivery through SMTP.
//
//  Sends to platform accounts held in the database, so the
//  recipient list is always the live client base.
//
//    POST /api/mailing/send   admin only
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
    // A mass mailing can reach every client at once — administrators only
    if (user.role !== 'ADMIN') return res.status(403).json({ error: 'Administrator access only' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired, sign in again' });
  }
}

/** Turn the plain-text body typed in the CRM into safe HTML. */
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

router.get('/audience', auth, async (req, res) => {
  const users = await store.all('users');
  const clients = users.filter(u => u.role === 'CLIENT');
  res.json({
    all: clients.length,
    active: clients.filter(u => u.status === 'active').length,
    noDeposit: clients.filter(u => !Number(u.balance)).length,
  });
});

router.post('/send', auth, async (req, res) => {
  const subject = String(req.body?.subject || '').trim().slice(0, 200);
  const body = String(req.body?.body || '').trim().slice(0, 10_000);
  const audience = String(req.body?.audience || 'all');

  if (!subject) return res.status(400).json({ error: 'Subject is required' });
  if (!body) return res.status(400).json({ error: 'Message is required' });

  const users = await store.all('users');
  let recipients = users.filter(u => u.role === 'CLIENT' && u.status !== 'blocked' && u.email);

  if (audience === 'active') recipients = recipients.filter(u => u.status === 'active');
  else if (audience === 'noDeposit') recipients = recipients.filter(u => !Number(u.balance));

  if (!recipients.length) return res.status(400).json({ error: 'No recipients match this selection' });

  const html = letterLayout(subject, bodyToHtml(body));

  // Sent one by one so a single bad address cannot abort the whole run.
  let sent = 0;
  const failed = [];
  for (const u of recipients) {
    try {
      await sendMail({ to: u.email, subject, html });
      sent += 1;
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
