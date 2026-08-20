// ============================================================
//  Import a JSON backup created by export-json.js into the
//  Postgres pointed to by DATABASE_URL.
//
//  - Creates missing tables automatically (id SERIAL, data JSONB)
//  - Idempotent: rows are upserted, sequences are repaired
//
//  Run ON THE VPS:
//    cd /opt/oakhaven/server
//    DATABASE_URL='postgresql://ohy:PASSWORD@127.0.0.1:5432/oakhaven' \
//      PGSSL=off node scripts/import-json.js /home/oakhaven/backup.json
// ============================================================
import fs from 'node:fs';
import path from 'node:path';

const FILE = process.argv[2];
if (!FILE || !fs.existsSync(FILE)) {
  console.error('\n[import] Usage: node scripts/import-json.js <backup.json>');
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('\n[import] ERROR: DATABASE_URL is not set.');
  process.exit(1);
}

const ssl = process.env.PGSSL === 'off' ? false : { rejectUnauthorized: false };

const dump = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const tables = Object.entries(dump.tables || {});
if (tables.length === 0) {
  console.error('[import] The file contains no tables.');
  process.exit(1);
}

if (!/^(127\.0\.0\.1|localhost)/.test(new URL(url).hostname)) {
  console.warn(`\n[import] WARNING: target host is "${new URL(url).hostname}" — not localhost.`);
  console.warn('[import] Press Ctrl+C within 5 seconds if this is a mistake…\n');
  await new Promise((r) => setTimeout(r, 5000));
}

const VALID_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const { default: pg } = await import('pg');
const pool = new pg.Pool({ connectionString: url, ssl, max: 1 });

let client;
try {
  client = await pool.connect();
  console.log(`[import] Restoring ${path.basename(FILE)} (exported ${dump.exportedAt || '?'})…`);
  for (const [name, rows] of tables) {
    if (!VALID_NAME.test(name)) throw new Error(`Suspicious table name in backup: "${name}"`);
    await client.query(
      `CREATE TABLE IF NOT EXISTS "${name}" (id SERIAL PRIMARY KEY, data JSONB NOT NULL)`,
    );
    for (const row of rows) {
      await client.query(
        `INSERT INTO "${name}" (id, data) VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
        [row.id, row.data],
      );
    }
    // Repair the id sequence so new rows never collide with restored ids
    await client.query(
      `SELECT setval(pg_get_serial_sequence('"${name}"', 'id'),
                     GREATEST(COALESCE((SELECT MAX(id) FROM "${name}"), 0), 1))`,
    );
    console.log(`[import]   ${name.padEnd(16)} ${rows.length} rows restored`);
  }
  console.log('\n[import] Done. Restart the app:  sudo systemctl restart oakhaven');
} finally {
  client?.release();
  await pool.end();
}
