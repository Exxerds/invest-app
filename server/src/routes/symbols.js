// ============================================================
//  Instrument search.
//
//  Proxies TradingView's public symbol search so the client can
//  look up ANY tradable asset — stocks, crypto, forex, futures,
//  indices — instead of a hard-coded list.
//
//  Why proxy instead of calling it from the browser:
//    * the endpoint rejects cross-origin browser calls (403)
//    * keeps the upstream URL out of the front-end
//    * lets us cache and normalise the response
//
//  If the upstream is ever unreachable we fall back to a small
//  built-in list so the search box never looks broken.
// ============================================================
import express from 'express';

const router = express.Router();

const UPSTREAM = 'https://symbol-search.tradingview.com/symbol_search/v3/';

// Same-value requests are common (typing re-triggers the search),
// so a short in-memory cache saves a lot of round trips.
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000;
const CACHE_MAX = 300;

/** Map a TradingView type to the four categories used in the UI */
function toCategory(type, exchange = '') {
  const t = String(type || '').toLowerCase();
  if (t.includes('crypto')) return 'Crypto';
  if (t.includes('forex')) return 'Currencies';
  if (t.includes('futures') || t.includes('commodity') || t.includes('economic')) return 'Commodities';
  if (t.includes('index') || t.includes('indices')) return 'Indices';
  if (t.includes('stock') || t.includes('fund') || t.includes('dr')) return 'Stocks';
  return exchange ? 'Stocks' : 'Other';
}

/** TradingView marks matches with <em> tags — strip them */
const clean = (v) => String(v || '').replace(/<\/?[^>]+>/g, '');

router.get('/search', async (req, res) => {
  const text = String(req.query.q || '').trim().slice(0, 60);
  if (text.length < 1) return res.json({ results: [] });

  const key = text.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) {
    return res.json({ results: hit.results, cached: true });
  }

  try {
    const url = `${UPSTREAM}?text=${encodeURIComponent(text)}&hl=0&lang=en&domain=production`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const upstream = await fetch(url, {
      signal: controller.signal,
      headers: {
        // The endpoint only answers requests that look like they come
        // from tradingview.com itself
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Referer: 'https://www.tradingview.com/',
        Origin: 'https://www.tradingview.com',
        Accept: 'application/json',
      },
    });
    clearTimeout(timer);

    if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);

    const data = await upstream.json();
    const list = Array.isArray(data) ? data : data.symbols || [];

    const results = list
      .map((s) => {
        const symbol = clean(s.symbol);
        const exchange = clean(s.exchange || s.source_id);
        return {
          symbol,
          name: clean(s.description),
          exchange,
          kind: clean(s.type) || 'instrument',
          category: toCategory(s.type, exchange),
          // what the chart widget expects
          tv: `${exchange}:${symbol}`,
          logo: s.logoid ? `https://s3-symbol-logo.tradingview.com/${s.logoid}.svg` : null,
        };
      })
      .filter((s) => s.symbol && s.exchange)
      .slice(0, 30);

    if (cache.size > CACHE_MAX) cache.clear();
    cache.set(key, { at: Date.now(), results });

    res.json({ results });
  } catch (err) {
    console.warn('[symbols] search failed:', err.message);
    // Never break the UI — answer with whatever matches locally
    res.json({ results: [], error: 'search_unavailable' });
  }
});

/* ============================================================
   LIVE QUOTES

   Several providers are tried in order. Binance is intentionally
   NOT used: it refuses requests from US IP ranges, which is where
   Vercel runs, so it always answered with an eligibility error and
   the entry price came back empty.

   Order: Coinbase -> Kraken -> CoinGecko. Crypto only; other asset
   classes return null and the UI keeps its last known value.
   ============================================================ */

const quoteCache = new Map();
const QUOTE_TTL = 4000; // ms — matches the UI refresh interval

/** BINANCE:BTCUSDT, BTC/USD, BTCUSD ... -> BTC */
function baseAsset(raw) {
  let s = String(raw || '').toUpperCase().trim();
  if (s.includes(':')) s = s.split(':').pop();
  s = s.replace(/[^A-Z0-9]/g, '');
  for (const quote of ['USDT', 'USDC', 'USD']) {
    if (s.endsWith(quote) && s.length > quote.length) return s.slice(0, -quote.length);
  }
  return s;
}

const COINGECKO_IDS = {
  BTC: 'bitcoin', XBT: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
  XRP: 'ripple', LINK: 'chainlink', ADA: 'cardano', DOGE: 'dogecoin', AVAX: 'avalanche-2',
  MATIC: 'matic-network', DOT: 'polkadot', LTC: 'litecoin', TRX: 'tron', NEAR: 'near',
};

/** Assets Coinbase genuinely trades. Anything else must NOT be asked of it. */
const COINBASE_ASSETS = new Set([
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'LINK', 'ADA', 'DOGE', 'AVAX', 'MATIC',
  'DOT', 'LTC', 'TRX', 'NEAR', 'USDT', 'USDC', 'ATOM', 'UNI', 'AAVE', 'FIL',
  'ALGO', 'XLM', 'BCH', 'ETC', 'SHIB', 'APT', 'ARB', 'OP', 'SUI', 'PEPE',
]);

/**
 * Yahoo Finance tickers for everything that is not crypto.
 * Without this map a symbol like SPX was sent to Coinbase, which happily
 * returned the price of an unrelated meme token — $0.31 instead of the
 * S&P 500. Non-crypto now never touches a crypto exchange.
 */
const YAHOO_SYMBOLS = {
  // metals & energy
  XAUUSD: 'GC=F', XAU: 'GC=F', GOLD: 'GC=F',
  XAGUSD: 'SI=F', XAG: 'SI=F', SILVER: 'SI=F',
  XPTUSD: 'PL=F', XPT: 'PL=F', XPDUSD: 'PA=F',
  USOIL: 'CL=F', WTI: 'CL=F', CL: 'CL=F',
  UKOIL: 'BZ=F', BRENT: 'BZ=F',
  NG1: 'NG=F', NGAS: 'NG=F',
  // indices
  SPX: '^GSPC', SPXUSD: '^GSPC', US500: '^GSPC',
  NDX: '^NDX', NSXUSD: '^NDX', NAS100: '^NDX',
  DJI: '^DJI', US30: '^DJI',
  UKXGBP: '^FTSE', FTSE: '^FTSE',
  DEU40: '^GDAXI', DAX: '^GDAXI',
  NKY: '^N225', JP225: '^N225',
};

const FX_CODES = new Set(['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD']);

/** Work out where a symbol's price should come from. */
function routeOf(raw) {
  let s = String(raw || '').toUpperCase().trim();
  if (s.includes(':')) s = s.split(':').pop();
  s = s.replace(/[^A-Z0-9^=.]/g, '');

  if (YAHOO_SYMBOLS[s]) return { kind: 'yahoo', ticker: YAHOO_SYMBOLS[s] };

  // Currency pair such as EURUSD or GBPJPY
  if (/^[A-Z]{6}$/.test(s) && FX_CODES.has(s.slice(0, 3)) && FX_CODES.has(s.slice(3))) {
    return { kind: 'yahoo', ticker: `${s}=X` };
  }

  // Strip a crypto quote currency: BTCUSDT -> BTC
  let base = s;
  for (const q of ['USDT', 'USDC', 'USD']) {
    if (base.endsWith(q) && base.length > q.length) {
      base = base.slice(0, -q.length);
      break;
    }
  }
  if (COINBASE_ASSETS.has(base)) return { kind: 'crypto', asset: base };

  // Everything else is treated as an equity ticker
  return { kind: 'yahoo', ticker: s };
}

async function getJson(url, ms = 6000, headers = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Stocks, indices, metals, energy and FX. */
async function yahooPrice(ticker) {
  const data = await getJson(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1m&range=1d`,
    7000,
    { 'User-Agent': 'Mozilla/5.0' },
  );
  const meta = data?.chart?.result?.[0]?.meta;
  const price = Number(meta?.regularMarketPrice);
  return Number.isFinite(price) && price > 0 ? price : null;
}

async function cryptoPrice(asset) {
  const cb = await getJson(`https://api.coinbase.com/v2/prices/${asset}-USD/spot`);
  const cbPrice = Number(cb?.data?.amount);
  if (Number.isFinite(cbPrice) && cbPrice > 0) return cbPrice;

  const kr = await getJson(
    `https://api.kraken.com/0/public/Ticker?pair=${asset === 'BTC' ? 'XBT' : asset}USD`,
  );
  const krPair = kr?.result && Object.values(kr.result)[0];
  const krPrice = Number(krPair?.c?.[0]);
  if (Number.isFinite(krPrice) && krPrice > 0) return krPrice;

  const id = COINGECKO_IDS[asset];
  if (id) {
    const cg = await getJson(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
    const cgPrice = Number(cg?.[id]?.usd);
    if (Number.isFinite(cgPrice) && cgPrice > 0) return cgPrice;
  }
  return null;
}

async function fetchPrice(raw) {
  const route = routeOf(raw);
  return route.kind === 'crypto' ? cryptoPrice(route.asset) : yahooPrice(route.ticker);
}

/** Shared helper so other routes can stamp a price without an HTTP hop. */
export async function livePrice(symbol) {
  const key = String(symbol || '').toUpperCase();
  const hit = quoteCache.get(key);
  if (hit && Date.now() - hit.at < QUOTE_TTL) return hit.price;
  const price = await fetchPrice(symbol);
  if (price !== null) quoteCache.set(key, { price, at: Date.now() });
  return price;
}

router.get('/quote', async (req, res) => {
  const raw = String(req.query.symbol || '');
  if (!raw) return res.status(400).json({ error: 'symbol is required' });

  const key = raw.toUpperCase();
  const hit = quoteCache.get(key);
  if (hit && Date.now() - hit.at < QUOTE_TTL) {
    return res.json({ symbol: raw, price: hit.price, cached: true });
  }

  try {
    const price = await fetchPrice(raw);
    if (price === null) return res.json({ symbol: raw, price: null });

    if (quoteCache.size > 200) quoteCache.clear();
    quoteCache.set(key, { price, at: Date.now() });
    res.json({ symbol: raw, price });
  } catch {
    // Never fail the page over a quote — the UI keeps the last known value
    res.json({ symbol: raw, price: null });
  }
});

/* ============================================================
   ORDER BOOK & CANDLES (Coinbase Exchange, no key required)
   Binance is unusable here: it blocks US IP ranges and Vercel
   runs in the US, so every call came back with an eligibility
   error. Coinbase serves both endpoints from the same host.
   ============================================================ */

/**
 * Order-book product id, but only for assets Coinbase actually lists.
 * Returns null for stocks, indices, metals and FX — those trade on venues
 * that do not publish a free public depth feed, and asking Coinbase for
 * them used to return an unrelated token's book.
 */
function toProduct(raw) {
  const route = routeOf(raw);
  return route.kind === 'crypto' ? `${route.asset}-USD` : null;
}

const bookCache = new Map();
const BOOK_TTL = 2500;

router.get('/orderbook', async (req, res) => {
  const product = toProduct(req.query.symbol);

  // Be explicit rather than silently empty, so the UI can explain why
  if (!product) {
    return res.json({
      symbol: req.query.symbol,
      bids: [],
      asks: [],
      supported: false,
      reason: 'Live depth is published for crypto markets only.',
    });
  }

  const hit = bookCache.get(product);
  if (hit && Date.now() - hit.at < BOOK_TTL) return res.json(hit.data);

  const raw = await getJson(
    `https://api.exchange.coinbase.com/products/${product}/book?level=2`,
    6000,
  );
  if (!raw?.bids) {
    return res.json({ symbol: req.query.symbol, bids: [], asks: [], supported: true });
  }

  const take = (rows) =>
    (rows || []).slice(0, 12).map(([price, size]) => ({
      price: Number(price),
      size: Number(size),
    }));

  const data = {
    symbol: req.query.symbol,
    bids: take(raw.bids),
    asks: take(raw.asks),
    supported: true,
  };
  if (bookCache.size > 60) bookCache.clear();
  bookCache.set(product, { data, at: Date.now() });
  res.json(data);
});

const candleCache = new Map();
const CANDLE_TTL = 30_000;

router.get('/candles', async (req, res) => {
  const product = toProduct(req.query.symbol);
  if (!product) return res.json({ symbol: req.query.symbol, candles: [], supported: false });
  // 1m, 5m, 15m, 1h, 6h, 1d — the granularities Coinbase accepts
  const allowed = [60, 300, 900, 3600, 21600, 86400];
  const g = allowed.includes(Number(req.query.granularity)) ? Number(req.query.granularity) : 3600;
  const key = `${product}:${g}`;

  const hit = candleCache.get(key);
  if (hit && Date.now() - hit.at < CANDLE_TTL) return res.json(hit.data);

  const raw = await getJson(
    `https://api.exchange.coinbase.com/products/${product}/candles?granularity=${g}`,
    8000,
  );
  if (!Array.isArray(raw)) return res.json({ symbol: req.query.symbol, candles: [] });

  // Coinbase returns [time, low, high, open, close, volume], newest first
  const candles = raw
    .slice(0, 200)
    .map(([time, low, high, open, close, volume]) => ({
      time, open, high, low, close, volume,
    }))
    .sort((a, b) => a.time - b.time);

  const data = { symbol: req.query.symbol, granularity: g, candles };
  if (candleCache.size > 60) candleCache.clear();
  candleCache.set(key, { data, at: Date.now() });
  res.json(data);
});

export default router;
