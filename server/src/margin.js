// ============================================================
//  Margin model (Trade Nation style).
//
//  A position is measured in UNITS of the asset, not in dollars:
//    amount   = 0.1        -> 0.1 BTC
//    notional = amount x price
//    margin   = notional x marginRate
//
//  `marginRate` depends on the asset class, exactly like a real
//  CFD broker: crypto is capital-heavy (30%), FX is cheap (0.2%).
//  Leverage is simply 1 / marginRate and is shown for reference.
//
//  Admins can override every rate from the CRM; these are the
//  defaults used until they do.
// ============================================================

/** Percentage of the position value that must be posted as margin. */
export const DEFAULT_MARGIN_RATES = {
  Crypto: 30,      // 3.3 : 1
  Stocks: 20,      // 5 : 1
  Indices: 0.5,    // 200 : 1
  Commodities: 2,  // 50 : 1
  Currencies: 0.2, // 500 : 1
  Other: 10,       // 10 : 1
};

export const MARGIN_CATEGORIES = Object.keys(DEFAULT_MARGIN_RATES);

const CRYPTO = /^(BTC|XBT|ETH|SOL|BNB|XRP|LINK|ADA|DOGE|AVAX|MATIC|DOT|LTC|TRX|NEAR|USDT|USDC)/;
const METALS = /^(XAU|XAG|XPT|XPD|GOLD|SILVER)/;
const ENERGY = /(USOIL|UKOIL|BRENT|WTI|NG1|NGAS)/;
const INDEX = /(SPX|NDX|NSXUSD|DJI|US30|US500|NAS100|DAX|FTSE|NKY|DEU40|UKX)/;

/**
 * Work out which margin bucket an instrument belongs to.
 * `category` comes from the instrument list when available; the symbol
 * itself is used as a fallback for assets found through search.
 */
export function categoryOf(symbol, category) {
  if (category && DEFAULT_MARGIN_RATES[category] !== undefined) return category;

  const s = String(symbol || '').toUpperCase().replace(/^[A-Z]+:/, '');
  if (INDEX.test(s)) return 'Indices';
  if (METALS.test(s) || ENERGY.test(s)) return 'Commodities';
  if (CRYPTO.test(s)) return 'Crypto';
  // Six letters made of two currency codes -> an FX pair (EURUSD, GBPJPY)
  if (/^[A-Z]{6}$/.test(s) && /(USD|EUR|GBP|JPY|CHF|AUD|CAD|NZD)$/.test(s)) return 'Currencies';
  if (/^[A-Z.]{1,5}$/.test(s)) return 'Stocks';
  return 'Other';
}

/** Margin rate (%) for an instrument, honouring admin overrides. */
export function rateFor(symbol, category, overrides = {}) {
  const bucket = categoryOf(symbol, category);
  const custom = Number(overrides[bucket]);
  if (Number.isFinite(custom) && custom > 0) return custom;
  return DEFAULT_MARGIN_RATES[bucket] ?? DEFAULT_MARGIN_RATES.Other;
}

/**
 * Everything the platform needs to know about a position.
 * One place, so the browser and the server can never disagree.
 */
export function quoteTrade({ units, price, symbol, category, overrides }) {
  const u = Math.abs(Number(units) || 0);
  const p = Number(price) || 0;
  const rate = rateFor(symbol, category, overrides);

  const notional = u * p;
  const margin = (notional * rate) / 100;

  return {
    units: u,
    price: p,
    notional,
    marginRate: rate,
    margin,
    leverage: rate > 0 ? 100 / rate : 1,
    category: categoryOf(symbol, category),
  };
}

/** Unrealised / realised result of a position. */
export function pnlOf({ side, entryPrice, currentPrice, units }) {
  const entry = Number(entryPrice) || 0;
  const now = Number(currentPrice) || 0;
  const u = Math.abs(Number(units) || 0);
  if (!(entry > 0) || !(now > 0) || !(u > 0)) return 0;
  const dir = side === 'SHORT' ? -1 : 1;
  return (now - entry) * u * dir;
}

/**
 * Price at which the remaining margin is wiped out.
 * LONG  -> entry - margin/units
 * SHORT -> entry + margin/units
 */
export function liquidationOf({ side, entryPrice, units, margin }) {
  const entry = Number(entryPrice) || 0;
  const u = Math.abs(Number(units) || 0);
  const m = Number(margin) || 0;
  if (!(entry > 0) || !(u > 0)) return 0;
  const move = m / u;
  const price = side === 'SHORT' ? entry + move : entry - move;
  return Math.max(0, price);
}

/**
 * Validate stop-loss / take-profit against the entry price.
 * A stop above the entry on a long position would fire instantly,
 * so those combinations are rejected rather than silently accepted.
 */
export function validateProtection({ side, entryPrice, stopLoss, takeProfit }) {
  const entry = Number(entryPrice) || 0;
  const sl = stopLoss === null || stopLoss === undefined || stopLoss === '' ? null : Number(stopLoss);
  const tp = takeProfit === null || takeProfit === undefined || takeProfit === '' ? null : Number(takeProfit);

  if (sl !== null && (!Number.isFinite(sl) || sl <= 0)) return { error: 'Stop loss must be a positive price' };
  if (tp !== null && (!Number.isFinite(tp) || tp <= 0)) return { error: 'Take profit must be a positive price' };
  if (!(entry > 0)) return { stopLoss: sl, takeProfit: tp };

  if (side === 'SHORT') {
    if (sl !== null && sl <= entry) return { error: 'For a short position the stop loss must be above the entry price' };
    if (tp !== null && tp >= entry) return { error: 'For a short position the take profit must be below the entry price' };
  } else {
    if (sl !== null && sl >= entry) return { error: 'For a long position the stop loss must be below the entry price' };
    if (tp !== null && tp <= entry) return { error: 'For a long position the take profit must be above the entry price' };
  }

  return { stopLoss: sl, takeProfit: tp };
}

/**
 * Has the market reached a protective level?
 * Returns the trigger name and the price it would fill at.
 */
export function protectionHit({ side, currentPrice, stopLoss, takeProfit }) {
  const now = Number(currentPrice) || 0;
  if (!(now > 0)) return null;
  const sl = Number(stopLoss) || 0;
  const tp = Number(takeProfit) || 0;

  if (side === 'SHORT') {
    if (sl > 0 && now >= sl) return { reason: 'stop-loss', price: sl };
    if (tp > 0 && now <= tp) return { reason: 'take-profit', price: tp };
  } else {
    if (sl > 0 && now <= sl) return { reason: 'stop-loss', price: sl };
    if (tp > 0 && now >= tp) return { reason: 'take-profit', price: tp };
  }
  return null;
}
