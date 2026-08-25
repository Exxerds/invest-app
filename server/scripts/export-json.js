// ============================================================
//  Export EVERY table from the DATABASE_URL Postgres (Neon)
//  into a single JSON file. Version-proof alternative to
//  pg_dump — works with any client/server version pair.
//
//  Run (any machine with network access to the DB):
//    cd server
//    DATABASE_URL='postgresql://user:pass@host/db?sslmode=require' \
//      node scripts/export-json.js backup.json
//
//  For your own VPS Postgres add:  PGSSL=off
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TARGET = process.argv[2]
  || path.join(__dirname, `backup-${new Date().toISOString().slice(0, 10)}.json`);

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('\n[export] ERROR: DATABASE_URL is not set.');
  console.error("[export] Example:  DATABASE_URL='postgresql://...' node scripts/export-json.js backup.json\n");
  process.exit(1);
}

const ssl = process.env.PGSSL === 'off' ? false : { rejectUnauthorized: false };

const { default: pg } = await import('pg');
const pool = new pg.Pool({ connectionString: url, ssl, max: 1, connectionTimeoutMillis: 15000 });

try {
  console.log('[export] Connecting…');
  const { rows: tables } = await pool.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`,
  );
  if (tables.length === 0) {
    console.error('[export] Connected, but the database has NO tables. Wrong DATABASE_URL?');
    process.exit(1);
  }

  const out = { exportedAt: new Date().toISOString(), tables: {} };
  for (const { table_name } of tables) {
    const { rows } = await pool.query(`SELECT id, data FROM "${table_name}" ORDER BY id`);
    out.tables[table_name] = rows;
    console.log(`[export]   ${table_name.padEnd(16)} ${rows.length} rows`);
  }

  fs.writeFileSync(TARGET, JSON.stringify(out));
  const size = (fs.statSync(TARGET).size / 1024 / 1024).toFixed(2);
  console.log(`\n[export] Done → ${TARGET} (${size} MB)`);
} finally {
  await pool.end();
}
