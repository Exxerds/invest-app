// ============================================================
//  Optional Telegram lead notifications.
//
//  Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in server/.env.
//  When either value is missing this module is a no-op, so the site
//  keeps working without Telegram.
// ============================================================

const token = () => String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
const chatId = () => String(process.env.TELEGRAM_CHAT_ID || '').trim();

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export async function sendTelegramMessage(text) {
  const botToken = token();
  const destination = chatId();
  if (!botToken || !destination) return { skipped: true };

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: destination,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Telegram returned HTTP ${response.status}`);
  }
  const result = await response.json().catch(() => ({}));
  if (!result.ok) throw new Error('Telegram rejected the message');
  return result;
}

export function sendTelegramLead({
  kind = 'New lead',
  name,
  email,
  phone,
  accountType,
  source,
  message,
}) {
  const lines = [
    `<b>${escapeHtml(kind)}</b>`,
    `<b>Name:</b> ${escapeHtml(name)}`,
    `<b>Email:</b> ${escapeHtml(email)}`,
    `<b>Phone:</b> ${escapeHtml(phone)}`,
  ];
  if (accountType) lines.push(`<b>Package:</b> ${escapeHtml(accountType)}`);
  if (source) lines.push(`<b>Source:</b> ${escapeHtml(source)}`);
  if (message) lines.push(`<b>Message:</b> ${escapeHtml(message)}`);
  return sendTelegramMessage(lines.join('\n'));
}
