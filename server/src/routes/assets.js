// ============================================================
//  Trading assets (the Market catalog).
//
//  Persistence: own table, so an instrument created by the admin
//  in the CRM appears to every client — not just in one browser.
//
//    GET    /api/assets        public list (market page)
//    POST   /api/assets        admin only — create instrument
//    DELETE /api/assets/:id    admin only — retire instrument
//
//  On first ever call the table is seeded with the platform's
//  standard instrument set (real markets, rate card APRs).
// ============================================================
import express from 'express';
import jwt from 'jsonwebtoken';
import * as store from '../db.js';
import { logActivity } from './workspace.js';
import { notify } from '../notifications.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

const CATEGORIES = {
  crypto: 'Crypto Spot / Futures',
  futures: 'Perpetual Futures',
  forex: 'Forex & Metals',
  pool: 'Algorithmic Pool',
};

const DEFAULT_ASSETS = [
  { title: 'BTC/USDT — Spot & Futures Trading', category: 'crypto', categoryLabel: CATEGORIES.crypto, targetAmount: 1000000, raisedAmount: 0, apr: 24.5, termMonths: 12, minCheck: 1000, riskLevel: 'medium', status: 'active', description: 'Trade the leading cryptocurrency with a direct Binance price feed. Spot orders and margin leverage up to 100x.', imageUrl: '/markets/bitcoin.jpg', tags: ['Binance Feed', 'Spot & Futures', 'Leverage 1x-100x'] },
  { title: 'ETH/USDT — Ethereum Perpetual Futures', category: 'futures', categoryLabel: CATEGORIES.futures, targetAmount: 500000, raisedAmount: 0, apr: 32.0, termMonths: 6, minCheck: 2500, riskLevel: 'high', status: 'active', description: 'Ethereum perpetual futures with automatic Stop Loss / Take Profit control and instant PnL calculation.', imageUrl: 'https://images.unsplash.com/photo-1622630998477-20aa696ecb05?auto=format&fit=crop&w=800&q=80', tags: ['Ethereum', 'Futures 20x', 'Stop Loss / TP'] },
  { title: 'XAU/USD — Gold / Precious Metal Spot', category: 'forex', categoryLabel: CATEGORIES.forex, targetAmount: 800000, raisedAmount: 0, apr: 18.0, termMonths: 12, minCheck: 5000, riskLevel: 'low', status: 'active', description: 'Gold trading with Twelve Data quotes. Inflation-protected asset with high liquidity on global exchanges.', imageUrl: '/markets/gold.jpg', tags: ['Gold XAU', 'Twelve Data', 'Safe-haven asset'] },
  { title: 'SOL/USDT — Solana Trading Pool', category: 'crypto', categoryLabel: CATEGORIES.crypto, targetAmount: 400000, raisedAmount: 0, apr: 45.0, termMonths: 6, minCheck: 1000, riskLevel: 'high', status: 'active', description: 'High-yield strategies on Solana. Instant Market and Limit order execution in a single interface.', imageUrl: '/markets/solana.jpg', tags: ['Solana', 'High volatility', 'Market/Limit'] },
  { title: 'EUR/USD — Forex Currency Pair', category: 'forex', categoryLabel: CATEGORIES.forex, targetAmount: 600000, raisedAmount: 0, apr: 14.2, termMonths: 12, minCheck: 2500, riskLevel: 'low', status: 'funded', description: 'Classic currency trading on the international Forex market with tight spreads and margin support.', imageUrl: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=800&q=80', tags: ['Forex', 'EUR/USD', 'Pool closed'] },
  { title: 'AI Quant Strategy Pool (Binance Feed)', category: 'pool', categoryLabel: CATEGORIES.pool, targetAmount: 750000, raisedAmount: 0, apr: 28.4, termMonths: 12, minCheck: 5000, riskLevel: 'medium', status: 'active', description: 'Algorithmic trading pool using high-frequency arbitrage on spot and futures markets.', imageUrl: 'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?auto=format&fit=crop&w=800&q=80', tags: ['AI Quant', 'Arbitrage', '24/7 Trading'] },
];

let seeded = false;
async function ensureSeed() {
  if (seeded) return;
  seeded = true;
  const existing = await store.all('assets');
  if (existing.length === 0) {
    for (const a of DEFAULT_ASSETS) await store.insert('assets', { ...a, createdAt: new Date().toISOString() });
    console.log(`[assets] Seeded ${DEFAULT_ASSETS.length} default instruments`);
  } else {
    const localByHint = [
      { re: /solana|1639762681485/i, url: '/markets/solana.jpg' },
      { re: /btc|1518770660439/i, url: '/markets/bitcoin.jpg' },
      { re: /xau|gold|1610375461246/i, url: '/markets/gold.jpg' },
    ];
    for (const a of existing) {
      const blob = `${a.title} ${a.imageUrl || ''}`;
      const hit = localByHint.find(h => h.re.test(blob));
      if (hit && a.imageUrl !== hit.url && (!a.imageUrl || String(a.imageUrl).startsWith('http'))) {
        await store.update('assets', a.id, { imageUrl: hit.url });
      }
    }
  }
}

/** Parse the JWT if present; never blocks public reads */
function who(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

function staffOnly(req, res, next) {
  const u = who(req);
  if (!u || !['ADMIN', 'MANAGER'].includes(u.role)) {
    return res.status(403).json({ error: 'Staff access only' });
  }
  req.user = u;
  next();
}

async function expireOffers() {
  const now = Date.now();
  const assets = await store.all('assets');
  for (const a of assets) {
    if (!a.closesAt || a.status === 'closed' || a.status === 'archived') continue;
    if (new Date(a.closesAt).getTime() > now) continue;
    await store.update('assets', a.id, { status: 'closed' });
    const clients = (await store.all('users')).filter(u => u.role === 'CLIENT');
    for (const c of clients) {
      await notify({
        audience: 'client',
        userId: c.id,
        kind: 'market_closed',
        title: 'Offer closed',
        message: `${a.title} is no longer available. Ask your advisor if you want it reopened.`,
        link: 'catalog',
      });
    }
  }
}

function expectedProfit(amount, apr, termMonths) {
  const months = Math.max(1, Number(termMonths) || 12);
  return Math.round(Number(amount || 0) * (Number(apr || 0) / 100) * (months / 12) * 100) / 100;
}

async function syncInvestmentsApr(asset, apr, termMonths) {
  const keys = new Set([`srv-${asset.id}`, String(asset.id), asset.title]);
  const all = await store.all('investments');
  for (const inv of all) {
    if (inv.status === 'closed') continue;
    const hit = keys.has(String(inv.projectId)) || String(inv.projectTitle) === String(asset.title);
    if (!hit) continue;
    await store.update('investments', inv.id, {
      apr: Number(apr),
      accruedProfit: expectedProfit(inv.amount, apr, termMonths ?? asset.termMonths),
    });
  }
}

const cleanStr = (v, max = 300) => String(v ?? '').slice(0, max);
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/* ---------------- public list ---------------- */
router.get('/', async (req, res) => {
  await ensureSeed();
  await expireOffers();
  const assets = await store.all('assets');
  res.json({ assets: assets.filter(a => a.status !== 'archived') });
});

/* ---------------- admin: create ---------------- */
router.post('/', staffOnly, async (req, res) => {
  const b = req.body || {};
  const title = cleanStr(b.title, 160).trim();
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const category = cleanStr(b.category, 30) || 'crypto';
  const asset = await store.insert('assets', {
    title,
    category,
    categoryLabel: cleanStr(b.categoryLabel, 60) || CATEGORIES[category] || category,
    targetAmount: num(b.targetAmount),
    raisedAmount: num(b.raisedAmount),
    apr: num(b.apr),
    termMonths: num(b.termMonths),
    minCheck: num(b.minCheck),
    riskLevel: ['low', 'medium', 'high'].includes(b.riskLevel) ? b.riskLevel : 'medium',
    status: cleanStr(b.status, 20) || 'active',
    description: cleanStr(b.description, 1000),
    imageUrl: cleanStr(b.imageUrl, 2000000),
    tags: Array.isArray(b.tags) ? b.tags.slice(0, 6).map(t => cleanStr(t, 40)) : [],
    closesAt: b.closesAt || null,
    createdAt: new Date().toISOString(),
  });

  logActivity({ actor: { id: req.user.userId, name: 'admin', role: 'ADMIN' }, action: 'asset_created', target: title, details: '' }).catch(() => undefined);
  res.json({ ok: true, asset });
});

/* ---------------- admin: update ---------------- */
router.patch('/:id', staffOnly, async (req, res) => {
  const id = Number(req.params.id);
  const existing = await store.byId('assets', id);
  if (!existing) return res.status(404).json({ error: 'Asset not found' });
  const b = req.body || {};
  const patch = {};
  if (b.title != null) patch.title = cleanStr(b.title, 160).trim() || existing.title;
  if (b.category != null) patch.category = cleanStr(b.category, 30) || existing.category;
  if (b.categoryLabel != null) patch.categoryLabel = cleanStr(b.categoryLabel, 60);
  if (b.targetAmount != null) patch.targetAmount = num(b.targetAmount);
  if (b.raisedAmount != null) patch.raisedAmount = num(b.raisedAmount);
  if (b.apr != null) patch.apr = num(b.apr);
  if (b.termMonths != null) patch.termMonths = num(b.termMonths);
  if (b.closesAt !== undefined) patch.closesAt = b.closesAt || null;
  if (b.timerDays != null) {
    const days = Math.max(0, num(b.timerDays));
    patch.closesAt = days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null;
    if (days > 0) patch.status = 'active';
  }
  if (b.minCheck != null) patch.minCheck = num(b.minCheck);
  if (b.riskLevel != null) patch.riskLevel = ['low', 'medium', 'high'].includes(b.riskLevel) ? b.riskLevel : existing.riskLevel;
  if (b.status != null) patch.status = cleanStr(b.status, 20) || existing.status;
  if (b.description != null) patch.description = cleanStr(b.description, 2000);
  if (b.imageUrl != null) patch.imageUrl = cleanStr(b.imageUrl, 2_000_000);
  if (Array.isArray(b.tags)) patch.tags = b.tags.slice(0, 6).map(t => cleanStr(t, 40));
  const asset = await store.update('assets', id, patch);
  if (patch.apr != null || patch.termMonths != null) {
    await syncInvestmentsApr(asset, asset.apr, asset.termMonths);
  }
  res.json({ ok: true, asset });
});

router.post('/:id/pulse', staffOnly, async (req, res) => {
  const id = Number(req.params.id);
  const existing = await store.byId('assets', id);
  if (!existing) return res.status(404).json({ error: 'Asset not found' });
  const amount = Math.max(0, num(req.body?.amount));
  if (!(amount > 0)) return res.status(400).json({ error: 'Enter an amount' });
  const clientName = cleanStr(req.body?.clientName, 80).trim() || 'A client';
  const userId = req.body?.userId != null ? Number(req.body.userId) : null;
  const notifyAll = Boolean(req.body?.notifyAll);
  const raised = Math.round((num(existing.raisedAmount) + amount) * 100) / 100;
  const asset = await store.update('assets', id, { raisedAmount: raised });
  const message = `${clientName} allocated $${amount.toLocaleString('en-US')} to ${existing.title}.`;
  if (notifyAll) {
    const clients = (await store.all('users')).filter(u => u.role === 'CLIENT');
    for (const c of clients) {
      await notify({ audience: 'client', userId: c.id, kind: 'market_pulse', title: 'Live market update', message, link: 'catalog' });
    }
  } else if (userId) {
    await notify({ audience: 'client', userId, kind: 'market_pulse', title: 'Live market update', message, link: 'catalog' });
  }
  await notify({ audience: 'staff', kind: 'market_pulse', title: 'Market pulse', message, link: 'markets' });
  res.json({ ok: true, asset, message: 'Pulse sent.' });
});

/* ---------------- admin: remove ---------------- */
router.delete('/:id', staffOnly, async (req, res) => {
  const id = Number(req.params.id);
  const existing = await store.byId('assets', id);
  if (!existing) return res.status(404).json({ error: 'Asset not found' });
  await store.removeWhere('assets', (a) => a.id === id);
  res.json({ ok: true });
});

export default router;
