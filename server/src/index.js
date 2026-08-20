// ============================================================
//  Oak Haven Yield platform API server
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
import kycRoutes from './routes/kyc.js';
import notificationRoutes from './routes/notifications.js';
import symbolRoutes from './routes/symbols.js';
import tradeRoutes from './routes/trades.js';
import transactionRoutes from './routes/transactions.js';
import leadRoutes from './routes/leads.js';
import mailingRoutes from './routes/mailing.js';
import workspaceRoutes from './routes/workspace.js';
import callRoutes from './routes/calls.js';
import analyticsRoutes from './routes/analytics.js';
import pushRoutes from './routes/push.js';
import statementRoutes from './routes/statements.js';
import settingsRoutes from './routes/settings.js';
import supportRoutes from './routes/support.js';
import { seedUsers } from './seed.js';
import { describeConnection, probeConnection, USE_PG, describeBackend, ensureSchema } from './db.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_FILE = path.join(__dirname, '..', 'server.log');

// ---------- logging: console + server.log file ----------
// Serverless platforms have a read-only filesystem — there the console is
// the log (Vercel collects it automatically), so file logging is skipped.
const CAN_WRITE_LOG = !process.env.VERCEL;

function logToFile(...args) {
  if (!CAN_WRITE_LOG) return;
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
const IS_PROD = process.env.NODE_ENV === 'production';

// Behind nginx / a cloud load balancer we must trust the proxy so that
// req.ip and secure-cookie detection work correctly.
app.set('trust proxy', 1);

/**
 * CORS.
 * In development the Vite dev server proxies /api, so anything goes.
 * In production the API and the site are served from the SAME origin,
 * so no cross-origin calls are needed at all. If you ever host them on
 * different domains, list the allowed ones in CORS_ORIGIN (comma-separated).
 */
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!IS_PROD) return cb(null, true);
      if (!origin) return cb(null, true); // same-origin / curl / mobile app
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: '12mb' })); // KYC uploads travel as data-URLs

// ---------- request timeout middleware ----------
// If the DB is unreachable the handler would hang until Vercel returns 504.
// This cuts it early with a clear 503 so the client can retry.
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 20000);
app.use((req, res, next) => {
  // only for API routes
  if (!req.path.startsWith('/api/')) return next();
  let finished = false;
  res.on('finish', () => { finished = true; });
  res.on('close', () => { finished = true; });
  const timer = setTimeout(() => {
    if (!finished && !res.headersSent) {
      res.status(503).json({ error: 'The server could not reach its database in time. Please try again in a few seconds.' });
    }
  }, REQUEST_TIMEOUT_MS);
  // clear timer when response finishes
  const origEnd = res.end;
  res.end = function (...args) {
    clearTimeout(timer);
    return origEnd.apply(this, args);
  };
  next();
});

/**
 * Basic brute-force protection on the auth endpoints.
 * Dependency-free (pure JS) so it works on any host.
 * 20 attempts per IP per 15 minutes.
 */
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 20;

app.use('/api/auth', (req, res, next) => {
  // only throttle state-changing auth calls
  if (req.method !== 'POST') return next();

  const ip = req.ip || 'unknown';
  const now = Date.now();
  if (attempts.size > 500) sweepAttempts();
  const rec = attempts.get(ip);

  if (!rec || now - rec.start > WINDOW_MS) {
    attempts.set(ip, { start: now, count: 1 });
    return next();
  }

  rec.count += 1;
  if (rec.count > MAX_ATTEMPTS) {
    return res.status(429).json({ error: 'Too many attempts. Please try again in a few minutes.' });
  }
  next();
});

// Trim old entries lazily instead of using a timer: serverless instances are
// frozen between requests, so setInterval would never fire reliably there.
function sweepAttempts() {
  const now = Date.now();
  for (const [ip, rec] of attempts) if (now - rec.start > WINDOW_MS) attempts.delete(ip);
}

// ---------- health checks ----------
let seedStatus = 'pending';
let seedPromise = null;
async function ensureSeeded() {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    try {
      if (USE_PG) {
        await ensureSchema();
      }
      await seedUsers();
      seedStatus = 'ready';
    } catch (e) {
      seedStatus = `failed: ${e.message || String(e)}`;
      // allow retry on next request
      seedPromise = null;
      throw e;
    }
    return seedStatus;
  })();
  return seedPromise;
}

app.get('/api/health', async (req, res) => {
  let seed = seedStatus;
  // try to seed if not ready, but don't fail the health endpoint entirely
  if (seed !== 'ready') {
    try {
      await ensureSeeded();
      seed = seedStatus;
    } catch (e) {
      seed = `failed: ${e.message || String(e)}`;
    }
  }
  res.json({
    ok: true,
    time: new Date().toISOString(),
    backend: describeBackend(),
    persistent: USE_PG,
    seed,
    db: describeConnection(),
  });
});

app.get('/api/health/db', async (req, res) => {
  const db = describeConnection();
  // fast probe first — if DB is down we answer immediately with hint
  const probe = await probeConnection(6000);
  if (!probe.ok) {
    const pooled = db.pooled;
    const isNeon = db.host && db.host.includes('neon.tech');
    let hint = null;
    if (isNeon && !pooled) {
      hint = 'Host is direct Neon endpoint without -pooler. Use pooled connection string (add -pooler to hostname) or set PG_CONNECT_TIMEOUT_MS higher.';
    } else if (!pooled && isNeon) {
      hint = 'Ensure DATABASE_URL uses pooled endpoint (-pooler) for serverless.';
    } else if (!USE_PG) {
      hint = 'No DATABASE_URL configured — using JSON file (local dev).';
    } else {
      hint = 'Database is waking up or unreachable — retry in a few seconds. If host ends with .neon.tech without -pooler, switch to pooled host.';
    }
    return res.status(503).json({
      ok: false,
      error: probe.error,
      code: probe.code,
      ms: probe.ms,
      db,
      hint,
      persistent: USE_PG,
      seed: seedStatus,
    });
  }
  // probe ok — now ensure seeded
  let seed = seedStatus;
  try {
    await ensureSeeded();
    seed = seedStatus;
  } catch (e) {
    return res.status(503).json({
      ok: false,
      error: e.message || String(e),
      code: e.code || null,
      ms: probe.ms,
      db,
      hint: 'Seeding failed after DB became reachable',
      persistent: USE_PG,
      seed: `failed: ${e.message || String(e)}`,
    });
  }
  res.json({
    ok: true,
    ms: probe.ms,
    db: { ...db, database: probe.db || db.database },
    persistent: USE_PG,
    seed,
  });
});

/**
 * PRODUCTION: serve the built front-end from the same origin.
 *
 * After `npm run build` the site lands in /dist. Serving it here means the
 * browser calls /api/... on the very same domain — no CORS, no proxy, no
 * hard-coded API URL. This is what makes login and registration work once
 * the project is deployed.
 */
const DIST_DIR = path.join(__dirname, '..', '..', 'dist');
const HAS_BUILD = fs.existsSync(path.join(DIST_DIR, 'index.html'));

if (HAS_BUILD) {
  app.use(
    express.static(DIST_DIR, {
      // hashed assets can be cached hard; index.html must never be cached
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-store');
        else res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }),
  );
}

/**
 * Dev helper: opening the API port directly shows a friendly page instead of
 * Express's bare "Cannot GET /".
 */
app.get('/', (req, res, next) => {
  if (HAS_BUILD) return next(); // production: static index.html handles it
  res.type('html').send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8\"><title>Oak Haven Yield API</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#0a0b0e;color:#e2e8f0;font-family:system-ui,Segoe UI,Arial,sans-serif}
  .card{max-width:520px;padding:36px;background:#14161c;border:1px solid rgba(255,255,255,.08);
        border-radius:16px;text-align:center}
  .dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;margin-right:8px}
  h1{margin:0 0 6px;font-size:20px;color:#f5b400}
  p{margin:10px 0;font-size:14px;color:#94a3b8;line-height:1.6}
  a{display:inline-block;margin-top:18px;padding:12px 26px;background:#f5b400;color:#17190f;
    border-radius:10px;text-decoration:none;font-weight:700;font-size:14px}
  code{background:#0f1116;padding:2px 7px;border-radius:5px;color:#cbd5e1;font-size:13px}
</style></head>
<body><div class="card">
  <h1>Oak Haven Yield API</h1>
  <p><span class="dot"></span>Server is running on port ${PORT}</p>
  <p>This address serves data only — there is no website here.<br>
     The website runs on <code>http://localhost:3000</code></p>
  <a href="http://localhost:3000">Open the website</a>
</div></body></html>`);
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/symbols', symbolRoutes);
app.use('/api/trades', tradeRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/mailing', mailingRoutes);
app.use('/api/workspace', workspaceRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/statements', statementRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/support', supportRoutes);

// Unknown API route → JSON 404 (never fall through to the SPA)
app.use('/api', (req, res) => res.status(404).json({ error: 'Unknown API endpoint' }));

/**
 * SPA fallback: every non-API path returns index.html so that deep links like
 * /reset-password?token=... or /confirm-email work after a page refresh.
 * Without this the server would answer 404 on a hard reload.
 */
if (HAS_BUILD) {
  app.get(/.*/, (req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));
}

app.use((err, req, res, next) => {
  console.error(err);
  const status = /CORS/.test(err?.message || '') ? 403 : 500;
  res.status(status).json({ error: status === 403 ? 'Origin not allowed' : 'Internal server error' });
});

// ---------- startup ----------
async function start() {
  try {
    // Refuse to run in production with the default signing key
    if (IS_PROD && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret-change-me')) {
      console.error('\n=============================================================');
      console.error('[server] REFUSING TO START: JWT_SECRET is not set.');
      console.error('[server] Anyone could forge admin tokens with the default key.');
      console.error('[server] Generate one and put it in server/.env:');
      console.error('[server]   node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
      console.error('=============================================================\n');
      process.exit(1);
    }

    await ensureSeeded().catch(err => {
      console.warn('[server] Initial seed failed (will retry on health check):', err.message);
    });

    // '::' accepts both IPv6 (::1) and IPv4 (127.0.0.1) on all platforms
    const server = app.listen(PORT, '::', () => {
      console.log(`\n🚀 Oak Haven Yield API server running: http://localhost:${PORT}`);
      console.log(HAS_BUILD
        ? `   Serving the built site from /dist — open http://localhost:${PORT}\n`
        : `   Development mode — the site runs separately on http://localhost:3000\n`);
    });

    // Port already in use? Explain it clearly instead of crashing silently.
    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        console.error('\n=============================================================');
        console.error(`[server] ERROR: port ${PORT} is already in use.`);
        console.error('[server] Another copy of the API server is still running.');
        console.error('[server] Fix it:');
        console.error('[server]   Windows → open Task Manager and end all \"Node.js\" processes,');
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

// On Vercel the platform imports `app` and handles the HTTP layer itself;
// a long-running listener would never start there.
if (!process.env.VERCEL) {
  start();
}

export default app;
