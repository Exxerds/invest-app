// ============================================================
//  KYC documents — upload, review, notifications.
//
//  Files are written to server/uploads/ and referenced by URL,
//  never kept inside data.json: base64 blobs would bloat the
//  database and slow every save down.
//
//  Endpoints
//    GET    /api/kyc/mine            client: own documents
//    POST   /api/kyc/upload          client: upload / replace a slot
//    GET    /api/kyc/all             staff: every submission
//    GET    /api/kyc/user/:userId    staff: one client's documents
//    POST   /api/kyc/:id/review      staff: approve / reject
//    GET    /api/kyc/file/:id        signed-in users: the image itself
// ============================================================
import express from 'express';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as store from '../db.js';
import { USE_PG } from '../db.js';
import { notify } from '../notifications.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads'); // server/uploads

/**
 * Serverless hosts (Vercel) have a read-only, throw-away filesystem, so the
 * scan itself is kept in the database next to its metadata. On a normal
 * server we still write real files — cheaper and easier to back up.
 */
const STORE_IN_DB = USE_PG;
if (!STORE_IN_DB) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const SLOTS = ['front', 'back', 'address'];
const MAX_BYTES = 8 * 1024 * 1024;
const MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

/** Authenticated user (any role) */
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

/** Admin or manager only */
function staffOnly(req, res, next) {
  if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') {
    return res.status(403).json({ error: 'Staff access only' });
  }
  next();
}

/** Strip the binary payload before sending a document to the browser */
function publicDoc(d) {
  // never ship the binary or the server path to the browser
  const { filePath, content, ...rest } = d;
  return { ...rest, fileUrl: `/api/kyc/file/${d.id}` };
}

/* ---------------- client ---------------- */

router.get('/mine', auth, async (req, res) => {
  const docs = await store.manyByField('kyc', 'userId', req.user.id);
  res.json({ documents: docs.map(publicDoc) });
});

router.post('/upload', auth, async (req, res) => {
  const { type, fileName, dataUrl } = req.body || {};

  if (!SLOTS.includes(type)) {
    return res.status(400).json({ error: 'Unknown document type' });
  }

  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
  if (!match) return res.status(400).json({ error: 'Invalid file payload' });

  const [, mime, b64] = match;
  const ext = MIME_EXT[mime];
  if (!ext) return res.status(415).json({ error: 'Upload a JPG, PNG, WEBP or PDF file' });

  const buffer = Buffer.from(b64, 'base64');
  if (buffer.length > MAX_BYTES) {
    return res.status(413).json({ error: 'File is too large — maximum 8 MB' });
  }

  // one active document per slot: drop the previous file and record
  const previous = await store.allWhere('kyc', (d) => d.userId === req.user.id && d.type === type);
  for (const old of previous) {
    try {
      if (old.filePath && fs.existsSync(old.filePath)) fs.unlinkSync(old.filePath);
    } catch {
      /* a stale file must not break the upload */
    }
  }
  await store.removeWhere('kyc', (d) => d.userId === req.user.id && d.type === type);

  const safeName = `${req.user.id}-${type}-${Date.now()}.${ext}`;
  let filePath = null;
  let content = null;

  if (STORE_IN_DB) {
    content = buffer.toString('base64'); // travels with the record
  } else {
    filePath = path.join(UPLOAD_DIR, safeName);
    fs.writeFileSync(filePath, buffer);
  }

  const doc = await store.insert('kyc', {
    userId: req.user.id,
    userName: req.user.name,
    userEmail: req.user.email,
    type,
    fileName: String(fileName || safeName).slice(0, 120),
    mime,
    size: buffer.length,
    filePath,
    content,
    status: 'pending',
    uploadedAt: new Date().toISOString(),
  });

  // tell the back office there is something to review
  await notify({
    audience: 'staff',
    kind: 'kyc_uploaded',
    title: 'New KYC document',
    message: `${req.user.name} uploaded "${labelFor(type)}" for review.`,
    userId: req.user.id,
    link: 'user-details',
  });

  res.json({ ok: true, document: publicDoc(doc) });
});

/* ---------------- staff ---------------- */

router.get('/all', auth, staffOnly, async (req, res) => {
  const docs = await store.all('kyc');
  res.json({ documents: docs.map(publicDoc) });
});

router.get('/user/:userId', auth, staffOnly, async (req, res) => {
  const id = Number(req.params.userId);
  const docs = await store.manyByField('kyc', 'userId', id);
  res.json({ documents: docs.map(publicDoc) });
});

router.post('/:id/review', auth, staffOnly, async (req, res) => {
  const id = Number(req.params.id);
  const { status, reason } = req.body || {};

  if (status !== 'approved' && status !== 'rejected') {
    return res.status(400).json({ error: 'Status must be approved or rejected' });
  }

  const doc = await store.update('kyc', id, {
    status,
    reviewedBy: req.user.name,
    reviewedAt: new Date().toISOString(),
    rejectReason: status === 'rejected' ? String(reason || '').slice(0, 300) : undefined,
  });
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  // tell the client what happened
  await notify({
    audience: 'client',
    userId: doc.userId,
    kind: status === 'approved' ? 'kyc_approved' : 'kyc_rejected',
    title: status === 'approved' ? 'Document approved' : 'Document rejected',
    message:
      status === 'approved'
        ? `Your "${labelFor(doc.type)}" has been verified.`
        : `Your "${labelFor(doc.type)}" was rejected. ${doc.rejectReason || ''}`.trim(),
    link: 'profile',
  });

  // all three approved → account fully verified
  const mine = await store.manyByField('kyc', 'userId', doc.userId);
  const approved = mine.filter((d) => d.status === 'approved').map((d) => d.type);
  if (SLOTS.every((s) => approved.includes(s))) {
    await notify({
      audience: 'client',
      userId: doc.userId,
      kind: 'kyc_complete',
      title: 'Identity verified',
      message: 'All documents approved — withdrawals are now available.',
      link: 'profile',
    });
    await notify({
      audience: 'staff',
      userId: doc.userId,
      kind: 'kyc_complete',
      title: 'Client fully verified',
      message: `${doc.userName} passed identity verification.`,
      link: 'user-details',
    });
  }

  res.json({ ok: true, document: publicDoc(doc) });
});

/* ---------------- file streaming ---------------- */

router.get('/file/:id', auth, async (req, res) => {
  const id = Number(req.params.id);
  const doc = await store.byId('kyc', id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  // clients may only look at their own scans
  const isStaff = req.user.role === 'ADMIN' || req.user.role === 'MANAGER';
  if (!isStaff && doc.userId !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  res.setHeader('Content-Type', doc.mime);
  res.setHeader('Cache-Control', 'private, max-age=60');

  if (doc.content) {
    return res.end(Buffer.from(doc.content, 'base64'));
  }
  if (doc.filePath && fs.existsSync(doc.filePath)) {
    return fs.createReadStream(doc.filePath).pipe(res);
  }
  res.status(410).json({ error: 'File is no longer stored' });
});

function labelFor(type) {
  return { front: 'Front of ID', back: 'Back of ID', address: 'Proof of Address' }[type] || type;
}

export default router;
