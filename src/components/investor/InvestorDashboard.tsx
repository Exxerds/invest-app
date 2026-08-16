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
import { apiSearchSymbols, apiMyTrades, apiOpenTrade, apiCloseTrade } from '../../api';
import type { ApiTrade } from '../../api';
import { INSTRUMENTS, ASSET_CATEGORIES } from '../../data/instruments';
import type { AssetCategory, Instrument } from '../../data/instruments';

interface InvestorDashboardProps {
  investorBalance: number;
  myInvestments: ActiveInvestment[];
  onOpenCatalog: () => void;
  onOpenDepositModal: () => void;
  onOpenWithdrawModal: () => void;
  onClaimDividends: (id: string, profit: number) => void;
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

/* Wallets — PDF page 7 "Full portfolio control" */
const WALLETS = [
  { sym: 'BTC', name: 'Bitcoin', qty: 0.199916, price: 64400.61, avg: 49941.24, pnl: 2891.46, pct: 20.36 },
  { sym: 'BNB', name: 'BNB', qty: 4.687804, price: 581.79, avg: 565.51, pnl: 76.32, pct: 2.88 },
  { sym: 'LINK', name: 'Chainlink', qty: 46.318116, price: 8.05, avg: 7.63, pnl: 19.13, pct: 5.4 },
  { sym: 'NEAR', name: 'NEAR Protocol', qty: 6145.891515, price: 1.91, avg: 1.86, pnl: 319.09, pct: 2.79 },
];

export const InvestorDashboard: React.FC<InvestorDashboardProps> = ({
  investorBalance,
  myInvestments,
  onOpenCatalog,
  onOpenDepositModal,
  onOpenWithdrawModal,
  onClaimDividends,
}) => {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop'>('market');
  const [amount, setAmount] = useState(500);
  const [leverage, setLeverage] = useState(10);
  const [category, setCategory] = useState<AssetCategory>('Crypto');
  const [symbol, setSymbol] = useState<Instrument>(INSTRUMENTS[0]);
  const [instrumentQuery, setInstrumentQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Instrument[]>([]);
  const [searching, setSearching] = useState(false);
  const [placing, setPlacing] = useState(false);

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
  const [toast, setToast] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [msgLog, setMsgLog] = useState<{ me: boolean; text: string }[]>([]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const totalInvested = myInvestments.reduce((s, i) => s + i.amount, 0);
  const totalAccrued = myInvestments.reduce((s, i) => s + i.accruedProfit, 0);
  const walletsValue = WALLETS.reduce((s, w) => s + w.qty * w.price, 0);
  const portfolioValue = investorBalance + totalInvested + totalAccrued + walletsValue;

  return (
    <div className="flex min-h-screen bg-[#0a0b0e] text-slate-200">
      {/* ============ SIDEBAR (as in PDF client screens) ============ */}
      <aside className="w-[230px] shrink-0 bg-[#0f1116] border-r border-white/[.06] hidden lg:flex flex-col sticky top-0 h-screen">
        <div className="px-4 py-4 flex items-center gap-2.5 border-b border-white/[.06]">
          <div className="w-9 h-9 rounded-full bg-[#f5b400] flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-[#17190f]" />
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-extrabold text-white">TradeNation</div>
            <div className="text-[9px] font-bold text-[#f5b400] tracking-widest">CLIENT</div>
          </div>
        </div>

        <div className="px-4 py-4 flex items-center gap-3 border-b border-white/[.06]">
          <div className="w-9 h-9 rounded-full bg-[#f5b400] text-[#17190f] font-extrabold flex items-center justify-center">A</div>
          <div className="leading-tight">
            <div className="text-[13px] font-bold text-white">Michael C.</div>
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
            onClick={() => window.location.reload()}
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
              Welcome back, Michael
              <Badge tone="green">
                <ShieldCheck className="w-3 h-3" /> KYC verified
              </Badge>
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
              <Kpi icon={Wallet} label="Available balance" value={`$${investorBalance.toLocaleString('en-US')}`} tone="green" />
              <Kpi icon={Layers} label="Portfolio value" value={`$${portfolioValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} />
              <Kpi icon={TrendingUp} label="Invested" value={`$${totalInvested.toLocaleString('en-US')}`} tone="blue" />
              <Kpi
                icon={DollarSign}
                label="Live P/L"
                value={`${totalAccrued >= 0 ? '+' : '-'}$${Math.abs(totalAccrued).toLocaleString('en-US')}`}
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
                    ${walletsValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </div>
                </div>
              }
            >
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
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Price</label>
                      <Input type="number" placeholder="Order price" className="w-full mt-1" />
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

                  <div>
                    <label className="text-[10px] text-slate-500 uppercase font-bold">Leverage: {leverage}x</label>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={leverage}
                      onChange={e => setLeverage(Number(e.target.value))}
                      className="w-full accent-[#f5b400] cursor-pointer mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Stop loss</label>
                      <Input placeholder="—" className="w-full mt-1" />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Take profit</label>
                      <Input placeholder="—" className="w-full mt-1" />
                    </div>
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                    <span>Position size</span>
                    <span className="text-white font-bold">${(amount * leverage).toLocaleString('en-US')}</span>
                  </div>

                  <button
                    disabled={placing}
                    onClick={async () => {
                      setPlacing(true);
                      try {
                        await apiOpenTrade({
                          symbol: symbol.symbol,
                          tv: symbol.tv,
                          name: symbol.name,
                          side: side === 'buy' ? 'LONG' : 'SHORT',
                          amount,
                          leverage,
                          entryPrice: 0,
                          pnl: 0,
                        });
                        await reloadTrades();
                        setToast(`${side === 'buy' ? 'Long' : 'Short'} position opened on ${symbol.symbol}`);
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
                    {side === 'buy' ? 'Open Long' : 'Open Short'}
                  </button>
                </div>
              </Card>

              <Card title="Open positions" className="xl:col-span-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-white/[.02] border-b border-white/[.06]">
                      <tr>
                        <Th>Pair</Th>
                        <Th>Side</Th>
                        <Th>Leverage</Th>
                        <Th>Entry</Th>
                        <Th>Mark</Th>
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
                        .map(t => (
                          <tr key={t.id} className="hover:bg-white/[.02]">
                            <Td className="font-semibold text-white">{t.symbol}</Td>
                            <Td>
                              <Badge tone={t.side === 'LONG' ? 'green' : t.side === 'SHORT' ? 'red' : 'blue'}>
                                {t.side}
                              </Badge>
                            </Td>
                            <Td>{t.leverage}x</Td>
                            <Td className="font-mono text-[12px]">{t.entryPrice || '—'}</Td>
                            <Td className="font-mono text-[12px]">{t.currentPrice || '—'}</Td>
                            <Td className={t.pnl >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                              {t.pnl >= 0 ? '+' : ''}${Math.abs(t.pnl).toLocaleString('en-US')}
                            </Td>
                            <Td className="text-right">
                              <Btn
                                size="sm"
                                variant="danger"
                                onClick={async () => {
                                  await apiCloseTrade(t.id);
                                  await reloadTrades();
                                  setToast(`Position ${t.symbol} closed`);
                                }}
                              >
                                Close
                              </Btn>
                            </Td>
                          </tr>
                        ))}
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
          <Card title="Withdrawal request" subtitle="Funds are processed within 24 hours">
            <div className="p-5 space-y-4 max-w-lg">
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-500">Amount, $</label>
                <Input type="number" defaultValue={1000} className="w-full mt-1.5" />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-500">Method</label>
                <Select className="w-full mt-1.5">
                  <option>USDT TRC-20</option>
                  <option>Bitcoin</option>
                  <option>Visa / Mastercard</option>
                  <option>SEPA transfer</option>
                </Select>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-500">Wallet / account</label>
                <Input placeholder="Enter destination address" className="w-full mt-1.5" />
              </div>
              <Btn variant="gold" onClick={onOpenWithdrawModal}>
                Request withdrawal
              </Btn>
            </div>
          </Card>
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
                  {[
                    { d: '2026-08-12', t: 'Deposit', m: 'USDT TRC-20', a: 10000, s: 'completed' },
                    { d: '2026-08-05', t: 'Withdrawal', m: 'Visa', a: -2500, s: 'completed' },
                    { d: '2026-07-28', t: 'Deposit', m: 'Bitcoin', a: 5000, s: 'completed' },
                    { d: '2026-07-14', t: 'Bonus', m: 'Promo', a: 250, s: 'completed' },
                  ].map(r => (
                    <tr key={r.d} className="hover:bg-white/[.02]">
                      <Td className="text-[12px]">{r.d}</Td>
                      <Td className="font-semibold text-white">{r.t}</Td>
                      <Td className="text-[12px]">{r.m}</Td>
                      <Td className={r.a >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {r.a >= 0 ? '+' : ''}${Math.abs(r.a).toLocaleString('en-US')}
                      </Td>
                      <Td>
                        <Badge tone="green">{r.s}</Badge>
                      </Td>
                    </tr>
                  ))}
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
                <div className="text-[16px] font-bold text-white">Laura Bennett</div>
                <div className="text-[12px] text-slate-500">Senior Advisor · online</div>
              </div>
              <Btn variant="gold" icon={PhoneCall} onClick={() => setToast('Calling Laura Bennett…')}>
                Start call
              </Btn>
              <p className="text-[11px] text-slate-600 max-w-sm">
                During the call your manager can share their screen to guide you through the platform.
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
                  <Input defaultValue="Michael Carter" className="w-full mt-1.5" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-500">E-mail</label>
                  <Input defaultValue="m.carter@northbridge-cap.com" className="w-full mt-1.5" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-500">Phone</label>
                  <Input defaultValue="+1 (415) 555-0182" className="w-full mt-1.5" />
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
