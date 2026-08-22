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
import { execFileSync } from 'node:child_process';
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

export const FROM_EMAIL = process.env.SMTP_FROM || 'Oak Haven Yield <no-reply@oakhavenyield.com>';
export const SITE_URL = process.env.SITE_URL || 'https://oakhavenyield.com';

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
/**
 * Send an e-mail. WITHOUT SMTP the letter is NOT delivered — it is logged
 * and (on normal hosts) saved to server/mails/. Returns TRUE only when the
 * letter actually went out through the mail provider.
 */
const CREST_SRC = [
  path.join(__dirname, '..', '..', 'public', 'brand-crest.png'),
  path.join(__dirname, '..', 'public', 'brand-crest.png'),
  '/opt/oakhaven/public/brand-crest.png',
].find(p => fs.existsSync(p));

const CREST_CID = 'oakhaven-crest';
let crestPng = null;

function loadCrestPng() {
  if (crestPng) return crestPng;
  if (!CREST_SRC) return null;
  try {
    crestPng = execFileSync('convert', [
      CREST_SRC,
      '-trim', '+repage',
      '-resize', '200x200',
      '-gravity', 'center',
      '-background', '#F5F2E9',
      '-extent', '200x200',
      'png:-',
    ]);
  } catch {
    try { crestPng = fs.readFileSync(CREST_SRC); } catch { crestPng = null; }
  }
  return crestPng;
}

export async function sendMail({ to, subject, html }) {
  if (transporter) {
    const png = loadCrestPng();
    await transporter.sendMail({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      attachments: png
        ? [{ filename: 'crest.png', content: png, cid: CREST_CID, contentType: 'image/png' }]
        : [],
    });
    console.log(`[mail] "${subject}" sent to ${to}`);
    return true;
  }

  // ---- No SMTP configured ----
  console.warn(`[mail] ⚠ SMTP is NOT configured — the letter for ${to} ("${subject}") was NOT delivered!`);
  console.warn('[mail] Fix: fill SMTP_HOST/SMTP_USER/SMTP_PASS in server/.env and restart the service.');
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
  return false; // not delivered — no SMTP transporter
}

/** Branded HTML e-mail layout (Oak Haven Yield: cream / forest green / warm gold) */
export function letterLayout(title, contentHtml) {
  return `<!DOCTYPE html>
<html lang="en"><body style="margin:0;padding:0;background:#F5F2E9;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F2E9;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e0d2;border-radius:14px;overflow:hidden;">
        <tr><td style="background:#1C412C;padding:22px 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;padding-right:16px;">
              <img src="cid:${CREST_CID}" width="96" height="96" alt="Oak Haven Yield" style="display:block;width:96px;height:96px;border:0;border-radius:48px;background:#F5F2E9;">
            </td>
            <td style="vertical-align:middle;">
              <div style="line-height:1.1;">
                <span style="color:#F5F2E9;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:bold;">Oak Haven</span>
                <span style="color:#B08B48;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:bold;font-style:italic;"> Yield</span>
              </div>
              <div style="color:#cfd8d2;font-size:11px;letter-spacing:2px;margin-top:2px;font-family:Arial,Helvetica,sans-serif;">Investment Advisory</div>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="height:3px;background:#B08B48;"></td></tr>
        <tr><td style="padding:28px;font-family:Arial,Helvetica,sans-serif;">
          <h2 style="margin:0 0 12px;color:#1C412C;font-size:19px;">${title}</h2>
          ${contentHtml}
        </td></tr>
        <tr><td style="padding:18px 28px;background:#F5F2E9;color:#6b7a72;font-size:12px;border-top:1px solid #e5e0d2;font-family:Arial,Helvetica,sans-serif;">
          Oak Haven Yield &middot; 300 Delaware Ave, Wilmington, DE 19801, USA<br>
          This message was generated automatically &mdash; please do not reply to it.<br>
          &copy; 2010 Oak Haven Yield. All rights reserved.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
