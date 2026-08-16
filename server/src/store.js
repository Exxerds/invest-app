// ============================================================
//  JSON-file data store (NO database engine).
//
//  Rationale: better-sqlite3 and sql.js fail to build on some
//  Windows setups. A JSON file is pure JavaScript and works
//  everywhere with no native compilation and no WASM.
//
//  File: server/data.json (created automatically)
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', 'data.json');

let data = { users: [], tokens: [], kyc: [], notifications: [], _seq: 1 };

function load() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      if (parsed && typeof parsed === 'object') data = parsed;
    }
  } catch (e) {
    console.warn('[store] Could not read data.json — creating a fresh database:', e.message);
  }
  if (!Array.isArray(data.users)) data.users = [];
  if (!Array.isArray(data.tokens)) data.tokens = [];
  if (!Array.isArray(data.kyc)) data.kyc = [];
  if (!Array.isArray(data.notifications)) data.notifications = [];
  if (typeof data._seq !== 'number') data._seq = 1;
}

function save() {
  try {
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, DATA_FILE);
  } catch (e) {
    console.warn('[store] Failed to save data.json:', e.message);
  }
}

/** Every record with a given field value */
export function allWhere(table, predicate) {
  return data[table].filter(predicate);
}

/** Remove records matching the predicate; returns how many were deleted */
export function removeWhere(table, predicate) {
  const before = data[table].length;
  data[table] = data[table].filter((r) => !predicate(r));
  const deleted = before - data[table].length;
  if (deleted) save();
  return deleted;
}

/** Insert a record and return it with its id */
export function insert(table, row) {
  const rec = { id: data._seq++, ...row };
  data[table].push(rec);
  save();
  return rec;
}

/** Find a single record by predicate */
export function findOne(table, predicate) {
  return data[table].find(predicate);
}

/** Find a single record by field = value */
export function findBy(table, field, value) {
  return data[table].find((r) => r[field] === value);
}

/** All records (shallow copy) */
export function all(table) {
  return data[table].slice();
}

/** Update a record by id; returns the record or null */
export function update(table, id, fields) {
  const rec = data[table].find((r) => r.id === id);
  if (!rec) return null;
  Object.assign(rec, fields);
  save();
  return rec;
}

/** Update the first record matching the predicate */
export function updateWhere(table, predicate, fields) {
  const rec = data[table].find(predicate);
  if (!rec) return null;
  Object.assign(rec, fields);
  save();
  return rec;
}

load();
