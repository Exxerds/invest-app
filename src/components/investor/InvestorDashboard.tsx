// ============================================================
//  CLIENT CABINET — built from the PDF presentation
//  (pages 6-8 spot terminal & portfolio, page 17 statistics).
//  Dark + gold theme, own left sidebar like in the PDF screens:
//  Dashboard · Trading (Spot/Futures/P2P/AI) · Withdrawals ·
//  Transactions · Support · Call manager · Profile · Statistics
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  ArrowDownToLine,
  Receipt,
  LifeBuoy,
  PhoneCall,
  User,
  BarChart3,
  LogOut,
  Wallet,
  ArrowUpRight,
  ShieldCheck,
  Download,
  Layers,
  DollarSign,
  Search,
  X,
  Loader2,
} from 'lucide-react';
import type { ActiveInvestment } from '../../types';
import { Card, Btn, Badge, Kpi, Th, Td, Input, Select } from '../crm/ui';
import { VerifyIdentity } from './VerifyIdentity';
import { AdvancedChart } from './TradingViewChart';
import { apiSearchSymbols, apiMyTrades, apiOpenTrade, apiCloseTrade, apiQuote, apiMarginRates, apiSettleTrades, apiOrderBook, apiRequestCall } from '../../api';
import type { ApiTrade, ApiTransaction } from '../../api';
import { INSTRUMENTS, ASSET_CATEGORIES } from '../../data/instruments';
import type { AssetCategory, Instrument } from '../../data/instruments';

interface InvestorDashboardProps {
  /** Signed-in account — the cabinet shows real data, never a demo persona */
  user?: { name: string; email: string } | null;
  /** True once an admin approved the client's KYC documents */
  kycVerified?: boolean;
  /** Real deposit / withdrawal requests from the server */
  transactions?: ApiTransaction[];
  investorBalance: number;
  myInvestments: ActiveInvestment[];
  onOpenCatalog: () => void;
  onOpenDepositModal: () => void;
  onOpenWithdrawModal: () => void;
  onClaimDividends: (id: string, profit: number) => void;
  /** Clears the session and returns to the public site */
  onLogout?: () => void;
  /** Re-reads the balance from the server after a trade settles */
  onBalanceChanged?: () => void;
}

type Tab = 'dashboard' | 'trading' | 'withdrawals' | 'transactions' | 'support' | 'call' | 'profile' | 'statistics';

const NAV: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'trading', label: 'Trading', icon: TrendingUp },
  { id: 'withdrawals', label: 'Withdrawals', icon: ArrowDownToLine },
  { id: 'transactions', label: 'Transactions', icon: Receipt },
  { id: 'support', label: 'Support', icon: LifeBuoy },
  { id: 'call', label: 'Call manager', icon: PhoneCall },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'statistics', label: 'Statistics', icon: BarChart3 },
];

/**
 * Crypto wallets.
 * Empty by design: balances must come from the back office, never from
 * hard-coded sample data. A brand-new client sees an empty state instead of
 * somebody else's holdings.
 */
type Wallet = { sym: string; name: string; qty: number; price: number; avg: number; pnl: number; pct: number };

/**
 * Unrealised P/L for an open position, recomputed from the live quote.
 * A 1% move on a 10x position changes the result by 10% of the stake.
 */
/** BTCUSD -> BTC, so the position size can be shown in units of the asset. */
function baseOf(symbol: string): string {
  const s = String(symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  for (const quote of ['USDT', 'USDC', 'USD']) {
    if (s.endsWith(quote) && s.length > quote.length) return s.slice(0, -quote.length);
  }
  return s;
}

/** Consistent money formatting across the cabinet. */
const usd = (v: number) =>
  `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Size of a position in units of the asset. */
function unitsOf(t: ApiTrade): number {
  const u = Number(t.units) || 0;
  if (u > 0) return u;
  const entry = Number(t.entryPrice) || 0;
  return entry > 0 ? Number(t.amount || 0) / entry : 0;
}

/**
 * Unrealised P/L — the same formula the server settles with:
 * (current - entry) x units x direction.
 */
function livePnlOf(t: ApiTrade, live: number): number {
  const entry = Number(t.entryPrice) || 0;
  if (!(live > 0) || !(entry > 0)) return Number(t.pnl) || 0;
  const dir = t.side === 'SHORT' ? -1 : 1;
  return (live - entry) * unitsOf(t) * dir;
}
const WALLETS: Wallet[] = [];

export const InvestorDashboard: React.FC<InvestorDashboardProps> = ({
  user,
  kycVerified = false,
  transactions = [],
  investorBalance,
  myInvestments,
  onOpenCatalog,
  onOpenDepositModal,
  onOpenWithdrawModal,
  onClaimDividends,
  onLogout,
  onBalanceChanged,
}) => {
  /* Display name derived from the signed-in account (no demo persona) */
  const fullName = (user?.name || '').trim();
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || 'there';
  const shortName = nameParts.length > 1
    ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`
    : (nameParts[0] || 'Client');
  const initials = (nameParts.length > 1
    ? nameParts[0][0] + nameParts[nameParts.length - 1][0]
    : (nameParts[0]?.slice(0, 2) || 'CL')).toUpperCase();

  const [tab, setTab] = useState<Tab>('dashboard');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop'>('market');
  const [amount, setAmount] = useState(500);
  // Margin requirements per asset class, set by the back office
  const [marginRates, setMarginRates] = useState<Record<string, number>>({});
  const [triggerPrice, setTriggerPrice] = useState('');
  // Live order book for the selected instrument
  const [book, setBook] = useState<{
    bids: { price: number; size: number }[];
    asks: { price: number; size: number }[];
    supported: boolean;
    reason?: string;
  }>({ bids: [], asks: [], supported: true });
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [category, setCategory] = useState<AssetCategory>('Crypto');
  const [symbol, setSymbol] = useState<Instrument>(INSTRUMENTS[0]);
  const [instrumentQuery, setInstrumentQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Instrument[]>([]);
  const [searching, setSearching] = useState(false);
  const [placing, setPlacing] = useState(false);

  /**
   * Live prices for the positions table.
   * Seeded from the entry price, then nudged every few seconds so the
   * "Current price" column visibly moves like a real quote feed.
   */
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});


  /**
   * Live instrument search.
   * Empty box → the curated list for the selected category.
   * Typing → every asset TradingView knows, fetched through our own API
   * (debounced so we don't fire a request on each keystroke).
   */
  useEffect(() => {
    const q = instrumentQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await apiSearchSymbols(q);
        setSearchResults(
          res.results.map(r => ({
            symbol: r.symbol,
            name: r.name,
            tv: r.tv,
            category: (r.category as AssetCategory) || 'Crypto',
            exchange: r.exchange,
            kind: r.kind,
          })),
        );
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [instrumentQuery]);

  const visibleInstruments: Instrument[] =
    instrumentQuery.trim().length >= 2
      ? searchResults
      : INSTRUMENTS.filter(i => i.category === category);

  /* ---- positions live on the server ---- */
  const [myTrades, setMyTrades] = useState<ApiTrade[]>([]);

  /**
   * Real quotes for the selected instrument and for every open position,
   * pulled from the exchange through our own API and refreshed every 4s.
   * This is what makes the P/L column move on its own.
   */
  useEffect(() => {
    let stopped = false;

    const pull = async () => {
      const wanted = new Set<string>();
      wanted.add(symbol.symbol);
      myTrades.filter(t => t.status === 'OPEN').forEach(t => wanted.add(t.symbol));
      myInvestments.forEach(inv => wanted.add(inv.projectTitle));

      const results = await Promise.all(
        [...wanted].map(async sym => {
          try {
            const r = await apiQuote(sym);
            return [sym, r.price] as const;
          } catch {
            return [sym, null] as const;
          }
        }),
      );
      if (stopped) return;
      setLivePrices(prev => {
        const next = { ...prev };
        results.forEach(([sym, price]) => {
          if (price !== null && Number.isFinite(price)) next[sym] = price;
        });
        return next;
      });
    };

    // Ask the server to settle anything that hit its stop / target
    const settle = async () => {
      if (!myTrades.some(t => t.status === 'OPEN')) return;
      try {
        const r = await apiSettleTrades();
        if (r.triggered?.length) {
          const f = r.triggered[0];
          setToast(`${f.symbol} order filled at ${f.price}`);
          await reloadTrades();
        }
        if (r.closed.length) {
          const first = r.closed[0];
          setToast(
            `${first.symbol} closed by ${first.reason} · ${first.pnl >= 0 ? '+' : '-'}${usd(Math.abs(first.pnl))}`,
          );
          await reloadTrades();
          onBalanceChanged?.();
        }
      } catch {
        /* ignore transient errors */
      }
    };

    pull();
    settle();
    const settleTimer = setInterval(settle, 5000);
    const timer = setInterval(pull, 4000);
    return () => {
      stopped = true;
      clearInterval(timer);
      clearInterval(settleTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol.symbol, myTrades, myInvestments]);


  const reloadTrades = useCallback(async () => {
    try {
      const res = await apiMyTrades();
      setMyTrades(res.trades);
    } catch {
      /* not signed in yet */
    }
  }, []);

  useEffect(() => {
    reloadTrades();
  }, [reloadTrades]);

  /**
   * Margin model, identical to the server:
   *   units    = amount / price          (0.1 BTC for $6,000 at $60,000)
   *   notional = units x price           = the amount entered
   *   margin   = notional x marginRate%  (per asset class, set by the desk)
   *   P/L      = (current - entry) x units x direction
   *   liquidation = the price where the loss eats the whole margin
   */
  useEffect(() => {
    let stop = false;
    const pull = async () => {
      try {
        const b = await apiOrderBook(symbol.symbol);
        if (!stop) {
          setBook({
            bids: b.bids || [],
            asks: b.asks || [],
            supported: b.supported !== false,
            reason: b.reason,
          });
        }
      } catch {
        if (!stop) setBook({ bids: [], asks: [], supported: true });
      }
    };
    pull();
    const t = setInterval(pull, 3000);
    return () => { stop = true; clearInterval(t); };
  }, [symbol.symbol]);

  useEffect(() => {
    apiMarginRates()
      .then(r => setMarginRates(r.rates))
      .catch(() => undefined);
  }, []);

  const usedMargin = myTrades
    .filter(t => t.status === 'OPEN')
    .reduce((sum, t) => sum + (Number(t.margin) || 0), 0);

  const openPnl = myTrades
    .filter(t => t.status === 'OPEN')
    .reduce((sum, t) => sum + livePnlOf(t, livePrices[t.symbol] || 0), 0);
  const equity = investorBalance + openPnl;

  const refPrice = livePrices[symbol.symbol] || 0;

  // Requirement for the instrument currently selected
  const marginRate = Number(marginRates[symbol.category]) || Number(marginRates.Other) || 10;
  const impliedLeverage = marginRate > 0 ? 100 / marginRate : 1;
  const orderUnits = refPrice > 0 ? amount / refPrice : 0;
  const orderMargin = (amount * marginRate) / 100;

  const freeMargin = Math.round(equity - usedMargin - orderMargin);
  const marginLevel =
    usedMargin + orderMargin > 0 ? (equity / (usedMargin + orderMargin)) * 100 : 0;

  const liquidationPrice =
    refPrice > 0 && orderUnits > 0
      ? side === 'buy'
        ? Math.max(0, refPrice - orderMargin / orderUnits)
        : refPrice + orderMargin / orderUnits
      : 0;

  const requiredMargin = orderMargin;
  const availableForMargin = investorBalance + openPnl - usedMargin;
  const canAfford = requiredMargin > 0 && requiredMargin <= availableForMargin;

  // Protective levels must sit on the correct side of the entry price
  const slNum = stopLoss.trim() === '' ? null : Number(stopLoss);
  const tpNum = takeProfit.trim() === '' ? null : Number(takeProfit);
  const protectionError = (() => {
    if (!(refPrice > 0)) return null;
    if (slNum !== null && Number.isFinite(slNum)) {
      if (side === 'buy' && slNum >= refPrice) return 'Stop loss must be below the current price';
      if (side === 'sell' && slNum <= refPrice) return 'Stop loss must be above the current price';
    }
    if (tpNum !== null && Number.isFinite(tpNum)) {
      if (side === 'buy' && tpNum <= refPrice) return 'Take profit must be above the current price';
      if (side === 'sell' && tpNum >= refPrice) return 'Take profit must be below the current price';
    }
    return null;
  })();

  const [toast, setToast] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [msgLog, setMsgLog] = useState<{ me: boolean; text: string }[]>([]);
  const [callRequested, setCallRequested] = useState(false);
  const [callRequesting, setCallRequesting] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  /**
   * Headline figures come from the positions that actually exist on the
   * server. They used to read from `myInvestments`, which is empty now that
   * demo data is gone — that is why every card was stuck at $0.
   */
  const openTrades = myTrades.filter(t => t.status === 'OPEN');
  const totalInvested = openTrades.reduce((s, t) => s + Number(t.amount || 0), 0);
  const totalAccrued = openPnl;
  const walletsValue = WALLETS.reduce((s, w) => s + w.qty * w.price, 0);
  // Equity = cash + margin locked in open positions + unrealised P/L
  const portfolioValue = investorBalance + usedMargin + openPnl + walletsValue;

  return (
    <div className="flex min-h-screen bg-[#0a0b0e] text-slate-200">
      {/* ============ SIDEBAR (as in PDF client screens) ============ */}
      <aside className="w-[230px] shrink-0 bg-[#0f1116] border-r border-white/[.06] hidden lg:flex flex-col sticky top-0 h-screen">
        <div className="px-4 py-4 flex items-center gap-2.5 border-b border-white/[.06]">
          <div className="w-9 h-9 rounded-full bg-[#f5b400] flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-[#17190f]" />
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-extrabold text-white">Oak Haven <span className="text-[#B08B48]">Yield</span></div>
            <div className="text-[9px] font-bold text-[#f5b400] tracking-widest">CLIENT</div>
          </div>
        </div>

        <div className="px-4 py-4 flex items-center gap-3 border-b border-white/[.06]">
          <div className="w-9 h-9 rounded-full bg-[#f5b400] text-[#17190f] font-extrabold flex items-center justify-center">{initials}</div>
          <div className="leading-tight">
            <div className="text-[13px] font-bold text-white">{shortName}</div>
            <div className="text-[9px] font-bold text-slate-500 tracking-widest">CLIENT</div>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {NAV.map(n => {
            const Icon = n.icon;
            return (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all cursor-pointer ${
                  tab === n.id ? 'bg-[#f5b400]/12 text-[#f5b400]' : 'text-slate-400 hover:text-white hover:bg-white/[.05]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {n.label}
              </button>
            );
          })}
          <button
            onClick={() => onLogout?.()}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-slate-500 hover:text-rose-400 hover:bg-white/[.05] cursor-pointer mt-2"
          >
            <LogOut className="w-4 h-4" /> Log out
          </button>
        </nav>
      </aside>

      {/* ============ CONTENT ============ */}
      <div className="flex-1 min-w-0 p-5 space-y-5">
        {/* header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              {NAV.find(n => n.id === tab)?.label}
            </h1>
            <p className="text-[12px] text-slate-500 mt-0.5 flex items-center gap-2">
              Welcome back, {firstName}
              {kycVerified ? (
                <Badge tone="green">
                  <ShieldCheck className="w-3 h-3" /> KYC verified
                </Badge>
              ) : (
                <Badge tone="gold">
                  <ShieldCheck className="w-3 h-3" /> KYC not verified
                </Badge>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Btn variant="gold" icon={Wallet} onClick={onOpenDepositModal}>
              Deposit
            </Btn>
            <Btn variant="ghost" icon={ArrowUpRight} onClick={onOpenWithdrawModal}>
              Withdraw
            </Btn>
          </div>
        </div>

        {/* ================= DASHBOARD ================= */}
        {tab === 'dashboard' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Kpi icon={Wallet} label="Available balance" value={usd(investorBalance)} tone="green" />
              <Kpi icon={Layers} label="Portfolio value" value={usd(portfolioValue)} />
              <Kpi icon={TrendingUp} label="Invested" value={usd(totalInvested)} tone="blue" />
              <Kpi
                icon={DollarSign}
                label="Live P/L"
                value={`${totalAccrued >= 0 ? '+' : '-'}${usd(Math.abs(totalAccrued))}`}
                tone={totalAccrued >= 0 ? 'green' : 'red'}
              />
            </div>

            {/* Wallets — PDF p.7 */}
            <Card
              title="Wallets"
              subtitle="Value, average price and PnL in one panel"
              actions={
                <div className="text-right">
                  <div className="text-[10px] text-slate-500 uppercase">Total portfolio</div>
                  <div className="text-[17px] font-extrabold text-[#f5b400]">
                    {usd(portfolioValue)}
                  </div>
                </div>
              }
            >
              {WALLETS.length === 0 && (
                <div className="p-10 text-center">
                  <div className="text-[13px] text-slate-500">No wallets yet</div>
                  <div className="text-[12px] text-slate-600 mt-1">
                    Your holdings appear here once your first deposit is credited.
                  </div>
                  <div className="mt-4">
                    <Btn variant="gold" icon={Wallet} onClick={onOpenDepositModal}>
                      Make a deposit
                    </Btn>
                  </div>
                </div>
              )}
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                {WALLETS.map(w => (
                  <div key={w.sym} className="bg-[#1b1e26] border border-white/[.06] rounded-2xl p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-[14px] font-extrabold text-white">{w.sym}</div>
                        <div className="text-[11px] text-slate-500">{w.name}</div>
                      </div>
                      <Badge tone={w.pnl >= 0 ? 'green' : 'red'}>
                        {w.pnl >= 0 ? '+' : ''}
                        {w.pct.toFixed(2)}%
                      </Badge>
                    </div>
                    <div className="text-[17px] font-extrabold text-emerald-400 mt-3">{w.qty} {w.sym}</div>
                    <div className="text-[12px] text-slate-400">≈ ${(w.qty * w.price).toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
                    <div className="flex justify-between text-[11px] text-slate-500 mt-2.5 pt-2.5 border-t border-white/[.05]">
                      <span>Avg. price ${w.avg.toLocaleString('en-US')}</span>
                      <span className={w.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        PnL {w.pnl >= 0 ? '+' : ''}${w.pnl.toLocaleString('en-US')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Active investments */}
            <Card title="Active positions" subtitle="Your running investments and accruals">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-white/[.02] border-b border-white/[.06]">
                    <tr>
                      <Th>Asset</Th>
                      <Th>Amount</Th>
                      <Th>Entry price</Th>
                      <Th>Current price</Th>
                      <Th>APR</Th>
                      <Th>Next payout</Th>
                      <Th>Accrued</Th>
                      <Th className="text-right">Action</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[.05]">
                    {myInvestments.length === 0 && (
                      <tr>
                        <Td className="py-10 text-center text-slate-600">
                          No positions yet.{' '}
                          <button onClick={onOpenCatalog} className="text-[#f5b400] cursor-pointer">
                            Browse markets
                          </button>
                        </Td>
                      </tr>
                    )}
                    {myInvestments.map(inv => (
                      <tr key={inv.id} className="hover:bg-white/[.02]">
                        <Td>
                          <div className="font-semibold text-white">{inv.projectTitle}</div>
                          <div className="text-[11px] text-slate-500">{inv.categoryLabel}</div>
                        </Td>
                        <Td className="font-bold text-white">${inv.amount.toLocaleString('en-US')}</Td>
                        <Td className="font-mono text-[12px] text-slate-300">
                          {inv.entryPrice ? `$${inv.entryPrice.toLocaleString('en-US')}` : '—'}
                        </Td>
                        <Td className="font-mono text-[12px]">
                          {livePrices[inv.projectTitle] ? (
                            <span
                              className={
                                livePrices[inv.projectTitle] >= (inv.entryPrice || 0)
                                  ? 'text-emerald-400'
                                  : 'text-rose-400'
                              }
                            >
                              ${livePrices[inv.projectTitle].toLocaleString('en-US', { maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </Td>
                        <Td className="text-[#f5b400] font-bold">{inv.apr}%</Td>
                        <Td className="text-[12px]">{inv.nextPayoutDate}</Td>
                        <Td className="text-emerald-400 font-bold">+${inv.accruedProfit.toLocaleString('en-US')}</Td>
                        <Td className="text-right">
                          <Btn size="sm" variant="gold" onClick={() => onClaimDividends(inv.id, inv.accruedProfit)}>
                            Claim profit
                          </Btn>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ================= TRADING TERMINAL (TradingView) ================= */}
        {tab === 'trading' && (
          <div className="space-y-4">
            {/* Asset category switcher */}
            <div className="flex flex-wrap gap-2">
              {ASSET_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => {
                    setCategory(cat);
                    const first = INSTRUMENTS.find(i => i.category === cat);
                    if (first) setSymbol(first);
                  }}
                  className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-all cursor-pointer border ${
                    category === cat
                      ? 'bg-[#f5b400] text-[#17190f] border-[#f5b400]'
                      : 'bg-white/[.04] text-slate-400 border-white/[.08] hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
              {/* Instrument list — live search across every TradingView asset */}
              <Card
                title={instrumentQuery ? 'Search results' : category}
                subtitle={instrumentQuery ? `“${instrumentQuery}”` : 'Select an instrument'}
                className="xl:col-span-1"
              >
                <div className="p-3">
                  <div className="relative mb-2">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      placeholder="Search any asset — AAPL, gold, BTC…"
                      value={instrumentQuery}
                      onChange={e => setInstrumentQuery(e.target.value)}
                      className="w-full pl-9 pr-8"
                    />
                    {instrumentQuery && (
                      <button
                        onClick={() => setInstrumentQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white cursor-pointer"
                        title="Clear"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {searching && (
                    <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-slate-500">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching…
                    </div>
                  )}

                  {!searching && instrumentQuery && visibleInstruments.length === 0 && (
                    <div className="px-3 py-6 text-center text-[12px] text-slate-600">
                      Nothing found for “{instrumentQuery}”
                    </div>
                  )}

                  <div className="space-y-1 max-h-[520px] overflow-y-auto">
                    {visibleInstruments.map(i => (
                      <button
                        key={i.tv}
                        onClick={() => setSymbol(i)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors cursor-pointer border ${
                          symbol.tv === i.tv
                            ? 'bg-[#f5b400]/[.1] border-[#f5b400]/30'
                            : 'bg-transparent border-transparent hover:bg-white/[.04]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-bold text-white">{i.symbol}</span>
                          <span className="text-[9px] text-slate-600 uppercase shrink-0">{i.exchange}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">{i.name}</div>
                        <div className="text-[9px] text-slate-600 mt-0.5">{i.kind}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Live chart */}
              <Card className="xl:col-span-3 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[16px] font-extrabold text-white">{symbol.symbol}</div>
                    <div className="text-[11px] text-slate-500">
                      {symbol.name} · {symbol.exchange}
                    </div>
                  </div>
                  <Badge tone="gold">{symbol.kind}</Badge>
                </div>
                <AdvancedChart symbol={symbol.tv} height={470} />
              </Card>
            </div>

            {/* Order ticket + open positions */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <Card title="New order" subtitle={symbol.symbol}>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSide('buy')}
                      className={`py-2 rounded-xl text-[12px] font-bold cursor-pointer ${
                        side === 'buy' ? 'bg-emerald-500 text-white' : 'bg-white/[.05] text-slate-400'
                      }`}
                    >
                      Buy / Long
                    </button>
                    <button
                      onClick={() => setSide('sell')}
                      className={`py-2 rounded-xl text-[12px] font-bold cursor-pointer ${
                        side === 'sell' ? 'bg-rose-500 text-white' : 'bg-white/[.05] text-slate-400'
                      }`}
                    >
                      Sell / Short
                    </button>
                  </div>

                  <div className="flex gap-1.5">
                    {(['market', 'limit', 'stop'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setOrderType(t)}
                        className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold capitalize cursor-pointer ${
                          orderType === t ? 'bg-[#f5b400]/20 text-[#f5b400]' : 'bg-white/[.05] text-slate-500'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  {orderType !== 'market' && (
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-bold">
                        Trigger price
                      </label>
                      <Input
                        type="number"
                        placeholder={
                          refPrice > 0
                            ? orderType === 'limit'
                              ? side === 'buy' ? `below ${refPrice.toFixed(2)}` : `above ${refPrice.toFixed(2)}`
                              : side === 'buy' ? `above ${refPrice.toFixed(2)}` : `below ${refPrice.toFixed(2)}`
                            : 'Order price'
                        }
                        value={triggerPrice}
                        onChange={e => setTriggerPrice(e.target.value)}
                        className="w-full mt-1"
                      />
                      <p className="text-[10px] text-slate-600 mt-1">
                        The order waits until the market reaches this price.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] text-slate-500 uppercase font-bold">Amount, $</label>
                    <Input
                      type="number"
                      value={amount}
                      onChange={e => setAmount(Number(e.target.value))}
                      className="w-full mt-1"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] bg-white/[.03] border border-white/[.06] rounded-lg px-3 py-2">
                    <span className="text-slate-500">
                      Margin requirement · {symbol.category}
                    </span>
                    <span className="text-slate-200 font-semibold">
                      {marginRate}% <span className="text-slate-500">({impliedLeverage.toFixed(0)}:1)</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Stop loss</label>
                      <Input
                        type="number"
                        placeholder={refPrice > 0 ? (side === 'buy' ? `< ${refPrice.toFixed(2)}` : `> ${refPrice.toFixed(2)}`) : '—'}
                        value={stopLoss}
                        onChange={e => setStopLoss(e.target.value)}
                        className="w-full mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Take profit</label>
                      <Input
                        type="number"
                        placeholder={refPrice > 0 ? (side === 'buy' ? `> ${refPrice.toFixed(2)}` : `< ${refPrice.toFixed(2)}`) : '—'}
                        value={takeProfit}
                        onChange={e => setTakeProfit(e.target.value)}
                        className="w-full mt-1"
                      />
                    </div>
                  </div>

                  {protectionError && (
                    <div className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/25 rounded-lg px-2.5 py-1.5">
                      {protectionError}
                    </div>
                  )}

                  {/* Margin summary — standard formulas, overridable by an admin later */}
                  <div className="space-y-1.5 pt-2 mt-1 border-t border-white/[.06]">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Position size</span>
                      <span className="text-white font-bold">
                        {refPrice > 0
                          ? `${(amount / refPrice).toLocaleString('en-US', { maximumFractionDigits: 6 })} ${baseOf(symbol.symbol)}`
                          : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Position value</span>
                      <span className="text-slate-200">{usd(amount)}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Required margin</span>
                      <span className="text-slate-200">{usd(requiredMargin)}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Free margin</span>
                      <span className={freeMargin >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        ${freeMargin.toLocaleString('en-US')}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Margin level</span>
                      <span
                        className={
                          marginLevel >= 200
                            ? 'text-emerald-400'
                            : marginLevel >= 100
                            ? 'text-[#f5b400]'
                            : 'text-rose-400'
                        }
                      >
                        {marginLevel <= 0
                          ? '—'
                          : marginLevel >= 10000
                          // Anything past this point only means "plenty of room"
                          ? '>9999%'
                          : `${marginLevel.toFixed(0)}%`}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Est. liquidation</span>
                      <span className="text-rose-400 font-mono">
                        {liquidationPrice ? liquidationPrice.toFixed(2) : '—'}
                      </span>
                    </div>
                    {marginLevel > 0 && marginLevel < 100 && (
                      <div className="text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-2.5 py-1.5 mt-1">
                        Margin call — add funds or reduce the position.
                      </div>
                    )}
                  </div>

                  {!canAfford && (
                    <div className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-lg px-2.5 py-2 flex items-start gap-2">
                      <Wallet className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>
                        {availableForMargin <= 0
                          ? 'Your balance is empty. Make a deposit before opening a position.'
                          : `Not enough free margin. This order needs $${requiredMargin.toLocaleString('en-US', { maximumFractionDigits: 2 })}, you have $${Math.max(0, availableForMargin).toLocaleString('en-US', { maximumFractionDigits: 2 })}.`}
                      </span>
                    </div>
                  )}

                  <button
                    disabled={placing || !canAfford || !!protectionError}
                    onClick={async () => {
                      setPlacing(true);
                      try {
                        // Stamp the live market price so "Entry" is never empty
                        let entry = livePrices[symbol.symbol] || 0;
                        if (!entry) {
                          try {
                            const q = await apiQuote(symbol.symbol);
                            entry = q.price || 0;
                          } catch {
                            entry = 0;
                          }
                        }
                        await apiOpenTrade({
                          symbol: symbol.symbol,
                          tv: symbol.tv,
                          name: symbol.name,
                          category: symbol.category,
                          side: side === 'buy' ? 'LONG' : 'SHORT',
                          // Dollar value; the server converts it into units
                          notional: amount,
                          amount,
                          entryPrice: entry,
                          orderType,
                          triggerPrice: orderType === 'market' ? null : Number(triggerPrice) || 0,
                          stopLoss: slNum,
                          takeProfit: tpNum,
                          openedAt: new Date().toISOString(),
                        });
                        await reloadTrades();
                        setStopLoss('');
                        setTakeProfit('');
                        setTriggerPrice('');
                        setToast(
                          orderType === 'market'
                            ? `${side === 'buy' ? 'Long' : 'Short'} position opened on ${symbol.symbol}`
                            : `${orderType === 'limit' ? 'Limit' : 'Stop'} order placed — waiting for ${triggerPrice}`,
                        );
                      } catch (err) {
                        setToast(err instanceof Error ? err.message : 'Could not open the position');
                      } finally {
                        setPlacing(false);
                      }
                    }}
                    className={`w-full py-2.5 rounded-xl text-[13px] font-bold text-white cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 ${
                      side === 'buy' ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-rose-500 hover:bg-rose-400'
                    }`}
                  >
                    {placing && <Loader2 className="w-4 h-4 animate-spin" />}
                    {!canAfford
                      ? 'Insufficient balance'
                      : orderType !== 'market'
                      ? `Place ${orderType} order`
                      : side === 'buy'
                      ? 'Open Long'
                      : 'Open Short'}
                  </button>
                </div>
              </Card>

              {/* Live order book straight from the exchange */}
              <Card title="Order book" subtitle={`${symbol.symbol} · live depth`}>
                <div className="p-4">
                  {book.asks.length === 0 && book.bids.length === 0 ? (
                    <div className="py-10 text-center space-y-2">
                      <div className="text-[12px] text-slate-500">
                        {book.supported
                          ? 'Depth is loading…'
                          : 'Live depth is available for crypto markets'}
                      </div>
                      {!book.supported && (
                        <div className="text-[11px] text-slate-600 max-w-[220px] mx-auto leading-relaxed">
                          Stocks, indices, metals and FX trade on venues that do not publish a
                          free public order book. Prices and charts still update live.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-0.5">
                        {[...book.asks].slice(0, 6).reverse().map((a, i) => (
                          <div key={`a${i}`} className="flex justify-between text-[11px] font-mono">
                            <span className="text-rose-400">{a.price.toLocaleString('en-US')}</span>
                            <span className="text-slate-500">{a.size.toFixed(4)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="text-center text-[13px] font-bold text-white border-y border-white/[.06] py-1.5">
                        {refPrice > 0 ? refPrice.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}
                      </div>
                      <div className="space-y-0.5">
                        {book.bids.slice(0, 6).map((b2, i) => (
                          <div key={`b${i}`} className="flex justify-between text-[11px] font-mono">
                            <span className="text-emerald-400">{b2.price.toLocaleString('en-US')}</span>
                            <span className="text-slate-500">{b2.size.toFixed(4)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Limit / stop orders waiting for their price */}
              {myTrades.some(t => t.status === 'PENDING') && (
                <Card title="Pending orders" subtitle="Waiting for the market to reach the trigger">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-white/[.02] border-b border-white/[.06]">
                        <tr>
                          <Th>Pair</Th><Th>Type</Th><Th>Side</Th>
                          <Th>Trigger</Th><Th>Size</Th><Th className="text-right">Action</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[.05]">
                        {myTrades.filter(t => t.status === 'PENDING').map(t => (
                          <tr key={t.id} className="hover:bg-white/[.02]">
                            <Td className="font-semibold text-white">{t.symbol}</Td>
                            <Td><Badge tone="gold">{t.orderType}</Badge></Td>
                            <Td><Badge tone={t.side === 'SHORT' ? 'red' : 'green'}>{t.side}</Badge></Td>
                            <Td className="font-mono text-[12px]">{Number(t.triggerPrice).toLocaleString('en-US')}</Td>
                            <Td className="text-[12px]">{usd(Number(t.notional) || 0)}</Td>
                            <Td className="text-right">
                              <Btn
                                size="sm"
                                variant="danger"
                                onClick={async () => {
                                  await apiCloseTrade(t.id);
                                  await reloadTrades();
                                  onBalanceChanged?.();
                                  setToast('Order cancelled');
                                }}
                              >
                                Cancel
                              </Btn>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              <Card title="Open positions" className="xl:col-span-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-white/[.02] border-b border-white/[.06]">
                      <tr>
                        <Th>Pair</Th>
                        <Th>Side</Th>
                        <Th>Position size</Th>
                        <Th>Margin</Th>
                        <Th>Entry</Th>
                        <Th>Opened</Th>
                        <Th>P/L</Th>
                        <Th className="text-right">Action</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[.05]">
                      {myTrades.filter(t => t.status === 'OPEN').length === 0 && (
                        <tr>
                          <Td className="py-8 text-center text-slate-600">
                            No open positions yet — place your first order on the left.
                          </Td>
                        </tr>
                      )}
                      {myTrades
                        .filter(t => t.status === 'OPEN')
                        .map(t => {
                          // Recompute from the live quote so the number ticks
                          const live = livePrices[t.symbol] || 0;
                          const entry = Number(t.entryPrice) || 0;
                          const livePnl = livePnlOf(t, live);
                          // Size in units of the asset, e.g. 0.1 BTC
                          const positionUnits = unitsOf(t);
                          const notional = positionUnits * (live > 0 ? live : entry);
                          const fmt = (v: number) =>
                            v >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : v.toPrecision(6);
                          return (
                          <tr key={t.id} className="hover:bg-white/[.02]">
                            <Td className="font-semibold text-white">{t.symbol}</Td>
                            <Td>
                              <Badge tone={t.side === 'LONG' ? 'green' : t.side === 'SHORT' ? 'red' : 'blue'}>
                                {t.side}
                              </Badge>
                            </Td>
                            <Td className="font-mono text-[12px]">
                              {positionUnits > 0 ? (
                                <>
                                  <span className="text-white">
                                    {positionUnits.toLocaleString('en-US', { maximumFractionDigits: 6 })}
                                  </span>{' '}
                                  <span className="text-slate-500">{baseOf(t.symbol)}</span>
                                  <div className="text-[10px] text-slate-500">
                                    {usd(notional)}
                                  </div>
                                </>
                              ) : (
                                '—'
                              )}
                            </Td>
                            <Td className="text-[12px]">
                              {usd(Number(t.margin) || 0)}
                              {t.marginRate ? (
                                <div className="text-[10px] text-slate-500">{t.marginRate}%</div>
                              ) : null}
                            </Td>
                            <Td className="font-mono text-[12px]">{entry > 0 ? fmt(entry) : '—'}</Td>
                            <Td className="text-[12px] text-slate-400">
                              {t.openedAt
                                ? new Date(t.openedAt).toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '—'}
                            </Td>
                            <Td className={livePnl >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                              {livePnl >= 0 ? '+' : '-'}${Math.abs(livePnl).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                            </Td>
                            <Td className="text-right">
                              <Btn
                                size="sm"
                                variant="danger"
                                onClick={async () => {
                                  const res = await apiCloseTrade(t.id);
                                  await reloadTrades();
                                  // Closing settles the P/L into the cash
                                  // balance, so pull the new figure in
                                  onBalanceChanged?.();
                                  const settled = Number(res?.trade?.pnl ?? 0);
                                  setToast(
                                    `${t.symbol} closed · ${settled >= 0 ? '+' : '-'}${usd(Math.abs(settled))}`,
                                  );
                                }}
                              >
                                Close
                              </Btn>
                            </Td>
                          </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>
        )}


        {/* ================= STATISTICS (PDF p.17) ================= */}
        {tab === 'statistics' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Kpi icon={TrendingUp} label="Total PnL" value="$907.43" tone="green" hint="Better than 84% of traders" />
              <Kpi icon={BarChart3} label="Trading volume" value="$136,984.68" />
              <Kpi icon={Layers} label="Trades" value="22" tone="blue" />
              <Kpi icon={DollarSign} label="Win rate" value="45.5%" tone="gold" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card title="Profit / loss dynamics">
                <div className="p-5">
                  <svg viewBox="0 0 400 140" className="w-full h-44">
                    <defs>
                      <linearGradient id="pl" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f5b400" stopOpacity=".45" />
                        <stop offset="100%" stopColor="#f5b400" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0,120 L50,110 L100,118 L150,84 L200,92 L250,54 L300,62 L350,28 L400,16 L400,140 L0,140 Z" fill="url(#pl)" />
                    <path d="M0,120 L50,110 L100,118 L150,84 L200,92 L250,54 L300,62 L350,28 L400,16" fill="none" stroke="#f5b400" strokeWidth="2.5" />
                  </svg>
                </div>
              </Card>
              <Card title="Distribution by markets">
                <div className="p-5 space-y-3">
                  {[
                    { m: 'Crypto', v: 62, c: '#f5b400' },
                    { m: 'Forex', v: 21, c: '#22c55e' },
                    { m: 'Metals', v: 11, c: '#3b82f6' },
                    { m: 'Indices', v: 6, c: '#a855f7' },
                  ].map(r => (
                    <div key={r.m}>
                      <div className="flex justify-between text-[12px] mb-1">
                        <span className="text-slate-300">{r.m}</span>
                        <span className="text-slate-500">{r.v}%</span>
                      </div>
                      <div className="h-2 bg-white/[.06] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${r.v}%`, background: r.c }} />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
            <Card title="PDF statement" subtitle="Download your trading report">
              <div className="p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Select defaultValue="Last month">
                    <option>Last week</option>
                    <option>Last month</option>
                    <option>Last year</option>
                  </Select>
                  <span className="text-[12px] text-slate-500">12.06.2026 — 12.07.2026</span>
                </div>
                <Btn variant="gold" icon={Download} onClick={() => setToast('PDF statement is being generated…')}>
                  Download PDF
                </Btn>
              </div>
            </Card>
          </div>
        )}

        {/* ================= SIMPLE TABS ================= */}
        {tab === 'withdrawals' && (
          <div className="space-y-4">
            <Card title="Withdraw funds" subtitle="Reviewed by compliance before release">
              <div className="p-5 space-y-4 max-w-lg">
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-bold uppercase text-slate-500">Available</span>
                  <span className="text-[20px] font-extrabold text-white">
                    ${investorBalance.toLocaleString('en-US')}
                  </span>
                </div>
                <p className="text-[12px] text-slate-500 leading-relaxed">
                  Submit a request and our compliance team will release the funds to your verified
                  payout details. Identity verification is required before the first withdrawal.
                </p>
                <Btn variant="gold" onClick={onOpenWithdrawModal}>
                  Request withdrawal
                </Btn>
              </div>
            </Card>

            <Card title="Withdrawal requests">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-white/[.02] border-b border-white/[.06]">
                    <tr>
                      <Th>Date</Th>
                      <Th>Amount</Th>
                      <Th>Destination</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[.05]">
                    {transactions.filter(t => t.type === 'withdrawal').length === 0 && (
                      <tr>
                        <Td className="py-10 text-center text-slate-600">No withdrawal requests yet.</Td>
                      </tr>
                    )}
                    {transactions
                      .filter(t => t.type === 'withdrawal')
                      .map(r => (
                        <tr key={r.id} className="hover:bg-white/[.02]">
                          <Td className="text-[12px]">
                            {new Date(r.createdAt).toLocaleString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </Td>
                          <Td className="font-bold text-white">
                            ${Number(r.amount).toLocaleString('en-US')}
                          </Td>
                          <Td className="text-[12px] text-slate-400 max-w-[220px] truncate">
                            {r.destination || '—'}
                          </Td>
                          <Td>
                            <Badge
                              tone={
                                r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'gold'
                              }
                            >
                              {r.status === 'pending' ? 'pending review' : r.status}
                            </Badge>
                          </Td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {tab === 'transactions' && (
          <Card title="Transaction history">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-white/[.02] border-b border-white/[.06]">
                  <tr>
                    <Th>Date</Th>
                    <Th>Type</Th>
                    <Th>Method</Th>
                    <Th>Amount</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[.05]">
                  {transactions.length === 0 && (
                    <tr>
                      <Td className="py-10 text-center text-slate-600">
                        No transactions yet.
                      </Td>
                    </tr>
                  )}
                  {transactions.map(r => {
                    const positive = r.type === 'deposit';
                    return (
                      <tr key={r.id} className="hover:bg-white/[.02]">
                        <Td className="text-[12px]">
                          {new Date(r.createdAt).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Td>
                        <Td className="font-semibold text-white capitalize">{r.type}</Td>
                        <Td className="text-[12px]">{r.method}</Td>
                        <Td className={positive ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                          {positive ? '+' : '-'}${Number(r.amount).toLocaleString('en-US')}
                        </Td>
                        <Td>
                          <Badge
                            tone={
                              r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'gold'
                            }
                          >
                            {r.status === 'pending' ? 'pending review' : r.status}
                          </Badge>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {tab === 'support' && (
          <Card title="Support chat" subtitle="Live chat with your personal manager">
            <div className="p-5 space-y-3 h-72 overflow-y-auto">
              <div className="max-w-[70%] bg-[#1b1e26] border border-white/[.06] rounded-2xl rounded-tl-sm px-4 py-2.5 text-[13px]">
                Good afternoon! How can I help you today?
                <div className="text-[10px] text-slate-600 mt-1">Manager · 11:02</div>
              </div>
              <div className="max-w-[70%] ml-auto bg-[#f5b400]/15 border border-[#f5b400]/25 rounded-2xl rounded-tr-sm px-4 py-2.5 text-[13px] text-[#f9d571]">
                Hi! I'd like to increase the leverage on my account.
                <div className="text-[10px] text-[#f5b400]/60 mt-1">You · 11:04</div>
              </div>
              {msgLog.map((m, i) => (
                <div
                  key={i}
                  className="max-w-[70%] ml-auto bg-[#f5b400]/15 border border-[#f5b400]/25 rounded-2xl rounded-tr-sm px-4 py-2.5 text-[13px] text-[#f9d571]"
                >
                  {m.text}
                  <div className="text-[10px] text-[#f5b400]/60 mt-1">You</div>
                </div>
              ))}
            </div>
            <form
              onSubmit={e => {
                e.preventDefault();
                if (!msg.trim()) return;
                setMsgLog(l => [...l, { me: true, text: msg.trim() }]);
                setMsg('');
              }}
              className="p-4 border-t border-white/[.06] flex gap-2"
            >
              <Input className="flex-1" placeholder="Type a message..." value={msg} onChange={e => setMsg(e.target.value)} />
              <Btn variant="gold" type="submit" disabled={!msg.trim()}>
                Send
              </Btn>
            </form>
          </Card>
        )}

        {tab === 'call' && (
          <Card title="Call your manager" subtitle="Direct WebRTC voice connection — no third-party apps">
            <div className="p-8 flex flex-col items-center text-center gap-4">
              <div className="w-20 h-20 rounded-full bg-[#f5b400]/15 border border-[#f5b400]/30 flex items-center justify-center">
                <PhoneCall className="w-9 h-9 text-[#f5b400]" />
              </div>
              <div>
                <div className="text-[16px] font-bold text-white">Your personal manager</div>
                <div className="text-[12px] text-slate-500">Online · answers within a few minutes</div>
              </div>
              <Btn
                variant="gold"
                icon={PhoneCall}
                disabled={callRequested}
                onClick={async () => {
                  try {
                    setCallRequesting(true);
                    await apiRequestCall();
                    setCallRequested(true);
                    setToast('✔ Request sent — a manager will call you shortly.');
                  } catch {
                    setToast('✖ Could not send the request, try again.');
                  } finally {
                    setCallRequesting(false);
                  }
                }}
              >
                {callRequesting ? 'Sending…' : callRequested ? 'Request sent' : 'Request a call'}
              </Btn>
              <p className="text-[11px] text-slate-600 max-w-sm">
                Your manager calls you from the back office — you will see the caller name
                on your screen and can accept or decline. During the call they can share
                their screen to guide you through the platform.
              </p>
            </div>
          </Card>
        )}

        {tab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="Personal information">
              <div className="p-5 space-y-3.5 max-w-md">
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-500">Full name</label>
                  <Input key={fullName} defaultValue={fullName} className="w-full mt-1.5" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-500">E-mail</label>
                  <Input key={user?.email || 'email'} defaultValue={user?.email || ''} className="w-full mt-1.5" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-500">Phone</label>
                  <Input placeholder="+1 (555) 000-0000" className="w-full mt-1.5" />
                </div>
                <Btn variant="gold" onClick={() => setToast('Profile updated successfully')}>
                  Save changes
                </Btn>
              </div>
            </Card>
            <Card title="Security">
              <div className="p-5 space-y-3.5 max-w-md">
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-500">Current password</label>
                  <Input type="password" defaultValue="********" className="w-full mt-1.5" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-500">New password</label>
                  <Input type="password" placeholder="Minimum 6 characters" className="w-full mt-1.5" />
                </div>
                <Btn variant="ghost" onClick={() => setToast('Password changed successfully')}>
                  Change password
                </Btn>

              </div>
            </Card>
            <div className="lg:col-span-2">
              <VerifyIdentity onNotify={setToast} />
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-[#14161c] border border-[#f5b400]/40 rounded-xl px-4 py-3 shadow-2xl shadow-black/60">
          <div className="w-2 h-2 rounded-full bg-[#f5b400]" />
          <span className="text-[13px] text-slate-100">{toast}</span>
        </div>
      )}
    </div>
  );
};
