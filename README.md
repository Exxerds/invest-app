# 🏛 Trade Nation — Инвестиционная платформа + CRM (Web, без APK)

Готовый проект по материалам PDF-презентации и видео клиента:
**лендинг + Legal + Контакты → регистрация/вход → личный кабинет клиента → CRM с управлением балансом и трейдами.**

> ⚡ Одна команда запускает всё: сайт + API сервер + базу данных.

---

## 📁 Структура проекта

```
invest-app/
├── server/                  ← БЭКЕНД (Node.js + Express + SQLite)
│   ├── src/
│   │   ├── index.js         ← точка входа API (порт 4000)
│   │   ├── db.js            ← база данных (SQLite, файл data.db)
│   │   ├── mailer.js        ← отправка писем (SMTP или папка mails/)
│   │   └── routes/
│   │       └── auth.js      ← регистрация, логин, подтверждение email, сброс пароля
│   ├── .env.example         ← шаблон настроек (скопировать в .env)
│   └── package.json
│
├── src/                     ← ФРОНТЕНД (React + TypeScript + Tailwind)
│   ├── App.tsx              ← главный компонент (навигация, состояние)
│   ├── api.ts               ← связь фронтенда с сервером
│   ├── types.ts             ← типы данных
│   ├── data/mockData.ts     ← демо-данные (проекты, клиенты, лиды)
│   └── components/
│       ├── Header.tsx
│       ├── landing/         ← лендинг (Главная, Legal, Контакты)
│       ├── investor/        ← личный кабинет клиента
│       ├── catalog/         ← витрина активов (BTC, ETH, XAU, EUR/USD...)
│       ├── crm/             ← CRM/админка (трейды, баланс, лиды, KYC)
│       └── modals/          ← окна: вход, регистрация, забыли пароль и др.
│
├── vite.config.ts           ← настройка Vite (прокси /api → :4000)
└── package.json             ← скрипты запуска
```

---

## 🚀 Как запустить у себя (VS Code)

### Шаг 1. Установите Node.js
Скачайте LTS-версию с https://nodejs.org и установите (просто «Далее»).
Проверка: откройте **терминал** и выполните:
```bash
node -v
npm -v
```
Должны показаться версии (например v22.x.x и 10.x.x).

### Шаг 2. Откройте проект в VS Code
`File → Open Folder…` → выберите папку **invest-app**.

### Шаг 3. Установите зависимости
В VS Code откройте терминал (`Ctrl + ~`) и выполните:
```bash
npm install
```
Это установит всё: и сайт, и сервер (один раз, при первом запуске).

### Шаг 4. Запустите проект
```bash
npm run dev
```
Одна команда запускает **два процесса**:
- 🌐 Сайт: http://localhost:3000
- ⚙️ API сервер: http://localhost:4000

Откройте браузер: **http://localhost:3000**

> Если что-то упало — посмотрите вывод в терминале, там будет ошибка.
> Остановить проект: `Ctrl + C` в терминале.

---

## 🔐 Как это работает (регистрация → оплата → вход)

1. Клиент нажимает **«Войти в кабинет»** → **«Зарегистрироваться»**.
2. Указывает имя, email, пароль → аккаунт создаётся в базе (статус `pending`).
3. На почту приходит письмо со ссылкой подтверждения.
4. Клиент переходит по ссылке → email подтверждён, статус `active`.
   *(В продакшене вместо «подтверждения email» можно ставить статус `active` после оплаты — это правка одной строки в CRM/платёжке.)*
5. Клиент входит с лендинга → попадает в личный кабинет.
6. Забыл пароль → «Забыли пароль?» → письмо со ссылкой → новый пароль.

### Где посмотреть «письма» без SMTP?
В режиме разработки письма **не отправляются по почте**, а сохраняются в папку
`server/mails/` и выводятся в консоль (там же печатается ссылка).
Откройте любой `.html` из этой папки — увидите письмо целиком.

### Как включить реальную отправку писем
1. В папке `server/` скопируйте `.env.example` → переименуйте в **`.env`**.
2. Заполните SMTP (подойдут Яндекс.Почта для домена, Mailgun, Brevo, SendGrid...):
```env
SMTP_HOST=smtp.yourmail.ru
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=no-reply@yourdomain.ru
SMTP_PASS=ваш-пароль
SMTP_FROM=Trade Nation <no-reply@yourdomain.ru>
```
3. Обязательно поменяйте `JWT_SECRET` на длинную случайную строку.
4. Перезапустите `npm run dev` — письма пойдут по-настоящему.

---

## 🛠 Частые правки

| Что поменять | Где |
|---|---|
| Название компании/логотип | `src/components/Header.tsx`, `src/components/landing/LandingPage.tsx` |
| Тексты лендинга, Legal, Контакты | `src/components/landing/` |
| Активы на витрине (BTC, ETH, XAU, EUR/USD) | `src/data/mockData.ts` |
| Демо-данные клиентов/лидов | `src/data/mockData.ts` |
| База данных (файл) | `server/data.db` (создаётся сама) |
| API-эндпоинты | `server/src/routes/auth.js` |

**Быстрый вход в демо:** в окне входа есть кнопка «Демо» — входит без сервера, удобно для показа клиенту.

---

## 🗄 База данных

Используется **SQLite** (файл `server/data.db`, ничего устанавливать не нужно).
Таблицы:
- `users` — пользователи (name, email, password-хеш, role: CLIENT/MANAGER/ADMIN, status: pending/active/blocked)
- `tokens` — токены подтверждения email и сброса пароля

Для продакшена переходим на **PostgreSQL** — запросы почти не меняются (тот же SQL).

---

## 📌 Что дальше (по PDF и видео)

- [x] Лендинг + Legal + Контакты
- [x] Регистрация / вход / выход / JWT-токен
- [x] Подтверждение email + сброс пароля письмом
- [x] Личный кабинет клиента (баланс, портфель, сделки)
- [x] CRM: управление трейдами и балансом, лиды (канбан), клиенты/KYC, ввод-вывод, активы, аналитика
- [ ] Звонки менеджер-клиент (WebRTC), демонстрация экрана, режим суфлера
- [ ] Создание аккаунта клиента админом в CRM (после оплаты)
- [ ] Отчёт PDF для клиента (выписка)
- [ ] Чаты/тикеты поддержки
- [ ] Пуш-уведомления

---

## ⚙️ Технологии

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS 4
- **Backend:** Node.js + Express
- **DB:** SQLite (→ PostgreSQL в проде)
- **Auth:** JWT + bcrypt, письма через nodemailer
- **Real-time (дальше):** WebSockets (Socket.io) + WebRTC для звонков и демонстрации экрана

## 📊 Meta Pixel (Facebook)

Пиксель уже подключён: он загружается автоматически и шлёт события
`PageView`, `Lead` (заявка с лендинга) и `CompleteRegistration` (регистрация).

Чтобы включить свой пиксель:

1. Открой **Meta Events Manager → свой пиксель → Settings** и скопируй **Pixel ID** (число).
2. Создай файл `.env.local` в корне проекта и пропиши:
   ```bash
   VITE_META_PIXEL_ID=1234567890123456
   ```
3. Перезапусти `npm run dev` (или перезалей на Vercel, указав переменную `VITE_META_PIXEL_ID`
   в **Project → Settings → Environment Variables**).

Если `VITE_META_PIXEL_ID` пуст — пиксель не загружается вовсе (удобно для локальной разработки).

## 📞 Звонки (WebRTC)

Звонки работают по WebRTC (аудио идёт напрямую между устройствами, обмен сигналами — через API).

- **Кнопка «Enable sound»** в плавающем окне звонка — теперь рабочая: браузеры (особенно Chrome)
  блокируют автовоспроизведение звука до клика пользователя. Один клик по ней включает звук
  собеседника. Это тот же механизм, что и системная кнопка «Enable sound», но она **всегда срабатывает**.
- **TURN-сервер** добавлен по умолчанию (бесплатный Open Relay). Он нужен для звонков через
  симметричные NAT — мобильные сети, офисы, VPN, где STUN сам по себе не соединяет два устройства.
  Благодаря этому звонки работают компьютер → телефон → компьютер → телефон.
- Для продакшена можно подставить собственный TURN в `server/.env`:
  ```
  TURN_URL=turn:turn.example.com:443?transport=tcp
  TURN_USER=your-user
  TURN_PASS=your-pass
  ```

## Troubleshooting

### "Cannot GET /" when opening http://localhost:4000
That is **not an error**. Port 4000 is the API — it serves data, not pages.
The website lives on **http://localhost:3000**. Opening the API root now shows
a page with a link to the site.

### "502" / "The API server is not running" when creating an account
The website (port 3000) is running but the API server (port 4000) is not.
`npm run dev` must start **both**. Check the terminal for the line:

```
TradeNation API server running: http://localhost:4000
```

If it is missing:

1. **Port already in use** — the most common case on Windows:
   ```bash
   npx kill-port 3000 4000
   npm run dev
   ```
   (or close every "Node.js" process in Task Manager)

2. **Dependencies missing** — reinstall and start again:
   ```bash
   npm install
   npm run dev
   ```

3. **Windows + IPv6 (fixed in this build)** — `localhost` resolves to IPv6 `::1`
   on Windows, while the API used to listen on IPv4 only, so the proxy could not
   reach it. The dev proxy now targets `127.0.0.1` explicitly and the server
   listens on both stacks. If you edited these files, keep those settings.

`npm run dev` runs an automatic pre-flight check that installs anything missing
and tells you if a port is occupied, so in most cases it fixes itself.
