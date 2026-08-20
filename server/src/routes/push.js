// ============================================================
//  Web push notifications (PDF p.3).
//
//  Browsers deliver push through their own services (FCM, APNs,
//  Mozilla), so all we store is the subscription each browser
//  hands us. Messages are signed with a VAPID key pair.
//
//  Set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY to enable it. Without
//  them the endpoints answer honestly that push is off rather
//  than pretending to send.
//
//    GET  /api/push/key          public key for the browser
//    POST /api/push/subscribe    store this browser's subscription
//    POST /api/push/unsubscribe  forget it
//    POST /api/push/send         staff: push to one client
// ============================================================
import express from 'express';
import jwt from 'jsonwebtoken';
import webpush from 'web-push';
import * as store from '../db.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const CONTACT = process.env.VAPID_CONTACT || 'mailto:support@oakhavenyield.com';

const enabled = Boolean(PUBLIC_KEY && PRIVATE_KEY);
if (enabled) {
  webpush.setVapidDetails(CONTACT, PUBLIC_KEY, PRIVATE_KEY);
} else {
  console.log('[push] VAPID keys are not set — web push is disabled (in-app notifications still work)');
}

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
        req.user = user;
    next();
  }

const isStaff = (u) => u.role === 'ADMIN' || u.role === 'MANAGER';

router.get('/key', async (req, res) => {
  res.json({ enabled, publicKey: PUBLIC_KEY });
});

router.post('/subscribe', auth, async (req, res) => {
  const sub = req.body?.subscription;
  if (!sub?.endpoint) return res.status(400).json({ error: 'Invalid subscription' });

  // One row per browser; re-subscribing replaces the old record
  const existing = await store.findOne('pushSubs', s => s.endpoint === sub.endpoint);
  if (existing) {
    await store.update('pushSubs', existing.id, {
      userId: req.user.id,
      keys: sub.keys,
      updatedAt: new Date().toISOString(),
    });
  } else {
    await store.insert('pushSubs', {
      userId: req.user.id,
      endpoint: sub.endpoint,
      keys: sub.keys,
      createdAt: new Date().toISOString(),
    });
  }

  res.json({ ok: true, enabled });
});

router.post('/unsubscribe', auth, async (req, res) => {
  const endpoint = String(req.body?.endpoint || '');
  const removed = await store.removeWhere('pushSubs', s => s.endpoint === endpoint);
  res.json({ ok: true, removed });
});

/**
 * Deliver a push to every browser a user has registered.
 * Dead subscriptions (410/404) are pruned as we go.
 */
export async function pushToUser(userId, { title, body, url }) {
  if (!enabled) return { sent: 0, disabled: true };

  const subs = await store.manyByField('pushSubs', 'userId', userId);
  if (!subs.length) return { sent: 0 };

  const payload = JSON.stringify({ title, body, url: url || '/' });
  let sent = 0;

  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload);
      sent += 1;
    } catch (err) {
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        await store.removeWhere('pushSubs', x => x.id === s.id);
      }
    }
  }

  return { sent };
}

router.post('/send', auth, async (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json({ error: 'Staff access only' });

  const userId = Number(req.body?.userId);
  const title = String(req.body?.title || 'Oak Haven Yield').slice(0, 120);
  const body = String(req.body?.body || '').slice(0, 300);
  if (!userId) return res.status(400).json({ error: 'Client is required' });
  if (!body) return res.status(400).json({ error: 'Message is required' });

  if (!enabled) {
    return res.status(503).json({
      error: 'Web push is not configured on the server. The client will still see it in the app.',
    });
  }

  const result = await pushToUser(userId, { title, body, url: '/' });
  res.json({
    ok: true,
    ...result,
    message: result.sent
      ? `Delivered to ${result.sent} device(s).`
      : 'This client has not enabled browser notifications yet.',
  });
});

export default router;
