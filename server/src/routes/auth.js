// ============================================================
//  Authentication: registration, login, e-mail confirmation,
//  password reset (via e-mail link)
//  Storage: PostgreSQL in production, JSON file locally (see db.js)
// ============================================================
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import * as store from '../db.js';
import { sendMail, letterLayout, publicUrl } from '../mailer.js';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// ---------- helpers ----------

async function createToken(userId, type) {
  const token = crypto.randomBytes(32).toString('hex');
  await store.insert('tokens', {
    user_id: userId,
    type,
    token,
    expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
    used: 0
  });
  return token;
}

async function findValidToken(token, type) {
  const now = new Date().toISOString();
  return store.findOne(
    'tokens',
    (t) => t.token === token && t.type === type && t.used === 0 && t.expires_at > now
  );
}

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, status: u.status };
}

function signJwt(u) {
  return jwt.sign({ userId: u.id, role: u.role }, JWT_SECRET, { expiresIn: '7d' });
}

const BTN = 'background:#B08B48;color:#ffffff;padding:13px 30px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;display:inline-block;';
const P = 'color:#213532;font-size:14px;line-height:1.65;margin:0 0 12px;';
const SMALL = 'color:#7a8a82;font-size:12px;line-height:1.6;';

function confirmLetter(user, link) {
  return letterLayout('Confirm your email address', `
    <p style="${P}">Hello, <strong>${user.name}</strong>,</p>
    <p style="${P}">
      Thank you for creating an account with <strong style="color:#1C412C;">Oak Haven Yield</strong>.
      Please confirm your email address to activate your account and access your client portal.
    </p>
    <p style="text-align:center;margin:26px 0;">
      <a href="${link}" style="${BTN}">Confirm my email</a>
    </p>
    <p style="${SMALL}">
      Or paste this link into your browser:<br>
      <a href="${link}" style="color:#B08B48;word-break:break-all;">${link}</a>
    </p>
    <p style="${SMALL}">This link is valid for 1 hour and can be used once. If you did not create this account, you can safely ignore this message.</p>
  `);
}

function resetLetter(user, link) {
  return letterLayout('Reset your password', `
    <p style="${P}">Hello, <strong>${user.name}</strong>,</p>
    <p style="${P}">We received a request to reset the password for your Oak Haven Yield account. Click the button below to choose a new one.</p>
    <p style="text-align:center;margin:26px 0;">
      <a href="${link}" style="${BTN}">Reset my password</a>
    </p>
    <p style="${SMALL}">
      Or paste this link into your browser:<br>
      <a href="${link}" style="color:#B08B48;word-break:break-all;">${link}</a>
    </p>
    <p style="${SMALL}">This link is valid for 1 hour and can be used once. If you did not request a password reset, no action is needed.</p>
  `);
}

// ------------------------------------------------------------
//  REGISTRATION
// ------------------------------------------------------------
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Fill in name, email and password' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const lower = String(email).toLowerCase().trim();
    if (await store.findBy('users', 'email', lower)) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    const hash = await bcrypt.hash(String(password), 10);
    const user = await store.insert('users', {
      name: String(name).trim(),
      email: lower,
      password: hash,
      role: 'CLIENT',
      status: 'pending',
      created_at: new Date().toISOString()
    });

    const token = await createToken(user.id, 'confirm_email');
    const link = `${publicUrl(req)}/confirm-email?token=${token}`;

    // The account already exists at this point. If the mail provider is down
    // we must NOT return an error — that would tell the visitor registration
    // failed while their account is actually there.
    let mailSent = true;
    await sendMail({
      to: user.email,
      subject: 'Confirm your email — Oak Haven Yield',
      html: confirmLetter(user, link)
    }).catch(err => {
      mailSent = false;
      console.error('[register] Could not send the confirmation e-mail:', err.message);
    });

    res.json({
      ok: true,
      emailSent: mailSent,
      email: user.email,
      message: mailSent
        ? 'Account created. Check your email — we sent a confirmation link.'
        : 'Account created, but the confirmation e-mail could not be sent. Please contact support to activate it.',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ------------------------------------------------------------
//  E-MAIL CONFIRMATION
// ------------------------------------------------------------
router.post('/confirm-email', async (req, res) => {
  const { token } = req.body || {};
  const t = await findValidToken(token, 'confirm_email');
  if (!t) return res.status(400).json({ error: 'Link is invalid or expired' });

  await store.update('tokens', t.id, { used: 1 });
  const user = await store.update('users', t.user_id, { status: 'active' });
  if (!user) return res.status(400).json({ error: 'User not found' });

  res.json({ ok: true, token: signJwt(user), user: publicUser(user) });
});

// ------------------------------------------------------------
//  LOGIN
// ------------------------------------------------------------
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = await store.findBy('users', 'email', String(email || '').toLowerCase().trim());

  if (!user || !(await bcrypt.compare(String(password || ''), user.password))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (user.status === 'pending') {
    return res.status(403).json({ error: 'Account is not activated. Confirm your email via the link in the letter.' });
  }
  if (user.status === 'blocked') {
    return res.status(403).json({ error: 'Account is blocked. Contact support.' });
  }

  res.json({ ok: true, token: signJwt(user), user: publicUser(user) });
});

// ------------------------------------------------------------
//  CURRENT USER
// ------------------------------------------------------------
router.get('/me', async (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authorized' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await store.findBy('users', 'id', payload.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    res.json({ user: publicUser(user) });
  } catch {
    res.status(401).json({ error: 'Session expired, sign in again' });
  }
});

// ------------------------------------------------------------
//  FORGOT PASSWORD
// ------------------------------------------------------------
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  const user = await store.findBy('users', 'email', String(email || '').toLowerCase().trim());

  if (user) {
    const token = await createToken(user.id, 'reset_password');
    const link = `${publicUrl(req)}/reset-password?token=${token}`;
    await sendMail({
      to: user.email,
      subject: 'Reset your password — Oak Haven Yield',
      html: resetLetter(user, link)
    }).catch(err => {
      // Never leak mail-server problems to the visitor
      console.error('[reset] Could not send the reset e-mail:', err.message);
    });
  }

  res.json({ ok: true, message: 'If such email is registered — we sent a password reset link.' });
});

// ------------------------------------------------------------
//  SET A NEW PASSWORD
// ------------------------------------------------------------
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const t = await findValidToken(token, 'reset_password');
  if (!t) return res.status(400).json({ error: 'Link is invalid or expired' });

  await store.update('tokens', t.id, { used: 1 });
  const hash = await bcrypt.hash(String(newPassword), 10);
  await store.update('users', t.user_id, { password: hash });

  res.json({ ok: true, message: 'Password updated. Now you can sign in.' });
});

// ------------------------------------------------------------
//  RESEND THE CONFIRMATION E-MAIL
// ------------------------------------------------------------
router.post('/resend-confirmation', async (req, res) => {
  const { email } = req.body || {};
  const user = await store.findBy('users', 'email', String(email || '').toLowerCase().trim());

  if (user && user.status === 'pending') {
    const token = await createToken(user.id, 'confirm_email');
    const link = `${publicUrl(req)}/confirm-email?token=${token}`;
    await sendMail({
      to: user.email,
      subject: 'Confirm your email — Oak Haven Yield',
      html: confirmLetter(user, link)
    }).catch(err => console.error('[resend] Could not send the confirmation e-mail:', err.message));
  }

  // Never reveal whether the address exists
  res.json({ ok: true, message: 'If the account exists and is not confirmed yet, a new link is on its way.' });
});

export default router;
