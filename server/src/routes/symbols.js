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

export default router;
