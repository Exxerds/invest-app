// ============================================================
//  Calls: WebRTC signalling + call log (PDF p.4-5, video 2).
//
//  Serverless hosts cannot hold WebSockets open, so signalling is
//  done by polling a mailbox: each side posts its SDP/ICE data and
//  reads whatever the other side left. Slower to connect than a
//  socket (about a second) but works on Vercel without extra
//  infrastructure, and the audio itself is peer-to-peer either way.
//
//  Supported by the design:
//    * manager -> client audio call
//    * caller name chosen by the desk
//    * screen sharing (same peer connection, extra track)
//    * WHISPER mode: a supervisor joins, is heard by the manager
//      only, never by the client
//    * recording is done in the browser and uploaded here
//
//    POST /api/calls              start a call
//    GET  /api/calls/inbox        anything addressed to me
//    POST /api/calls/:id/signal   post SDP / ICE
//    GET  /api/calls/:id/signals  read the other side's data
//    POST /api/calls/:id/status   ringing → active → ended
//    GET  /api/calls/log          call history (staff)
//    POST /api/calls/:id/recording  store a recording
// ============================================================
import express from 'express';
import jwt from 'jsonwebtoken';
import * as store from '../db.js';
import { notify } from '../notifications.js';
import { logActivity } from './workspace.js';

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
        req.user = user;
    next();
  }

const isStaff = (u) => u.role === 'ADMIN' || u.role === 'MANAGER';
const clean = (v, max = 200) => String(v ?? '').slice(0, max);

/**
 * Self-healing: calls whose tab was closed (or that nobody answered)
 * would otherwise stay "ringing" / "active" in the database forever,
 * and the next time the client opened the cabinet a call that ended
 * minutes ago would pop up as "incoming" again.
 *
 *   ringing → nobody answered for 90 s   → ended (missed)
 *   active  → running longer than 2 h    → ended
 *
 * Every side polls /inbox (and staff reads /log), so stale records are
 * cleaned up on the next poll — no background timer needed, which also
 * works on serverless hosts where timers do not fire.
 */
const RINGING_TTL_MS = Number(process.env.CALL_RINGING_TTL_MS || 90_000);
const ACTIVE_TTL_MS = Number(process.env.CALL_ACTIVE_TTL_MS || 2 * 60 * 60_000);

async function expireStaleCalls() {
  const now = Date.now();
  for (const c of await store.all('calls')) {
    if (c.status === 'ringing') {
      if (now - new Date(c.startedAt).getTime() > RINGING_TTL_MS) {
        await store.update('calls', c.id, {
          status: 'ended',
          missed: true,
          endedAt: new Date().toISOString(),
          durationSec: 0,
          endedBy: 'system (missed)',
        });
        await store.removeWhere('signals', (s) => s.callId === c.id);
      }
    } else if (c.status === 'active') {
      const since = new Date(c.answeredAt || c.startedAt).getTime();
      if (now - since > ACTIVE_TTL_MS) {
        await store.update('calls', c.id, {
          status: 'ended',
          endedAt: new Date().toISOString(),
          durationSec: Math.round((now - since) / 1000),
          endedBy: 'system (timeout)',
        });
        await store.removeWhere('signals', (s) => s.callId === c.id);
      }
    }
  }
}

/** Public STUN servers are enough for most networks; TURN is optional. */
router.get('/ice-servers', auth, async (req, res) => {
  const servers = [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun.cloudflare.com:3478',
        'stun:stun.services.mozilla.com:3478',
      ],
    },
  ];

  // A TURN relay is needed behind strict corporate NATs
  if (process.env.TURN_URL && process.env.TURN_USER) {
    servers.push({
      urls: process.env.TURN_URL,
      username: process.env.TURN_USER,
      credential: process.env.TURN_PASS || '',
    });
  }

  res.json({ iceServers: servers });
});

/* ---------------- start ---------------- */

router.post('/', auth, async (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json({ error: 'Staff access only' });

  await expireStaleCalls();

  const clientId = Number(req.body?.clientId);
  const client = await store.byId('users', clientId);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  // One live call per client: clicking "Call" twice used to stack a second
  // ringing record on top of the first, and the client kept seeing the
  // incoming prompt again and again for a call that was already over.
  const existing = (await store.all('calls')).find(
    c => c.clientId === clientId && c.status !== 'ended',
  );
  if (existing) return res.status(409).json({ error: 'This client is already in a call.' });

  // The desk decides what name the client sees on the incoming call
  const callerName = clean(req.body?.callerName, 80) || 'Oak Haven Yield Support';

  const call = await store.insert('calls', {
    managerId: req.user.id,
    managerName: req.user.name,
    clientId,
    clientName: client.name,
    callerName,
    status: 'ringing',
    whisperBy: null,
    screenShare: false,
    recordingUrl: null,
    startedAt: new Date().toISOString(),
    answeredAt: null,
    endedAt: null,
    durationSec: 0,
  });

  await notify({
    audience: 'client',
    userId: clientId,
    kind: 'incoming_call',
    title: 'Incoming call',
    message: `${callerName} is calling you.`,
  });

  await logActivity({ actor: req.user, action: 'call_started', target: client.email, details: callerName });
  res.json({ ok: true, call });
});

/* ---------------- client asks to be called ---------------- */

router.post('/request', auth, async (req, res) => {
  if (req.user.role !== 'CLIENT') return res.status(403).json({ error: 'Clients only' });

  await notify({
    audience: 'staff',
    kind: 'call_request',
    title: 'Client wants a call',
    message: `${req.user.name} requested a call from the client cabinet.`,
  });

  await logActivity({ actor: req.user, action: 'call_requested', target: 'staff' });
  res.json({ ok: true });
});

/* ---------------- inbox ---------------- */

/** Anything ringing or active that concerns me. */
router.get('/inbox', auth, async (req, res) => {
  await expireStaleCalls();
  const all = await store.all('calls');
  const mine = all.filter(c => {
    if (c.status === 'ended') return false;
    if (c.clientId === req.user.id) return true;
    if (c.managerId === req.user.id) return true;
    // Staff (admin / manager) may see and join ANY live call as a whisper
    // coach. Previously only calls the user was already whispering on were
    // returned, so a supervisor standing by could never attach.
    return isStaff(req.user);
  });
  res.json({ calls: mine.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1)) });
});

/* ---------------- signalling ---------------- */

/**
 * Post an offer / answer / ICE candidate for the other participants.
 * `role` says who is speaking: manager, client or supervisor.
 */
router.post('/:id/signal', auth, async (req, res) => {
  const callId = Number(req.params.id);
  const call = await store.byId('calls', callId);
  if (!call) return res.status(404).json({ error: 'Call not found' });

  const allowed =
    call.clientId === req.user.id || call.managerId === req.user.id || isStaff(req.user);
  if (!allowed) return res.status(403).json({ error: 'Access denied' });

  const wantsWhisper = req.body?.channel === 'whisper';
  if (wantsWhisper && !isStaff(req.user)) {
    return res.status(403).json({ error: 'Staff access only' });
  }

  const signal = await store.insert('signals', {
    callId,
    from: req.user.id,
    /**
     * A three-way whisper needs two independent peer connections:
     *   main    — manager <-> client
     *   whisper — manager <-> supervisor
     * Keeping their SDP apart is what stops the client from ever
     * receiving the supervisor's audio.
     */
    channel: wantsWhisper ? 'whisper' : 'main',
    role: clean(req.body?.role, 20) || (isStaff(req.user) ? 'manager' : 'client'),
    kind: clean(req.body?.kind, 20),
    // SDP blobs are large; keep them as-is but bounded
    payload: String(req.body?.payload ?? '').slice(0, 200_000),
    createdAt: new Date().toISOString(),
  });

  res.json({ ok: true, id: signal.id });
});

/** Read everything posted by the OTHER participants since `after`. */
router.get('/:id/signals', auth, async (req, res) => {
  const callId = Number(req.params.id);
  const after = Number(req.query.after) || 0;

  const channel = req.query.channel === 'whisper' ? 'whisper' : 'main';

  /**
   * Hard guarantee, not just a UI convention: a client can never read the
   * whisper channel, so a supervisor's coaching cannot reach them even if
   * the request is crafted by hand.
   */
  const call = await store.byId('calls', callId);
  if (!call) return res.status(404).json({ error: 'Call not found' });
  if (channel === 'whisper' && !isStaff(req.user)) {
    return res.status(403).json({ error: 'Staff access only' });
  }

  const all = await store.manyByField('signals', 'callId', callId);
  const fresh = all
    .filter(s => s.id > after && s.from !== req.user.id && (s.channel || 'main') === channel)
    .sort((a, b) => a.id - b.id);

  res.json({ signals: fresh, lastId: fresh.length ? fresh[fresh.length - 1].id : after });
});

/* ---------------- status ---------------- */

router.post('/:id/status', auth, async (req, res) => {
  const callId = Number(req.params.id);
  const call = await store.byId('calls', callId);
  if (!call) return res.status(404).json({ error: 'Call not found' });

  const status = clean(req.body?.status, 20);
  const patch = {};

  if (status === 'active' && call.status !== 'active') {
    patch.status = 'active';
    patch.answeredAt = new Date().toISOString();
  } else if (status === 'ended') {
    patch.status = 'ended';
    patch.endedAt = new Date().toISOString();
    const started = new Date(call.answeredAt || call.startedAt).getTime();
    patch.durationSec = Math.max(0, Math.round((Date.now() - started) / 1000));
    patch.endedBy = req.user.name;
    // Signalling data is useless once the call is over
    await store.removeWhere('signals', s => s.callId === callId);
  } else if (status === 'declined') {
    patch.status = 'ended';
    patch.endedAt = new Date().toISOString();
    patch.declined = true;
  }

  if (req.body?.screenShare !== undefined) patch.screenShare = Boolean(req.body.screenShare);

  const updated = await store.update('calls', callId, patch);

  if (patch.status === 'ended') {
    await logActivity({
      actor: req.user,
      action: 'call_ended',
      target: call.clientName,
      details: `${updated.durationSec || 0}s`,
    });
  }

  res.json({ ok: true, call: updated });
});

/* ---------------- whisper (supervisor) ---------------- */

/**
 * Join a live call as a supervisor. The browser sends this audio only to
 * the manager's peer connection, so the client never hears it.
 */
router.post('/:id/whisper', auth, async (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json({ error: 'Staff access only' });

  const callId = Number(req.params.id);
  const call = await store.byId('calls', callId);
  if (!call) return res.status(404).json({ error: 'Call not found' });
  if (call.status === 'ended') return res.status(400).json({ error: 'Call has already ended' });

  const join = req.body?.join !== false;
  const updated = await store.update('calls', callId, {
    whisperBy: join ? req.user.id : null,
    whisperName: join ? req.user.name : null,
  });

  await logActivity({
    actor: req.user,
    action: join ? 'whisper_joined' : 'whisper_left',
    target: call.clientName,
  });

  res.json({ ok: true, call: updated });
});

/* ---------------- recording + log ---------------- */

router.post('/:id/recording', auth, async (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json({ error: 'Staff access only' });

  const callId = Number(req.params.id);
  const call = await store.byId('calls', callId);
  if (!call) return res.status(404).json({ error: 'Call not found' });

  // Stored as a data URL: no object storage needed for short clips
  const data = String(req.body?.data || '');
  if (!data.startsWith('data:')) return res.status(400).json({ error: 'Invalid recording' });
  if (data.length > 8_000_000) return res.status(413).json({ error: 'Recording is too large' });

  const updated = await store.update('calls', callId, {
    recordingUrl: data,
    recordedBy: req.user.name,
  });

  res.json({ ok: true, call: { id: updated.id, recordingUrl: 'stored' } });
});

router.get('/log', auth, async (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json({ error: 'Staff access only' });

  await expireStaleCalls();

  const all = await store.all('calls');
  const log = all
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
    .slice(0, 200)
    .map(c => ({
      id: c.id,
      managerName: c.managerName,
      clientName: c.clientName,
      callerName: c.callerName,
      status: c.status,
      declined: !!c.declined,
      missed: !!c.missed,
      whisperName: c.whisperName || null,
      screenShare: !!c.screenShare,
      hasRecording: !!c.recordingUrl,
      startedAt: c.startedAt,
      answeredAt: c.answeredAt,
      endedAt: c.endedAt,
      durationSec: c.durationSec || 0,
    }));

  const answered = log.filter(c => c.answeredAt).length;
  const missed = log.filter(c => !c.answeredAt && c.missed).length;
  const declined = log.filter(c => !!c.declined).length;
  res.json({
    calls: log,
    stats: {
      total: log.length,
      answered,
      missed,
      declined,
      active: log.filter(c => c.status === 'active').length,
      avgSec: answered
        ? Math.round(log.reduce((s, c) => s + c.durationSec, 0) / answered)
        : 0,
    },
  });
});

router.get('/:id/recording', auth, async (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json({ error: 'Staff access only' });
  const call = await store.byId('calls', Number(req.params.id));
  if (!call?.recordingUrl) return res.status(404).json({ error: 'No recording for this call' });
  res.json({ data: call.recordingUrl });
});

export default router;
