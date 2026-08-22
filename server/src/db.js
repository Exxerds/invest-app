// ============================================================
//  Storage layer with two interchangeable backends.
//
//    DATABASE_URL set  → PostgreSQL  (production / Vercel)
//    DATABASE_URL absent → JSON file (local development)
//
//  Both expose the SAME async API, so routes never care which
//  one is active. Locally you keep the zero-setup JSON file;
//  on Vercel the data lives in a real database that survives
//  every request (serverless has no persistent disk).
//
//  Tables are created automatically on first use.
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', 'data.json');

export const USE_PG = Boolean(process.env.DATABASE_URL);

/* ============================================================
   POSTGRES BACKEND
   ============================================================ */
/**
 * The pool and the schema flag are cached on globalThis, not in module scope.
 * Serverless keeps a warm instance alive between requests but may re-evaluate
 * modules; anchoring to the global object guarantees we reuse ONE pool instead
 * of opening a new connection per invocation (which is what exhausts Postgres
 * connection limits under load).
 */
const g = globalThis;
g.__ohyPool = g.__ohyPool || null;
g.__ohySchema = g.__ohySchema || null;

async function getPool() {
  if (!g.__ohyPool) {
    const { default: pg } = await import('pg');
    g.__ohyPool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      // Managed providers (Neon, Supabase, Vercel Postgres) require TLS
      ssl: process.env.PGSSL === 'off' ? false : { rejectUnauthorized: false },
      // Every serverless instance handles one request at a time, so a large
      // pool only wastes server-side connections. Neon's pooled endpoint
      // multiplexes for us.
      max: Number(process.env.PG_POOL_MAX || 2),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      keepAlive: true,
    });
    g.__ohyPool.on('error', (err) => console.error('[db] idle client error:', err.message));
  }
  return g.__ohyPool;
}

/**
 * One JSONB column per row keeps the schema identical to the JSON store,
 * so both backends behave the same and no migration is needed when the
 * shape of a record changes.
 */
const TABLES = ['users', 'tokens', 'kyc', 'notifications', 'trades', 'transactions', 'leads', 'settings', 'notes', 'messages', 'activity', 'calls', 'signals', 'pushSubs', 'investments'];

async function ensureSchema() {
  if (g.__ohySchema) return g.__ohySchema;
  g.__ohySchema = (async () => {
    const p = await getPool();
    for (const t of TABLES) {
      await p.query(`
        CREATE TABLE IF NOT EXISTS ${t} (
          id   SERIAL PRIMARY KEY,
          data JSONB NOT NULL
        )
      `);
    }
    // speed up the lookups we actually perform
    await p.query(`CREATE INDEX IF NOT EXISTS users_email_idx ON users ((data->>'email'))`);
    await p.query(`CREATE INDEX IF NOT EXISTS tokens_token_idx ON tokens ((data->>'token'))`);
    await p.query(`CREATE INDEX IF NOT EXISTS kyc_user_idx ON kyc (((data->>'userId')::int))`);
    await p.query(`CREATE INDEX IF NOT EXISTS trades_user_idx ON trades (((data->>'userId')::int))`);
    await p.query(`CREATE INDEX IF NOT EXISTS tx_user_idx ON transactions (((data->>'userId')::int))`);
    // generic expression indexes matching byField()/manyByField()
    await p.query(`CREATE INDEX IF NOT EXISTS trades_user_txt_idx ON trades ((data->>'userId'))`);
    await p.query(`CREATE INDEX IF NOT EXISTS tx_user_txt_idx ON transactions ((data->>'userId'))`);
    await p.query(`CREATE INDEX IF NOT EXISTS kyc_user_txt_idx ON kyc ((data->>'userId'))`);
    await p.query(`CREATE INDEX IF NOT EXISTS notif_user_idx ON notifications ((data->>'userId'))`);
    await p.query(`CREATE INDEX IF NOT EXISTS notif_audience_idx ON notifications ((data->>'audience'))`);
    await p.query(`CREATE INDEX IF NOT EXISTS notes_client_idx ON notes ((data->>'clientId'))`);
    await p.query(`CREATE INDEX IF NOT EXISTS msg_thread_idx ON messages ((data->>'threadId'))`);
    await p.query(`CREATE INDEX IF NOT EXISTS settings_key_idx ON settings ((data->>'key'))`);
    await p.query(`CREATE INDEX IF NOT EXISTS signals_call_idx ON signals ((data->>'callId'))`);
  })();
  return g.__ohySchema;
}

const pgStore = {
  async all(table) {
    await ensureSchema();
    const p = await getPool();
    const { rows } = await p.query(`SELECT id, data FROM ${table} ORDER BY id`);
    return rows.map(r => ({ ...r.data, id: r.id }));
  },

  async insert(table, row) {
    await ensureSchema();
    const p = await getPool();
    const { rows } = await p.query(`INSERT INTO ${table} (data) VALUES ($1) RETURNING id, data`, [row]);
    return { ...rows[0].data, id: rows[0].id };
  },

  async update(table, id, fields) {
    await ensureSchema();
    const p = await getPool();
    const { rows } = await p.query(
      `UPDATE ${table} SET data = data || $2::jsonb WHERE id = $1 RETURNING id, data`,
      [id, fields],
    );
    return rows[0] ? { ...rows[0].data, id: rows[0].id } : null;
  },

  async removeWhere(table, predicate) {
    const items = await this.all(table);
    const doomed = items.filter(predicate);
    if (!doomed.length) return 0;
    const p = await getPool();
    await p.query(`DELETE FROM ${table} WHERE id = ANY($1::int[])`, [doomed.map(d => d.id)]);
    return doomed.length;
  },

  /* ---- indexed lookups: these never load the whole table ---- */

  async byId(table, id) {
    await ensureSchema();
    const p = await getPool();
    const { rows } = await p.query(`SELECT id, data FROM ${table} WHERE id = $1`, [id]);
    return rows[0] ? { ...rows[0].data, id: rows[0].id } : undefined;
  },

  /** Exact match on a top-level JSON field, served by the matching index. */
  async byField(table, field, value) {
    await ensureSchema();
    const p = await getPool();
    const { rows } = await p.query(
      `SELECT id, data FROM ${table} WHERE data->>$1 = $2 ORDER BY id LIMIT 1`,
      [field, String(value)],
    );
    return rows[0] ? { ...rows[0].data, id: rows[0].id } : undefined;
  },

  async manyByField(table, field, value) {
    await ensureSchema();
    const p = await getPool();
    const { rows } = await p.query(
      `SELECT id, data FROM ${table} WHERE data->>$1 = $2 ORDER BY id`,
      [field, String(value)],
    );
    return rows.map(r => ({ ...r.data, id: r.id }));
  },
};

/* ============================================================
   JSON-FILE BACKEND (local development)
   ============================================================ */
let data = { users: [], tokens: [], kyc: [], notifications: [], trades: [], transactions: [], leads: [], settings: [], notes: [], messages: [], activity: [], calls: [], signals: [], pushSubs: [], investments: [], _seq: 1 };

function loadFile() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      if (parsed && typeof parsed === 'object') data = parsed;
    }
  } catch (e) {
    console.warn('[store] Could not read data.json — starting fresh:', e.message);
  }
  for (const t of TABLES) if (!Array.isArray(data[t])) data[t] = [];
  if (typeof data._seq !== 'number') data._seq = 1;
}

function saveFile() {
  try {
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, DATA_FILE);
  } catch (e) {
    console.warn('[store] Failed to save data.json:', e.message);
  }
}

const fileStore = {
  async all(table) {
    return data[table].slice();
  },
  async insert(table, row) {
    const rec = { id: data._seq++, ...row };
    data[table].push(rec);
    saveFile();
    return rec;
  },
  async update(table, id, fields) {
    const rec = data[table].find(r => r.id === id);
    if (!rec) return null;
    Object.assign(rec, fields);
    saveFile();
    return rec;
  },
  async removeWhere(table, predicate) {
    const before = data[table].length;
    data[table] = data[table].filter(r => !predicate(r));
    const deleted = before - data[table].length;
    if (deleted) saveFile();
    return deleted;
  },
  async byId(table, id) {
    return data[table].find(r => r.id === id);
  },
  async byField(table, field, value) {
    return data[table].find(r => String(r[field]) === String(value));
  },
  async manyByField(table, field, value) {
    return data[table].filter(r => String(r[field]) === String(value));
  },
};

if (!USE_PG) loadFile();

/* ============================================================
   PUBLIC API — identical for both backends
   ============================================================ */
const backend = USE_PG ? pgStore : fileStore;

export const all = (table) => backend.all(table);
export const insert = (table, row) => backend.insert(table, row);
export const update = (table, id, fields) => backend.update(table, id, fields);
export const removeWhere = (table, predicate) => backend.removeWhere(table, predicate);

/** Fetch a single row by primary key — one indexed query. */
export const byId = (table, id) => backend.byId(table, Number(id));

/**
 * Exact match on one field — one indexed query.
 * Use this instead of findOne() wherever the lookup is a plain equality,
 * otherwise the whole table travels over the wire on every request.
 */
export const byField = (table, field, value) => backend.byField(table, field, value);

/** All rows where `field` equals `value` — one indexed query. */
export const manyByField = (table, field, value) => backend.manyByField(table, field, value);

/**
 * Predicate scan. Loads the table, so it is only for genuinely ad-hoc
 * filters. Prefer byId / byField / manyByField on request paths.
 */
export async function findOne(table, predicate) {
  const rows = await backend.all(table);
  return rows.find(predicate);
}

export async function findBy(table, field, value) {
  if (field === 'id') return backend.byId(table, Number(value));
  return backend.byField(table, field, value);
}

export async function allWhere(table, predicate) {
  const rows = await backend.all(table);
  return rows.filter(predicate);
}

export async function updateWhere(table, predicate, fields) {
  const rows = await backend.all(table);
  const rec = rows.find(predicate);
  if (!rec) return null;
  return backend.update(table, rec.id, fields);
}

export function describeBackend() {
  return USE_PG ? 'PostgreSQL (persistent)' : 'JSON file server/data.json (local dev)';
}
