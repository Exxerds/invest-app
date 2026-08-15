// ============================================================
//  Сервер платформы TradeNation
//  Запуск:  npm run dev   (в корне проекта — запускает всё)
//  Порт:    4000
//
//  ВАЖНО: если сервер падает — полный текст ошибки пишется
//  в файл server/server.log. Откройте его и покажите разработчику.
// ============================================================
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import { seedUsers } from './seed.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_FILE = path.join(__dirname, '..', 'server.log');

// ---------- логирование: консоль + файл server.log ----------
function logToFile(...args) {
  try {
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ` + args.map(String).join(' ') + '\n');
  } catch {
    /* ignore */
  }
}
['log', 'warn', 'error'].forEach((m) => {
  const orig = console[m];
  console[m] = (...args) => {
    logToFile(...args);
    orig(...args);
  };
});
process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught exception:', err);
  console.error('[server] Stack:', err && err.stack);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled rejection:', reason);
});

// ---------- приложение ----------
const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// ---------- старт ----------
async function start() {
  try {
    await seedUsers();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 TradeNation API server running: http://localhost:${PORT}\n`);
    });
  } catch (err) {
    console.error('[server] Failed to start:', err);
    console.error('[server] Stack:', err && err.stack);
    process.exit(1);
  }
}

// Порт занят? Покажем понятную ошибку
app.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`[server] Port ${PORT} is already in use.`);
    console.error('[server] Close the other process or change PORT in server/.env, then restart.');
  } else {
    console.error('[server] Server error:', err);
  }
});

start();
