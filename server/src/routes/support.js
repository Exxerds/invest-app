// ============================================================
//  Real support chat: client ↔ manager/admin
//    GET  /api/support/conversations   staff only
//    GET  /api/support/messages?clientId=   client or staff
//    POST /api/support/messages  { text, clientId? }
//    POST /api/support/read      { clientId }
//    POST /api/support/presence  client ping
// ============================================================
import express from 'express';
import jwt from 'jsonwebtoken';
import * as store from '../db.js';
import { sendMail, letterLayout } from '../mailer.js';
import { notify } from '../notifications.js';
import { pushToUser } from './push.js';

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
const clean = (v, max = 2000) => String(v ?? '').slice(0, max);

/* ---------------- GET /conversations (staff only) ---------------- */
router.get('/conversations', auth, async (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json({ error: 'Staff access only' });

  const allMessages = await store.all('messages');
  // only support-chat messages have clientId field
  const supportMessages = allMessages.filter(m => m.clientId != null);

  const byClient = new Map();
  for (const m of supportMessages) {
    const cid = Number(m.clientId);
    if (!byClient.has(cid)) byClient.set(cid, []);
    byClient.get(cid).push(m);
  }

  const result = [];
  for (const [clientId, msgs] of byClient) {
    // sort by createdAt ascending for correct first/last
    msgs.sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
    const last = msgs[msgs.length - 1];
    const first = msgs[0];
    const unreadForStaff = msgs.filter(m => m.from === 'client' && !m.readByStaff).length;
    const lastPreview = String(last?.text || '').slice(0, 60);

    const clientUser = await store.byId('users', clientId);
    let name = clientUser?.name || `Client #${clientId}`;
    let email = clientUser?.email || '';
    let online = false;
    if (clientUser && clientUser.lastSeen) {
      online = Date.now() - Number(clientUser.lastSeen) < 60 * 1000;
    }

    result.push({
      clientId,
      name,
      email,
      online,
      unreadForStaff,
      lastMessageAt: last?.createdAt || null,
      lastPreview,
      createdAt: first?.createdAt || null,
    });
  }

  // most recent first
  result.sort((a, b) => {
    if (!a.lastMessageAt) return 1;
    if (!b.lastMessageAt) return -1;
    return a.lastMessageAt < b.lastMessageAt ? 1 : -1;
  });

  res.json({ conversations: result });
});

/* ---------------- GET /messages?clientId= ---------------- */
router.get('/messages', auth, async (req, res) => {
  let targetId;
  if (req.user.role === 'CLIENT') {
    targetId = req.user.id;
  } else {
    const q = req.query.clientId;
    if (q == null || q === '') return res.status(400).json({ error: 'clientId is required' });
    targetId = Number(q);
    if (!Number.isFinite(targetId)) return res.status(400).json({ error: 'Invalid clientId' });
    const clientUser = await store.byId('users', targetId);
    if (!clientUser) return res.status(404).json({ error: 'Client not found' });
    if (clientUser.role !== 'CLIENT') return res.status(400).json({ error: 'Invalid client' });
  }

  const all = await store.all('messages');
  const filtered = all
    .filter(m => Number(m.clientId) === Number(targetId))
    .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));

  res.json({ messages: filtered });
});

/* ---------------- POST /messages ---------------- */
router.post('/messages', auth, async (req, res) => {
  const rawText = clean(req.body?.text, 2000).trim();
  if (!rawText || rawText.length < 1) return res.status(400).json({ error: 'Message cannot be empty' });
  if (rawText.length > 2000) return res.status(400).json({ error: 'Message is too long' });

  let clientId;
  if (req.user.role === 'CLIENT') {
    clientId = req.user.id;
  } else {
    const cidRaw = req.body?.clientId;
    if (cidRaw == null || cidRaw === '') return res.status(400).json({ error: 'clientId is required' });
    clientId = Number(cidRaw);
    if (!Number.isFinite(clientId)) return res.status(400).json({ error: 'Invalid clientId' });
    const clientUser = await store.byId('users', clientId);
    if (!clientUser) return res.status(404).json({ error: 'Client not found' });
    if (clientUser.role !== 'CLIENT') return res.status(400).json({ error: 'Invalid client' });
  }

  const from = req.user.role === 'CLIENT' ? 'client' : 'staff';
  const msg = await store.insert('messages', {
    clientId,
    from,
    senderName: req.user.name,
    text: rawText,
    createdAt: new Date().toISOString(),
    readByClient: from === 'client',
    readByStaff: from === 'staff',
    readBy: from,
  });

  if (from === 'client') {
    // notify all staff via e-mail + in-app bell
    const users = await store.all('users');
    const staff = users.filter(u => u.role === 'ADMIN' || u.role === 'MANAGER');
    const timeStr = new Date(msg.createdAt).toLocaleString('en-US');
    const html = letterLayout('New support message', `
      <p style="color:#213532;font-size:14px;line-height:1.6;">Client <strong>${req.user.name}</strong> (${req.user.email}) sent a new support message at ${timeStr}:</p>
      <div style="margin:14px 0;padding:14px 16px;background:#F5F2E9;border:1px solid #E4DECB;border-radius:10px;color:#213532;font-size:14px;white-space:pre-wrap;">${rawText.replace(/</g,'&lt;')}</div>
    `);
    for (const s of staff) {
      if (!s.email) continue;
      sendMail({ to: s.email, subject: `New support message: ${req.user.name}`, html }).catch(() => undefined);
    }
    notify({
      audience: 'staff',
      kind: 'support',
      title: 'New support message',
      message: `${req.user.name}: ${rawText.slice(0, 80)}`,
      link: 'support',
    }).catch(() => undefined);
  } else {
    // push to the client (if they enabled browser push)
    pushToUser(clientId, { title: 'New message from support', body: rawText }).catch(() => undefined);
  }

  res.json({ ok: true, message: msg });
});

/* ---------------- POST /read ---------------- */
router.post('/read', auth, async (req, res) => {
  let clientId;
  if (req.user.role === 'CLIENT') {
    clientId = req.user.id;
  } else {
    const raw = req.body?.clientId;
    if (raw == null || raw === '') return res.status(400).json({ error: 'clientId is required' });
    clientId = Number(raw);
    if (!Number.isFinite(clientId)) return res.status(400).json({ error: 'Invalid clientId' });
  }

  const all = await store.all('messages');
  const toMark = all.filter(m => Number(m.clientId) === Number(clientId));

  let updated = 0;
  for (const m of toMark) {
    if (isStaff(req.user)) {
      // staff reads client messages
      if (m.from === 'client' && !m.readByStaff) {
        await store.update('messages', m.id, { readByStaff: true, readBy: m.readBy === 'client' ? 'both' : m.readBy || 'client' });
        // if already read by client (sender), mark both
        if (m.readByClient) await store.update('messages', m.id, { readBy: 'both' });
        updated++;
      }
    } else {
      // client reads staff messages
      if (m.from === 'staff' && !m.readByClient) {
        await store.update('messages', m.id, { readByClient: true, readBy: m.readBy === 'staff' ? 'both' : m.readBy || 'staff' });
        if (m.readByStaff) await store.update('messages', m.id, { readBy: 'both' });
        updated++;
      }
    }
  }

  res.json({ ok: true, updated });
});

/* ---------------- POST /presence (client ping) ---------------- */
router.post('/presence', auth, async (req, res) => {
  if (req.user.role !== 'CLIENT') return res.status(403).json({ error: 'Clients only' });
  await store.update('users', req.user.id, { lastSeen: Date.now() });
  res.json({ ok: true });
});

export default router;
