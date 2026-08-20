// ============================================================
//  Trades — stored on the server so they survive a reload and
//  are editable from the CRM.
//
//    GET    /api/trades/mine        client: own positions
//    POST   /api/trades             client or staff: open a position
//    GET    /api/trades/all         staff: every position
//    PATCH  /api/trades/:id         staff: edit ANY field
//    POST   /api/trades/:id/close   staff or owner: close it
// ============================================================
import express from 'express';
import jwt from 'jsonwebtoken';
import * as store from '../db.js';
import { notify } from '../notifications.js';
import { livePrice } from './symbols.js';
import {
  quoteTrade,
  pnlOf,
  liquidationOf,
  validateProtection,
  protectionHit,
} from '../margin.js';

/** Admin-configured margin rates, if any. */
async function marginOverrides() {
  const rec = await store.byField('settings', 'key', 'marginRates');
  return rec?.value || {};
}

/** Margin currently locked by a client's open positions. */
function lockedMarginOf(trades) {
  // Pending orders reserve margin too — otherwise a client could queue
  // more orders than the account can ever cover.
  return trades
    .filter(t => t.status === 'OPEN' || t.status === 'PENDING')
    .reduce((sum, t) => sum + (Number(t.margin) || 0), 0);
}

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

async function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authorized' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await store.byId('users', payload.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired, sign in again' });
  }
}

const isStaff = (u) => u.role === 'ADMIN' || u.role === 'MANAGER';

function staffOnly(req, res, next) {
  if (!isStaff(req.user)) return res.status(403).json({ error: 'Staff access only' });
  next();
}

const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/* ---------------- read ---------------- */

router.get('/mine', auth, async (req, res) => {
  const trades = await store.manyByField('trades', 'userId', req.user.id);
  res.json({ trades });
});

router.get('/all', auth, staffOnly, async (req, res) => {
  res.json({ trades: await store.all('trades') });
});

/* ---------------- open ---------------- */

router.post('/', auth, async (req, res) => {
  const b = req.body || {};

  // Staff may open a position on behalf of a client
  let owner = req.user;
  if (b.userId && isStaff(req.user)) {
    const target = await store.byId('users', Number(b.userId));
    if (!target) return res.status(404).json({ error: 'Client not found' });
    owner = target;
  }

  if (!b.symbol) return res.status(400).json({ error: 'Instrument is required' });

  const side = ['LONG', 'SHORT', 'SPOT'].includes(b.side) ? b.side : 'LONG';

  // The browser sends the price it can see; if the quote had not loaded yet it
  // arrives as 0, so the server stamps a real price itself.
  let entryPrice = num(b.entryPrice);
  if (entryPrice <= 0) entryPrice = num(await livePrice(b.symbol));
  if (entryPrice <= 0) {
    return res.status(400).json({ error: 'No live price for this instrument right now. Please try again.' });
  }

  /**
   * Position size is expressed in UNITS of the asset. Clients type a dollar
   * figure, which we convert here so both paths end up identical.
   */
  let units = num(b.units);
  if (units <= 0) {
    const value = num(b.notional) || num(b.amount);
    if (value <= 0) return res.status(400).json({ error: 'Enter a position size' });
    units = value / entryPrice;
  }
  if (!(units > 0)) return res.status(400).json({ error: 'Position size must be greater than zero' });

  const overrides = await marginOverrides();
  const q = quoteTrade({ units, price: entryPrice, symbol: b.symbol, category: b.category, overrides });

  // Stop loss / take profit must sit on the correct side of the entry
  const prot = validateProtection({ side, entryPrice, stopLoss: b.stopLoss, takeProfit: b.takeProfit });
  if (prot.error) return res.status(400).json({ error: prot.error });

  /**
   * A client may only risk money the account actually holds. The browser
   * hides the button, but the endpoint must enforce it too — a crafted
   * request could otherwise open a position on an empty balance.
   */
  if (!isStaff(req.user)) {
    const balance = Number(owner.balance) || 0;
    const openTrades = await store.manyByField('trades', 'userId', owner.id);
    const free = balance - lockedMarginOf(openTrades);

    if (q.margin > free) {
      return res.status(400).json({
        error:
          free <= 0
            ? 'Your balance is empty. Please make a deposit before opening a position.'
            : `Insufficient free margin. This order needs $${q.margin.toFixed(2)}, available $${free.toFixed(2)}.`,
      });
    }
  }

  /**
   * Order type. A market order fills at once; limit and stop orders wait
   * in PENDING until the market reaches `triggerPrice`, then become
   * ordinary open positions with that price as their entry.
   */
  const orderType = ['market', 'limit', 'stop'].includes(b.orderType) ? b.orderType : 'market';
  const triggerPrice = num(b.triggerPrice);

  if (orderType !== 'market') {
    if (!(triggerPrice > 0)) {
      return res.status(400).json({ error: 'Enter the trigger price for this order' });
    }
    // A limit buy sits below the market, a stop buy above it — otherwise
    // the order would fill instantly and the type would be meaningless.
    const above = triggerPrice > entryPrice;
    const isBuy = side !== 'SHORT';
    if (orderType === 'limit' && isBuy && above) {
      return res.status(400).json({ error: 'A buy limit must be below the current price' });
    }
    if (orderType === 'limit' && !isBuy && !above) {
      return res.status(400).json({ error: 'A sell limit must be above the current price' });
    }
    if (orderType === 'stop' && isBuy && !above) {
      return res.status(400).json({ error: 'A buy stop must be above the current price' });
    }
    if (orderType === 'stop' && !isBuy && above) {
      return res.status(400).json({ error: 'A sell stop must be below the current price' });
    }
  }

  const trade = await store.insert('trades', {
    userId: owner.id,
    userName: owner.name,
    userEmail: owner.email,
    symbol: String(b.symbol).slice(0, 40),
    tv: String(b.tv || b.symbol).slice(0, 60),
    name: String(b.name || '').slice(0, 120),
    category: q.category,
    side,
    units: q.units,
    // Kept for backwards compatibility: the dollar value of the position
    amount: q.notional,
    notional: q.notional,
    entryPrice,
    currentPrice: num(b.currentPrice, entryPrice),
    marginRate: q.marginRate,
    leverage: Math.round(q.leverage * 100) / 100,
    stopLoss: prot.stopLoss,
    takeProfit: prot.takeProfit,
    pnl: 0,
    margin: Math.round(q.margin * 100) / 100,
    liquidationPrice: liquidationOf({ side, entryPrice, units: q.units, margin: q.margin }),
    orderType,
    triggerPrice: orderType === 'market' ? null : triggerPrice,
    status: orderType === 'market' ? 'OPEN' : 'PENDING',
    openedAt: b.openedAt || new Date().toISOString(),
    createdBy: req.user.name,
  });

  // Let the desk know a client opened something themselves
  if (!isStaff(req.user)) {
    await notify({
      audience: 'staff',
      userId: owner.id,
      kind: 'trade_opened',
      title: 'New position opened',
      message: `${owner.name} opened ${trade.side} ${trade.symbol} · ${trade.units} units ($${trade.notional.toLocaleString('en-US')}).`,
      link: 'trading',
    });
  }

  res.json({ ok: true, trade });
});

/* ---------------- edit (staff) ---------------- */

router.patch('/:id', auth, staffOnly, async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const patch = {};

  // Every parameter the desk is allowed to adjust
  if (b.side !== undefined && ['LONG', 'SHORT', 'SPOT'].includes(b.side)) patch.side = b.side;
  if (b.amount !== undefined) patch.amount = num(b.amount);
  if (b.entryPrice !== undefined) patch.entryPrice = num(b.entryPrice);
  if (b.currentPrice !== undefined) patch.currentPrice = num(b.currentPrice);
  if (b.leverage !== undefined) patch.leverage = Math.max(1, num(b.leverage, 1));
  if (b.pnl !== undefined) patch.pnl = num(b.pnl);
  if (b.stopLoss !== undefined) patch.stopLoss = b.stopLoss === null ? null : num(b.stopLoss);
  if (b.takeProfit !== undefined) patch.takeProfit = b.takeProfit === null ? null : num(b.takeProfit);
  if (b.openedAt !== undefined) patch.openedAt = b.openedAt;
  if (b.margin !== undefined) patch.margin = num(b.margin);
  if (b.liquidationPrice !== undefined) patch.liquidationPrice = num(b.liquidationPrice);
  if (b.status !== undefined && ['OPEN', 'CLOSED'].includes(b.status)) patch.status = b.status;

  patch.editedBy = req.user.name;
  patch.editedAt = new Date().toISOString();

  const trade = await store.update('trades', id, patch);
  if (!trade) return res.status(404).json({ error: 'Position not found' });

  res.json({ ok: true, trade });
});

/* ---------------- close ---------------- */

router.post('/:id/close', auth, async (req, res) => {
  const id = Number(req.params.id);
  const existing = await store.byId('trades', id);
  if (!existing) return res.status(404).json({ error: 'Position not found' });

  if (!isStaff(req.user) && existing.userId !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Check manualClosing toggle from Settings → Privacy & access
  if (!isStaff(req.user)) {
    try {
      const rec = await store.byField('settings', 'key', 'crmSettings');
      const s = rec?.value || {};
      const manualClosing = s.manualClosing === true;
      if (!manualClosing) {
        return res.status(403).json({ error: 'Manual closing is disabled by administrator. Contact support to close positions.' });
      }
    } catch {}
  }

  if (existing.status === 'CLOSED') {
    return res.status(400).json({ error: 'Position is already closed' });
  }

  /**
   * Settle the position: work out the realised result from the live price
   * and move it to the client's cash balance.
   */
  const units = num(existing.units) || (num(existing.entryPrice) > 0 ? num(existing.amount) / num(existing.entryPrice) : 0);
  const entry = num(existing.entryPrice);
  const exitPrice = num(req.body?.exitPrice) || num(await livePrice(existing.symbol)) || entry;

  let realised = pnlOf({ side: existing.side, entryPrice: entry, currentPrice: exitPrice, units });

  // A position can never lose more than the margin that was posted
  const margin = num(existing.margin);
  if (margin > 0 && realised < -margin) realised = -margin;
  realised = Math.round(realised * 100) / 100;

  const owner = await store.byId('users', existing.userId);
  let newBalance = null;
  if (owner) {
    newBalance = Math.round(((Number(owner.balance) || 0) + realised) * 100) / 100;
    if (newBalance < 0) newBalance = 0;
    await store.update('users', owner.id, { balance: newBalance });
  }

  const trade = await store.update('trades', id, {
    status: 'CLOSED',
    exitPrice,
    currentPrice: exitPrice,
    pnl: realised,
    closedAt: new Date().toISOString(),
    closedBy: req.user.name,
    closeReason: String(req.body?.reason || 'manual').slice(0, 40),
  });

  if (owner) {
    await notify({
      audience: 'client',
      userId: owner.id,
      kind: 'trade_closed',
      title: realised >= 0 ? 'Position closed in profit' : 'Position closed',
      message: `${existing.symbol} closed at ${exitPrice}. Result: ${realised >= 0 ? '+' : '-'}$${Math.abs(realised).toFixed(2)}.`,
    });
  }

  res.json({ ok: true, trade, balance: newBalance });
});

/* ---------------- protective orders ---------------- */

/**
 * Check every open position against its stop loss, take profit and
 * liquidation price, closing whichever have been reached.
 *
 * Called by the cabinet on its polling tick. Doing it server-side means the
 * levels still work no matter which device (or none) is watching.
 */
router.post('/settle', auth, async (req, res) => {
  const mine = await store.manyByField('trades', 'userId', req.user.id);
  const open = mine.filter(t => t.status === 'OPEN');
  const pending = mine.filter(t => t.status === 'PENDING');
  if (!open.length && !pending.length) return res.json({ ok: true, closed: [], triggered: [] });

  const closed = [];
  const triggered = [];

  /* --- pending limit / stop orders that the market has reached --- */
  for (const t of pending) {
    const price = num(await livePrice(t.symbol));
    if (!(price > 0)) continue;

    const trigger = num(t.triggerPrice);
    if (!(trigger > 0)) continue;

    const isBuy = t.side !== 'SHORT';
    // Buy limit fills on the way down, buy stop on the way up (and vice versa)
    const reached =
      t.orderType === 'limit'
        ? (isBuy ? price <= trigger : price >= trigger)
        : (isBuy ? price >= trigger : price <= trigger);

    if (!reached) continue;

    // The order becomes a real position, filled at its trigger price
    const units = num(t.units);
    const updated = await store.update('trades', t.id, {
      status: 'OPEN',
      entryPrice: trigger,
      currentPrice: price,
      liquidationOf: undefined,
      liquidationPrice: liquidationOf({
        side: t.side,
        entryPrice: trigger,
        units,
        margin: num(t.margin),
      }),
      openedAt: new Date().toISOString(),
      filledAt: new Date().toISOString(),
    });

    await notify({
      audience: 'client',
      userId: t.userId,
      kind: 'order_filled',
      title: `${t.orderType === 'limit' ? 'Limit' : 'Stop'} order filled`,
      message: `${t.symbol} ${t.side} filled at ${trigger}.`,
    });

    triggered.push({ id: t.id, symbol: t.symbol, price: trigger, trade: updated });
  }

  for (const t of open) {
    const price = num(await livePrice(t.symbol));
    if (!(price > 0)) continue;

    const units = num(t.units) || (num(t.entryPrice) > 0 ? num(t.amount) / num(t.entryPrice) : 0);
    const margin = num(t.margin);

    let hit = protectionHit({
      side: t.side,
      currentPrice: price,
      stopLoss: t.stopLoss,
      takeProfit: t.takeProfit,
    });

    // Margin wipe-out closes the position even without a stop loss
    if (!hit && margin > 0 && units > 0) {
      const liq = num(t.liquidationPrice) ||
        liquidationOf({ side: t.side, entryPrice: t.entryPrice, units, margin });
      if (liq > 0) {
        const wiped = t.side === 'SHORT' ? price >= liq : price <= liq;
        if (wiped) hit = { reason: 'liquidation', price: liq };
      }
    }

    if (!hit) {
      // Keep the displayed price fresh even when nothing triggers
      await store.update('trades', t.id, { currentPrice: price });
      continue;
    }

    let realised = pnlOf({ side: t.side, entryPrice: t.entryPrice, currentPrice: hit.price, units });
    if (margin > 0 && realised < -margin) realised = -margin;
    realised = Math.round(realised * 100) / 100;

    const owner = await store.byId('users', t.userId);
    if (owner) {
      let next = Math.round(((Number(owner.balance) || 0) + realised) * 100) / 100;
      if (next < 0) next = 0;
      await store.update('users', owner.id, { balance: next });
    }

    const updated = await store.update('trades', t.id, {
      status: 'CLOSED',
      exitPrice: hit.price,
      currentPrice: hit.price,
      pnl: realised,
      closedAt: new Date().toISOString(),
      closedBy: 'system',
      closeReason: hit.reason,
    });

    await notify({
      audience: 'client',
      userId: t.userId,
      kind: 'trade_closed',
      title:
        hit.reason === 'take-profit'
          ? 'Take profit reached'
          : hit.reason === 'stop-loss'
          ? 'Stop loss triggered'
          : 'Position liquidated',
      message: `${t.symbol} closed at ${hit.price}. Result: ${realised >= 0 ? '+' : '-'}$${Math.abs(realised).toFixed(2)}.`,
    });

    closed.push({ id: t.id, symbol: t.symbol, reason: hit.reason, pnl: realised, trade: updated });
  }

  res.json({ ok: true, closed, triggered });
});

export default router;
