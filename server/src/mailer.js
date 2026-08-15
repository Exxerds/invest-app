// ============================================================
//  Отправка писем
//
//  Для разработки (без SMTP): письмо сохраняется в папку
//  server/mails/ и выводится в консоль — так вы всегда видите
//  ссылку, даже если SMTP ещё не настроен.
//
//  Для продакшена: укажите SMTP-настройки в server/.env
//  (подойдёт Яндекс.Почта, Mailgun, Brevo, SendGrid и т.п.)
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
 * Отправить письмо.
 * Если SMTP не настроен — сохраняет HTML в server/mails/ и логирует в консоль.
 */
export async function sendMail({ to, subject, html }) {
  if (transporter) {
    await transporter.sendMail({ from: FROM_EMAIL, to, subject, html });
    console.log(`[mail] Письмо "${subject}" отправлено на ${to}`);
    return;
  }

  // Режим разработки: письмо в файл + в консоль
  fs.mkdirSync(MAILS_DIR, { recursive: true });
  const fileName = `${Date.now()}-${to.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
  fs.writeFileSync(path.join(MAILS_DIR, fileName), html);
  console.log(`\n[mail] 💌 Письмо для ${to}: "${subject}"`);
  console.log(`[mail] Файл: server/mails/${fileName}`);
  // Ссылка из письма — отдельной строкой, чтобы было удобно копировать
  const links = [...html.matchAll(/https?:\/\/[^\s"<]+/g)].map(m => m[0]);
  if (links.length) {
    links.forEach(l => console.log(`[mail] 🔗 ${l}`));
  }
  console.log('');
}

/** Простой HTML-шаблон письма */
export function letterLayout(title, contentHtml) {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr><td style="background:#1d4ed8;padding:22px 28px;">
          <span style="color:#ffffff;font-size:20px;font-weight:bold;">Trade Nation</span>
        </td></tr>
        <tr><td style="padding:28px;">
          <h2 style="margin:0 0 12px;color:#0f172a;font-size:18px;">${title}</h2>
          ${contentHtml}
        </td></tr>
        <tr><td style="padding:16px 28px;background:#f8fafc;color:#64748b;font-size:12px;">
          Это письмо сгенерировано автоматически. Не отвечайте на него.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
