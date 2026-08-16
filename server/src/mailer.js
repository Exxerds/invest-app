// ============================================================
//  Transactional e-mail sending.
//
//  Development (no SMTP): the letter is written to server/mails/
//  and logged to the console, so the link is always visible.
//
//  Production: set the SMTP credentials in server/.env
//  (Mailgun, Brevo, SendGrid, Amazon SES, Postmark, etc.)
// ============================================================
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAILS_DIR = path.join(__dirname, '..', 'mails');

const hasSmtp = Boolean(process.env.SMTP_HOST);

const transporter = hasSmtp
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_SECURE ?? 'true') === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  : null;

export const FROM_EMAIL = process.env.SMTP_FROM || 'no-reply@tradenation.io';
export const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';

/**
 * Public address used in e-mail links.
 * Falls back to the host the request actually came from, so confirmation and
 * password-reset links keep working after deployment even if SITE_URL is unset.
 */
export function publicUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  if (req) {
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host');
    if (host) return `${proto}://${host}`;
  }
  return SITE_URL;
}

/**
 * Send an e-mail.
 * Without SMTP configured it stores the HTML in server/mails/ and logs it.
 */
export async function sendMail({ to, subject, html }) {
  if (transporter) {
    await transporter.sendMail({ from: FROM_EMAIL, to, subject, html });
    console.log(`[mail] "${subject}" sent to ${to}`);
    return;
  }

  // ---- No SMTP configured ----
  // Log the letter so the link is always recoverable.
  console.log(`\n[mail] Letter for ${to}: "${subject}"`);
  const links = [...html.matchAll(/https?:\/\/[^\s"<]+/g)].map(m => m[0]);
  links.forEach(l => console.log(`[mail] LINK ${l}`));

  // Saving a copy only works where the filesystem is writable.
  // Serverless hosts (Vercel) are read-only — attempting it there used to
  // crash registration with "Server error", so it is skipped entirely.
  if (!process.env.VERCEL) {
    try {
      fs.mkdirSync(MAILS_DIR, { recursive: true });
      const fileName = `${Date.now()}-${to.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
      fs.writeFileSync(path.join(MAILS_DIR, fileName), html);
      console.log(`[mail] File: server/mails/${fileName}`);
    } catch (err) {
      console.warn('[mail] Could not save a copy of the letter:', err.message);
    }
  }
  console.log('');
}

/** Basic HTML e-mail layout (dark + gold brand styling) */
export function letterLayout(title, contentHtml) {
  return `<!DOCTYPE html>
<html lang="en"><body style="margin:0;padding:0;background:#0a0b0e;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0b0e;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#14161c;border:1px solid rgba(255,255,255,.08);border-radius:16px;overflow:hidden;">
        <tr><td style="background:#0f1116;padding:22px 28px;border-bottom:1px solid rgba(255,255,255,.08);">
          <span style="color:#f5b400;font-size:20px;font-weight:bold;">TradeNation</span>
        </td></tr>
        <tr><td style="padding:28px;">
          <h2 style="margin:0 0 12px;color:#ffffff;font-size:18px;">${title}</h2>
          ${contentHtml}
        </td></tr>
        <tr><td style="padding:16px 28px;background:#0f1116;color:#64748b;font-size:12px;border-top:1px solid rgba(255,255,255,.08);">
          This message was generated automatically — please do not reply to it.<br>
          &copy; ${new Date().getFullYear()} TradeNation. All rights reserved.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
