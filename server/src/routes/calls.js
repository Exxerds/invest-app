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

const isStaff = (u) => u.role === 'ADMIN' || u.role === 'MANAGER';
const clean = (v, max = 200) => String(v ?? '').slice(0, max);

/** Public STUN servers are enough for most networks; TURN is optional. */
router.get('/ice-servers', auth, async (req, res) => {
  const servers = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
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

  const clientId = Number(req.body?.clientId);
  const client = await store.byId('users', clientId);
  if (!client) return res.status(404).json({ error: 'Client not found' });

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

/* ---------------- inbox ---------------- */

/** Anything ringing or active that concerns me. */
router.get('/inbox', auth, async (req, res) => {
  const all = await store.all('calls');
  const mine = all.filter(c => {
    if (c.status === 'ended') return false;
    if (c.clientId === req.user.id) return true;
    if (c.managerId === req.user.id) return true;
    // A supervisor may attach to any live call
    return isStaff(req.user) && c.whisperBy === req.user.id;
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

  const signal = await store.insert('signals', {
    callId,
    from: req.user.id,
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

  const all = await store.manyByField('signals', 'callId', callId);
  const fresh = all
    .filter(s => s.id > after && s.from !== req.user.id)
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
      whisperName: c.whisperName || null,
      screenShare: !!c.screenShare,
      hasRecording: !!c.recordingUrl,
      startedAt: c.startedAt,
      answeredAt: c.answeredAt,
      endedAt: c.endedAt,
      durationSec: c.durationSec || 0,
    }));

  const answered = log.filter(c => c.answeredAt).length;
  res.json({
    calls: log,
    stats: {
      total: log.length,
      answered,
      missed: log.length - answered,
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
