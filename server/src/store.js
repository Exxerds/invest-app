// ============================================================
//  Хранилище данных на JSON-файле (БЕЗ СУБД).
//
//  Почему так: лучше-sqlite3 и sql.js на некоторых Windows
//  установках не запускаются. JSON-файл — чистый JavaScript,
//  работает абсолютно везде, без компиляции и WASM.
//
//  Файл: server/data.json (создаётся автоматически)
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', 'data.json');

let data = { users: [], tokens: [], _seq: 1 };

function load() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      if (parsed && typeof parsed === 'object') data = parsed;
    }
  } catch (e) {
    console.warn('[store] Не удалось прочитать data.json — создаю новую базу:', e.message);
  }
  if (!Array.isArray(data.users)) data.users = [];
  if (!Array.isArray(data.tokens)) data.tokens = [];
  if (typeof data._seq !== 'number') data._seq = 1;
}

function save() {
  try {
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, DATA_FILE);
  } catch (e) {
    console.warn('[store] Ошибка сохранения data.json:', e.message);
  }
}

/** Вставить запись, вернуть её с id */
export function insert(table, row) {
  const rec = { id: data._seq++, ...row };
  data[table].push(rec);
  save();
  return rec;
}

/** Найти одну запись по условию */
export function findOne(table, predicate) {
  return data[table].find(predicate);
}

/** Найти одну запись по полю = значение */
export function findBy(table, field, value) {
  return data[table].find((r) => r[field] === value);
}

/** Все записи (копия) */
export function all(table) {
  return data[table].slice();
}

/** Обновить запись по id, вернуть её или null */
export function update(table, id, fields) {
  const rec = data[table].find((r) => r.id === id);
  if (!rec) return null;
  Object.assign(rec, fields);
  save();
  return rec;
}

/** Обновить первую запись, подходящую под условие */
export function updateWhere(table, predicate, fields) {
  const rec = data[table].find(predicate);
  if (!rec) return null;
  Object.assign(rec, fields);
  save();
  return rec;
}

load();
