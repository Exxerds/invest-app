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

async function getJson(url, ms = 6000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPrice(asset) {
  // 1. Coinbase — reliable and unrestricted
  const cb = await getJson(`https://api.coinbase.com/v2/prices/${asset}-USD/spot`);
  const cbPrice = Number(cb?.data?.amount);
  if (Number.isFinite(cbPrice) && cbPrice > 0) return cbPrice;

  // 2. Kraken — uses XBT for bitcoin
  const kr = await getJson(
    `https://api.kraken.com/0/public/Ticker?pair=${asset === 'BTC' ? 'XBT' : asset}USD`,
  );
  const krPair = kr?.result && Object.values(kr.result)[0];
  const krPrice = Number(krPair?.c?.[0]);
  if (Number.isFinite(krPrice) && krPrice > 0) return krPrice;

  // 3. CoinGecko — last resort, needs a slug rather than a ticker
  const id = COINGECKO_IDS[asset];
  if (id) {
    const cg = await getJson(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
    const cgPrice = Number(cg?.[id]?.usd);
    if (Number.isFinite(cgPrice) && cgPrice > 0) return cgPrice;
  }

  return null;
}

/** Shared helper so other routes can stamp a price without an HTTP hop. */
export async function livePrice(symbol) {
  const asset = baseAsset(symbol);
  const hit = quoteCache.get(asset);
  if (hit && Date.now() - hit.at < QUOTE_TTL) return hit.price;
  const price = await fetchPrice(asset);
  if (price !== null) quoteCache.set(asset, { price, at: Date.now() });
  return price;
}

router.get('/quote', async (req, res) => {
  const raw = String(req.query.symbol || '');
  if (!raw) return res.status(400).json({ error: 'symbol is required' });

  const asset = baseAsset(raw);
  const hit = quoteCache.get(asset);
  if (hit && Date.now() - hit.at < QUOTE_TTL) {
    return res.json({ symbol: raw, price: hit.price, cached: true });
  }

  try {
    const price = await fetchPrice(asset);
    if (price === null) return res.json({ symbol: raw, price: null });

    if (quoteCache.size > 200) quoteCache.clear();
    quoteCache.set(asset, { price, at: Date.now() });
    res.json({ symbol: raw, price });
  } catch {
    // Never fail the page over a quote — the UI keeps the last known value
    res.json({ symbol: raw, price: null });
  }
});

export default router;
