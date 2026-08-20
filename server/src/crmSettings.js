// ============================================================
//  CRM settings — persisted in settings table, cached in memory
//  to avoid hitting DB on every trade close/patch.
//  Cache TTL 15s, invalidated on write.
// ============================================================
import * as store from './db.js';

const g = globalThis;
g.__ohyCrmSettings = g.__ohyCrmSettings || { value: null, expires: 0 };

const DEFAULTS = {
  hidePhonesFromAgents: false,
  manualClosing: false,
  duplicateControl: true,
  callRecording: true,
};

/**
 * Read CRM settings with 15s cache (globalThis, survives serverless warm).
 */
export async function readCrmSettings() {
  const now = Date.now();
  if (g.__ohyCrmSettings.value && g.__ohyCrmSettings.expires > now) {
    return g.__ohyCrmSettings.value;
  }
  try {
    const rec = await store.byField('settings', 'key', 'crmSettings');
    const val = { ...DEFAULTS, ...(rec?.value || {}) };
    g.__ohyCrmSettings = { value: val, expires: now + 15_000 };
    return val;
  } catch {
    // on DB error return defaults but don't cache long
    return { ...DEFAULTS };
  }
}

/**
 * Save CRM settings (merge with existing) and invalidate cache.
 */
export async function writeCrmSettings(patch, actorName) {
  // fetch fresh (bypass cache) by directly reading DB
  let current;
  try {
    const rec = await store.byField('settings', 'key', 'crmSettings');
    current = { ...DEFAULTS, ...(rec?.value || {}) };
  } catch {
    current = { ...DEFAULTS };
  }
  const next = { ...current, ...patch };
  const rec = await store.byField('settings', 'key', 'crmSettings').catch(() => null);
  const payload = { value: next, updatedBy: actorName || 'system', updatedAt: new Date().toISOString() };
  if (rec) await store.update('settings', rec.id, payload);
  else await store.insert('settings', { key: 'crmSettings', ...payload });
  // refresh cache
  g.__ohyCrmSettings = { value: next, expires: Date.now() + 15_000 };
  return next;
}

export function invalidateCrmSettingsCache() {
  g.__ohyCrmSettings = { value: null, expires: 0 };
}
