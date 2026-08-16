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

    await sendMail({
      to: user.email,
      subject: 'Confirm your email',
      html: letterLayout('Email confirmation', `
        <p style="color:#cbd5e1;font-size:14px;line-height:1.6;">
          Hello, <strong>${user.name}</strong>!<br>
          You registered on the TradeNation platform.
          Confirm your email to activate the account:
        </p>
        <p style="text-align:center;margin:24px 0;">
          <a href="${link}" style="background:#f5b400;color:#17190f;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:14px;">
            Confirm email
          </a>
        </p>
        <p style="color:#64748b;font-size:12px;">The link is valid for 1 hour. If you didn't register — ignore this email.</p>
      `)
    });

    res.json({ ok: true, message: 'Account created. Check your email — we sent a confirmation link.' });
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
      subject: 'Password reset',
      html: letterLayout('Password reset', `
        <p style="color:#cbd5e1;font-size:14px;line-height:1.6;">
          Hello, <strong>${user.name}</strong>!<br>
          We received a password reset request. Click the button below to set a new password:
        </p>
        <p style="text-align:center;margin:24px 0;">
          <a href="${link}" style="background:#f5b400;color:#17190f;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:14px;">
            Reset password
          </a>
        </p>
        <p style="color:#64748b;font-size:12px;">The link is valid for 1 hour. If you didn't request it — ignore this email.</p>
      `)
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

export default router;
