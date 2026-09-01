// ============================================================
//  Telegram lead browser.
//
//  This is an optional long-polling worker for the VPS deployment.
//  It adds an inline menu to the bot so an authorised chat can page
//  through the CRM leads without exposing the database publicly.
//
//  Enable explicitly with TELEGRAM_BOT_POLLING=on.
// ============================================================
import * as store from './db.js';

const PAGE_SIZE = 4;
let started = false;
let offset = 0;

function botToken() {
  return String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
}

function allowedIds() {
  const raw = process.env.TELEGRAM_LEAD_VIEWER_IDS || process.env.TELEGRAM_CHAT_IDS || process.env.TELEGRAM_CHAT_ID || '';
  return new Set(raw.split(',').map(value => value.trim()).filter(Boolean));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function canView(chatId, fromId) {
  const allowed = allowedIds();
  if (!allowed.size) return false;
  return allowed.has(String(chatId)) || allowed.has(String(fromId));
}

async function telegram(method, body = {}) {
  const token = botToken();
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    throw new Error(`Telegram ${method} failed (${response.status})`);
  }
  return result.result;
}

function menuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '📋 Лиды', callback_data: 'leads:0' }],
      [{ text: '🔄 Обновить', callback_data: 'menu' }],
    ],
  };
}

async function menu(chatId, messageId) {
  const text = '<b>Oak Haven Yield CRM</b>\n\nВыберите действие:';
  if (messageId) {
    return telegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      reply_markup: menuKeyboard(),
    });
  }
  return telegram('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    reply_markup: menuKeyboard(),
  });
}

function leadText(lead, index) {
  const lines = [
    `<b>${index}. ${escapeHtml(lead.name || 'Без имени')}</b>`,
    `Статус: ${escapeHtml(lead.stage || 'new')}`,
    `Телефон: ${escapeHtml(lead.phone || '—')}`,
    `E-mail: ${escapeHtml(lead.email || '—')}`,
  ];
  if (lead.accountType) lines.push(`Пакет: ${escapeHtml(lead.accountType)}`);
  if (Number(lead.potentialAmount) > 0) lines.push(`Потенциал: $${Number(lead.potentialAmount).toLocaleString('en-US')}`);
  if (lead.source) lines.push(`Источник: ${escapeHtml(lead.source)}`);
  return lines.join('\n');
}

async function leadsPage(chatId, messageId, page) {
  const all = (await store.all('leads')).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const rows = all.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const first = safePage * PAGE_SIZE;

  const text = rows.length
    ? `<b>Лиды — страница ${safePage + 1}/${totalPages}</b>\nВсего: ${all.length}\n\n${rows.map((lead, i) => leadText(lead, first + i + 1)).join('\n\n')}`
    : '<b>Лиды</b>\n\nПока лидов нет.';

  const navigation = [];
  if (safePage > 0) navigation.push({ text: '◀️ Назад', callback_data: `leads:${safePage - 1}` });
  if (safePage < totalPages - 1) navigation.push({ text: 'Вперёд ▶️', callback_data: `leads:${safePage + 1}` });
  const keyboard = { inline_keyboard: [] };
  if (navigation.length) keyboard.inline_keyboard.push(navigation);
  keyboard.inline_keyboard.push([{ text: '🏠 Меню', callback_data: 'menu' }, { text: '🔄 Обновить', callback_data: `leads:${safePage}` }]);

  return telegram('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: text.slice(0, 3900),
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

async function handleUpdate(update) {
  const message = update.message;
  const callback = update.callback_query;
  const chat = message?.chat || callback?.message?.chat;
  const from = message?.from || callback?.from;
  if (!chat || !from) return;

  if (!canView(chat.id, from.id)) {
    if (message?.chat?.id) {
      await telegram('sendMessage', {
        chat_id: chat.id,
        text: 'Доступ к просмотру лидов не разрешён для этого чата.',
      });
    }
    if (callback?.id) await telegram('answerCallbackQuery', { callback_query_id: callback.id, text: 'Нет доступа' });
    return;
  }

  if (callback) {
    await telegram('answerCallbackQuery', { callback_query_id: callback.id });
    const data = String(callback.data || '');
    if (data === 'menu') return menu(chat.id, callback.message.message_id);
    if (data.startsWith('leads:')) {
      const page = Number(data.split(':')[1]);
      return leadsPage(chat.id, callback.message.message_id, Number.isFinite(page) ? page : 0);
    }
    return;
  }

  const command = String(message.text || '').split(/\s+/, 1)[0].toLowerCase();
  if (command === '/start' || command === '/menu' || command === '/leads') {
    return menu(chat.id);
  }
}

async function poll() {
  while (started) {
    try {
      const updates = await telegram('getUpdates', { offset, timeout: 25, limit: 50 });
      for (const update of updates) {
        offset = Math.max(offset, update.update_id + 1);
        await handleUpdate(update);
      }
    } catch (err) {
      console.error('[telegram-bot] polling error:', err.message);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}

export async function startTelegramBot() {
  if (started || process.env.VERCEL || process.env.TELEGRAM_BOT_POLLING !== 'on') return;
  if (!botToken() || !allowedIds().size) {
    console.warn('[telegram-bot] polling disabled: set TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID or TELEGRAM_LEAD_VIEWER_IDS');
    return;
  }

  // Remove a previous webhook so long polling can receive commands.
  await telegram('deleteWebhook', { drop_pending_updates: false }).catch(() => undefined);
  // Add Telegram's native command menu as well as the inline buttons. This
  // makes the lead browser discoverable without requiring the user to know
  // the /menu command first.
  await telegram('setMyCommands', {
    commands: [
      { command: 'start', description: 'Open the CRM menu' },
      { command: 'menu', description: 'Open the CRM menu' },
      { command: 'leads', description: 'Browse CRM leads' },
    ],
  }).catch(err => console.error('[telegram-bot] could not set commands:', err.message));
  await telegram('setChatMenuButton', {
    menu_button: { type: 'commands' },
  }).catch(err => console.error('[telegram-bot] could not set menu button:', err.message));
  started = true;
  console.log('[telegram-bot] lead menu polling enabled');
  void poll();
}
