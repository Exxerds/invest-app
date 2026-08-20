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

/** Branded HTML e-mail layout (Oak Haven Yield: cream / forest green / warm gold) */
export function letterLayout(title, contentHtml) {
  // SITE_URL fallback https://oakhavenyield.com as required — always absolute so the image loads on any client
  const base = (SITE_URL || 'https://oakhavenyield.com').replace(/\/$/, '') || 'https://oakhavenyield.com';
  const logoSvg = `${base}/logo.svg`;
  const logoPng = `${base}/logo.png`;
  return `<!DOCTYPE html>
<html lang="en"><body style="margin:0;padding:0;background:#F5F2E9;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F2E9;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e0d2;border-radius:14px;overflow:hidden;">
        <tr><td style="background:#1C412C;padding:20px 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr>
            <td style="vertical-align:middle;padding-right:12px;">
              <!-- cream circle like on the sidebar, so dark logo stays visible on dark header on every client -->
              <div style="width:42px;height:42px;background:#F5F2E9;border-radius:50%;text-align:center;line-height:42px;display:inline-block;overflow:hidden;">
                <picture style="display:inline-block;vertical-align:middle;line-height:0;">
                  <source srcset="${logoSvg}" type="image/svg+xml">
                  <img src="${logoPng}" width="34" height="41" alt="Oak Haven Yield" style="display:block;width:34px;height:41px;max-width:34px;vertical-align:middle;border:0;outline:none;margin:0 auto;">
                </picture>
              </div>
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
