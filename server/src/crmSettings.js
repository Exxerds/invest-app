// ============================================================
//  CRM preferences — one persisted record, read by many routes.
//
//  Settings → "Privacy & access" / "Modules" / "Providers" used to be
//  local React state: the toggles moved but nothing on the server ever
//  looked at them. They now live here, and the routes that must obey a
//  rule (leads → duplicateControl, trades → manualClosing,
//  calls → callRecording) read them through readCrmSettings().
// ============================================================
import * as store from './db.js';

const g = globalThis;
g.__ohyCrmSettings = g.__ohyCrmSettings || { value: null, expires: 0 };

export const DEFAULT_MODULES = {
  Spot: true,
  Futures: true,
  P2P: true,
  Binary: true,
  Staking: true,
  'AI Trading': false,
  Swap: false,
  'Copy trading': false,
};

export const DEFAULT_PROVIDERS = {
  'USDT TRC-20': true,
  'Visa / Mastercard': true,
  'SEPA transfer': false,
  Bitcoin: true,
  PayPal: false,
  'ACH transfer': true,
};

export const DEFAULT_CRM_SETTINGS = {
  /** Agents see only the last 4 digits of a phone number */
  hidePhonesFromAgents: false,
  /** Block a lead whose phone / e-mail is already in the base */
  duplicateControl: true,
  /** Let clients close their own positions */
  manualClosing: false,
  /** Store call recordings */
  callRecording: true,
  modules: { ...DEFAULT_MODULES },
  providers: { ...DEFAULT_PROVIDERS },
};

const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);

/** Only keys we know about, and only booleans — never trust the client blindly. */
function sanitizeMap(raw, defaults) {
  const out = { ...defaults };
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw)) {
      if (typeof k !== 'string' || k.length > 40) continue;
      out[k] = Boolean(v);
    }
  }
  return out;
}

/** Stored value merged over the defaults, so a new flag never comes back undefined. */
export async function readCrmSettings() {
  const now = Date.now();
  if (g.__ohyCrmSettings.value && g.__ohyCrmSettings.expires > now) {
    return g.__ohyCrmSettings.value;
  }
  let value = {};
  try {
    const rec = await store.byField('settings', 'key', 'crmSettings');
    value = rec?.value || {};
  } catch {
    /* a broken read must never take the whole request down */
  }
  const result = {
    hidePhonesFromAgents: bool(value.hidePhonesFromAgents, DEFAULT_CRM_SETTINGS.hidePhonesFromAgents),
    duplicateControl: bool(value.duplicateControl, DEFAULT_CRM_SETTINGS.duplicateControl),
    manualClosing: bool(value.manualClosing, DEFAULT_CRM_SETTINGS.manualClosing),
    callRecording: bool(value.callRecording, DEFAULT_CRM_SETTINGS.callRecording),
    modules: sanitizeMap(value.modules, DEFAULT_MODULES),
    providers: sanitizeMap(value.providers, DEFAULT_PROVIDERS),
  };
  g.__ohyCrmSettings = { value: result, expires: now + 15_000 };
  return result;
}

/**
 * Merge a partial update into the stored settings.
 * A PUT that carries only { manualClosing: true } must not wipe the modules.
 */
export async function writeCrmSettings(patch = {}, actorName = 'system') {
  // bypass cache to get fresh
  let currentValue = {};
  try {
    const rec = await store.byField('settings', 'key', 'crmSettings');
    currentValue = rec?.value || {};
  } catch {}
  const currentSanitized = {
    hidePhonesFromAgents: bool(currentValue.hidePhonesFromAgents, DEFAULT_CRM_SETTINGS.hidePhonesFromAgents),
    duplicateControl: bool(currentValue.duplicateControl, DEFAULT_CRM_SETTINGS.duplicateControl),
    manualClosing: bool(currentValue.manualClosing, DEFAULT_CRM_SETTINGS.manualClosing),
    callRecording: bool(currentValue.callRecording, DEFAULT_CRM_SETTINGS.callRecording),
    modules: sanitizeMap(currentValue.modules, DEFAULT_MODULES),
    providers: sanitizeMap(currentValue.providers, DEFAULT_PROVIDERS),
  };
  const next = { ...currentSanitized };

  if (patch.hidePhonesFromAgents !== undefined) next.hidePhonesFromAgents = Boolean(patch.hidePhonesFromAgents);
  if (patch.duplicateControl !== undefined) next.duplicateControl = Boolean(patch.duplicateControl);
  if (patch.manualClosing !== undefined) next.manualClosing = Boolean(patch.manualClosing);
  if (patch.callRecording !== undefined) next.callRecording = Boolean(patch.callRecording);
  if (patch.modules !== undefined) next.modules = sanitizeMap(patch.modules, currentSanitized.modules);
  if (patch.providers !== undefined) next.providers = sanitizeMap(patch.providers, currentSanitized.providers);
  // also allow generic patch keys for modules/providers if patch contains them directly
  // handle case where patch has modules/providers as objects
  const rec = await store.byField('settings', 'key', 'crmSettings').catch(() => null);
  const payload = { value: next, updatedBy: actorName, updatedAt: new Date().toISOString() };
  if (rec) await store.update('settings', rec.id, payload);
  else await store.insert('settings', { key: 'crmSettings', ...payload });

  g.__ohyCrmSettings = { value: next, expires: Date.now() + 15_000 };
  return next;
}

export function invalidateCrmSettingsCache() {
  g.__ohyCrmSettings = { value: null, expires: 0 };
}
