# Telegram notifications for leads

The server can send every new website lead and every successful registration
lead to one Telegram group. Without the two environment variables below the
integration stays disabled and does not affect the website.

## 1. Create the bot

1. In Telegram open `@BotFather`.
2. Send `/newbot`.
3. Choose a display name and a username ending in `bot`.
4. Copy the token once. Keep it secret; never commit it or send it in chat.

## 2. Add the bot to the group

Add the bot to the group's members. It only needs permission to send messages.
For the simplest chat-id lookup, send a message in the group after adding the
bot. If the bot cannot see the message, use `@BotFather` → `/setprivacy` →
choose the bot → `Disable`, then send another group message.

## 3. Find the group chat ID

From the VPS, temporarily set the token in a shell variable (do not paste the
command or its output into chat):

```bash
read -rsp 'Telegram bot token: ' TG_TOKEN; echo
curl -s "https://api.telegram.org/bot${TG_TOKEN}/getUpdates"
unset TG_TOKEN
```

Find the group's numeric `chat.id` in the JSON. Supergroups usually have an
ID beginning with `-100`.

## 4. Configure the app

Edit `/opt/oakhaven/server/.env` and add:

```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_group_chat_id
```

Do not include these values in screenshots or logs.

## 5. Restart

```bash
sudo systemctl restart oakhaven
sudo systemctl status oakhaven --no-pager
```

The bot receives:

- website contact-form leads;
- new registrations, including the selected package and phone number.

Telegram delivery is best-effort: a Telegram outage never prevents a lead or
account from being saved in the database.
