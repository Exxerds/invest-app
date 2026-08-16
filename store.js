// ============================================================
//  TradeNation platform API server
//  Start:   npm run dev   (from the project root — runs everything)
//  Port:    4000
//
//  NOTE: if the server crashes, the full error text is written
//  to server/server.log — open that file when reporting an issue.
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

// ---------- logging: console + server.log file ----------
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

// ---------- application ----------
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

// ---------- startup ----------
async function start() {
  try {
    await seedUsers();

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 TradeNation API server running: http://localhost:${PORT}\n`);
    });

    // Port already in use? Explain it clearly instead of crashing silently.
    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        console.error('\n=============================================================');
        console.error(`[server] ERROR: port ${PORT} is already in use.`);
        console.error('[server] Another copy of the API server is still running.');
        console.error('[server] Fix it:');
        console.error('[server]   Windows → open Task Manager and end all "Node.js" processes,');
        console.error('[server]             or run:  npx kill-port 4000');
        console.error('[server]   macOS/Linux → run:  npx kill-port 4000');
        console.error('[server] Then start again with «npm run dev».');
        console.error('=============================================================\n');
      } else {
        console.error('[server] Server error:', err);
      }
      process.exit(1);
    });
  } catch (err) {
    console.error('[server] Failed to start:', err);
    console.error('[server] Stack:', err && err.stack);
    process.exit(1);
  }
}

start();
