// ============================================================
//  TradeNation — LANDING
//  Design taken 1:1 from the client's PDF presentation (page 1):
//  dark surfaces (#0e0f13 / #16181f) + gold accent (#f5b400),
//  gold-highlighted hero headline, pill nav, gold CTA buttons.
//  Structure follows shorelinedirect.net-style trading landings:
//  hero → live markets → platform → conditions → account types
//  → why us → affiliate → documentation → news → contact.
// ============================================================
import React, { useState, useRef, useEffect } from 'react';
import { TickerTape, MarketOverview, MiniChart } from '../investor/TradingViewChart';
import {
  TrendingUp,
  ChevronDown,
  ArrowRight,
  ShieldCheck,
  Zap,
  Headphones,
  BarChart3,
  Wallet,
  Users,
  CheckCircle2,
  Bell,
  MonitorPlay,
  PhoneCall,
  FileText,
  Mail,
  MapPin,
  Phone,
  Layers,
  LineChart,
  Lock,
  Star,
} from 'lucide-react';

interface LandingPageProps {
  onOpenLoginModal: () => void;
  onOpenRegisterModal?: () => void;
}

const ACCOUNTS = [
  { name: 'Beginner', dep: '$250', spread: 'from 2.0', lev: '1:20', items: ['Personal manager', 'Basic education', 'Email support'] },
  { name: 'Silver', dep: '$2,500', spread: 'from 1.5', lev: '1:50', items: ['Everything in Beginner', 'Market reviews', 'Priority support'] },
  { name: 'Gold', dep: '$10,000', spread: 'from 1.0', lev: '1:100', items: ['Everything in Silver', 'Trading signals', 'Weekly strategy call'] },
  { name: 'Platinum', dep: '$50,000', spread: 'from 0.6', lev: '1:200', items: ['Everything in Gold', 'Senior advisor', 'Custom risk profile'] },
  { name: 'Diamond', dep: '$100,000+', spread: 'from 0.2', lev: '1:400', items: ['Everything in Platinum', 'VIP desk 24/7', 'Zero commission'] },
];

/** Trading dropdown items — mirrors the product modules from the PDF deck */
const TRADING_MENU: { label: string; hint: string; anchor: string; icon: React.ElementType }[] = [
  { label: 'Spot trading', hint: 'Buy and sell at market price', anchor: 'markets', icon: LineChart },
  { label: 'Futures', hint: 'Long & short with leverage', anchor: 'platform', icon: TrendingUp },
  { label: 'P2P exchange', hint: 'Peer-to-peer deals', anchor: 'platform', icon: Users },
  { label: 'Binary options', hint: 'Fixed-time contracts', anchor: 'platform', icon: Zap },
  { label: 'AI trading & staking', hint: 'Automated strategies', anchor: 'about', icon: Layers },
  { label: 'Account types', hint: 'Compare all five tiers', anchor: 'accounts', icon: Star },
];

const Section: React.FC<{ id?: string; className?: string; children: React.ReactNode }> = ({ id, className = '', children }) => (
  <section id={id} className={`py-20 px-5 ${className}`}>
    <div className="max-w-6xl mx-auto">{children}</div>
  </section>
);

const Eyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-[11px] font-extrabold tracking-[0.2em] text-[#f5b400] uppercase mb-3">{children}</div>
);

const H2: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <h2 className={`text-3xl md:text-[42px] leading-[1.1] font-extrabold text-white tracking-tight ${className}`}>{children}</h2>
);

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenLoginModal, onOpenRegisterModal }) => {
  const [tradingOpen, setTradingOpen] = useState(false);
  const tradingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (tradingRef.current && !tradingRef.current.contains(e.target as Node)) setTradingOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [leverage, setLeverage] = useState(10);
  const [amount, setAmount] = useState(1000);


  return (
    <div className="bg-[#0e0f13] text-slate-200">
      {/* ==================== NAVBAR ==================== */}
      <header className="sticky top-0 z-50 bg-[#0e0f13]/95 backdrop-blur border-b border-white/[.06]">
        <div className="max-w-6xl mx-auto px-5 h-[68px] flex items-center gap-8">
          <a href="#top" className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-full bg-[#f5b400] flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-[#17190f]" />
            </div>
            <span className="text-[19px] font-extrabold text-white tracking-tight">TradeNation</span>
          </a>

          <nav className="hidden lg:flex items-center gap-7 text-[14px] font-medium text-slate-300">
            <a href="#top" className="hover:text-white transition-colors">Home</a>
            <a href="#markets" className="hover:text-white transition-colors">Buy Crypto</a>
            {/* Trading dropdown — the PDF mock-up shows a caret here, so it opens a real menu */}
            <div className="relative" ref={tradingRef}>
              <button
                onClick={() => setTradingOpen(v => !v)}
                className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
              >
                Trading
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${tradingOpen ? 'rotate-180' : ''}`} />
              </button>

              {tradingOpen && (
                <div className="absolute left-0 top-full pt-3 z-50">
                  <div className="w-60 bg-[#16181f] border border-white/[.08] rounded-xl shadow-2xl shadow-black/60 py-1.5">
                    {TRADING_MENU.map(item => (
                      <button
                        key={item.label}
                        onClick={() => {
                          setTradingOpen(false);
                          document.getElementById(item.anchor)?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="w-full flex items-start gap-2.5 px-4 py-2.5 text-left hover:bg-white/[.06] cursor-pointer transition-colors group"
                      >
                        <item.icon className="w-4 h-4 text-[#f5b400] shrink-0 mt-0.5" />
                        <span>
                          <span className="block text-[13px] text-slate-200 group-hover:text-white font-semibold">
                            {item.label}
                          </span>
                          <span className="block text-[11px] text-slate-500">{item.hint}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <a href="#platform" className="hover:text-white transition-colors">P2P</a>
            <a href="#about" className="hover:text-white transition-colors">About Us</a>
          </nav>

          <div className="ml-auto flex items-center gap-2.5">
            <button
              onClick={onOpenLoginModal}
              className="px-4 py-2 rounded-xl bg-white/[.05] border border-white/[.1] text-[13px] font-semibold text-white hover:bg-white/[.1] transition-colors cursor-pointer"
            >
              Log in
            </button>
            <button
              onClick={onOpenRegisterModal || onOpenLoginModal}
              className="px-4 py-2 rounded-xl bg-[#f5b400] hover:bg-[#ffc21f] text-[#17190f] text-[13px] font-bold transition-colors cursor-pointer shadow-[0_6px_20px_-6px_rgba(245,180,0,.7)]"
            >
              Register
            </button>
          </div>
        </div>
      </header>

      {/* Live ticker strip (TradingView) */}
      <div className="border-b border-white/[.06] bg-[#0b0c10]">
        <TickerTape />
      </div>

      {/* ==================== HERO ==================== */}
      <div id="top" className="relative overflow-hidden border-b border-white/[.06]">
        <div
          className="absolute inset-0 opacity-[0.25]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 50% 0%, rgba(245,180,0,.28), transparent 55%), radial-gradient(circle at 10% 80%, rgba(245,180,0,.10), transparent 45%)',
          }}
        />
        <div className="relative max-w-4xl mx-auto px-5 py-24 md:py-28 text-center">
          <h1 className="text-[38px] md:text-[54px] leading-[1.08] font-extrabold tracking-tight">
            <span className="text-[#f5b400]">Earn on financial markets</span>
            <br />
            <span className="text-white">with TradeNation</span>
          </h1>
          <p className="mt-5 text-[15px] md:text-[17px] text-slate-400 max-w-2xl mx-auto leading-relaxed">
            A professional trading platform with access to global markets and a wide selection of instruments —
            crypto, forex, metals and indices in one account.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              onClick={onOpenRegisterModal || onOpenLoginModal}
              className="px-7 py-3 rounded-xl bg-[#f5b400] hover:bg-[#ffc21f] text-[#17190f] font-bold text-[15px] transition-all cursor-pointer shadow-[0_10px_30px_-8px_rgba(245,180,0,.8)]"
            >
              Start trading
            </button>
            <button
              onClick={onOpenLoginModal}
              className="px-7 py-3 rounded-xl bg-white/[.06] border border-white/[.12] text-white font-bold text-[15px] hover:bg-white/[.12] transition-all cursor-pointer"
            >
              Log in
            </button>
          </div>

          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
            {[
              { icon: Layers, t: '250+', s: 'Trading instruments' },
              { icon: Zap, t: '0.01s', s: 'Order execution' },
              { icon: Users, t: '48,000+', s: 'Active clients' },
              { icon: Headphones, t: '24/7', s: 'Personal support' },
            ].map(x => (
              <div key={x.t} className="bg-[#16181f] border border-white/[.07] rounded-2xl p-4">
                <x.icon className="w-5 h-5 text-[#f5b400]" />
                <div className="text-xl font-extrabold text-white mt-2.5">{x.t}</div>
                <div className="text-[11px] text-slate-500">{x.s}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ==================== LIVE MARKETS (TradingView) ==================== */}
      <Section id="markets">
        <div className="text-center max-w-2xl mx-auto mb-9">
          <Eyebrow>Live quotes</Eyebrow>
          <H2>Markets at a glance</H2>
          <p className="text-slate-400 mt-3 text-[15px]">
            Real-time prices across indices, crypto, forex and commodities — powered by live exchange data.
          </p>
        </div>

        <div className="bg-[#16181f] border border-white/[.07] rounded-2xl p-3 shadow-2xl shadow-black/40">
          <MarketOverview height={480} />
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { tv: 'BITSTAMP:BTCUSD', label: 'Bitcoin' },
            { tv: 'OANDA:XAUUSD', label: 'Gold' },
            { tv: 'FX:EURUSD', label: 'EUR / USD' },
          ].map(m => (
            <div key={m.tv} className="bg-[#16181f] border border-white/[.07] rounded-2xl p-3">
              <div className="text-[12px] font-bold text-slate-300 px-1.5 pb-1">{m.label}</div>
              <MiniChart symbol={m.tv} height={190} />
            </div>
          ))}
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={onOpenRegisterModal || onOpenLoginModal}
            className="px-7 py-3 rounded-xl bg-[#f5b400] hover:bg-[#ffc21f] text-[#17190f] font-bold text-[14px] cursor-pointer transition-colors"
          >
            Start trading these markets
          </button>
        </div>
      </Section>

      {/* ==================== WEB PLATFORM (PDF p.2, web only — no APK) ==================== */}
      <Section id="platform" className="bg-[#0b0c10] border-y border-white/[.06]">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <Eyebrow>Web platform</Eyebrow>
            <H2>The platform is always at hand</H2>
            <p className="text-slate-400 mt-4 text-[15px] leading-relaxed">
              A full-featured web terminal that works in any browser — no installation required. One account and the
              entire functionality on every device.
            </p>
            <div className="mt-7 space-y-4">
              {[
                { icon: Layers, t: 'One account, every device', s: 'Desktop, tablet and mobile browser share the same balance and positions' },
                { icon: Bell, t: 'Instant notifications', s: 'Price alerts, margin calls and manager messages in real time' },
                { icon: ShieldCheck, t: 'Under your brand', s: 'Name, logo and colour scheme adapt to the project' },
              ].map(f => (
                <div key={f.t} className="flex gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#f5b400]/12 flex items-center justify-center shrink-0">
                    <f.icon className="w-5 h-5 text-[#f5b400]" />
                  </div>
                  <div>
                    <div className="font-bold text-white text-[15px]">{f.t}</div>
                    <div className="text-[13px] text-slate-500 mt-0.5">{f.s}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive terminal preview — mirrors PDF page 6 */}
          <div className="bg-[#16181f] border border-white/[.08] rounded-2xl p-4 shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#f5b400] flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-[#17190f]" />
                </div>
                <span className="font-bold text-white text-[14px]">BTC/USDT</span>
                <span className="text-emerald-400 text-[13px] font-mono">64,337.56</span>
              </div>
              <div className="flex gap-1">
                {['1H', '1D', '1W', '1M'].map((p, i) => (
                  <span
                    key={p}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                      i === 3 ? 'bg-[#f5b400]/20 text-[#f5b400]' : 'bg-white/[.05] text-slate-500'
                    }`}
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>

            {/* candles */}
            <div className="bg-[#0e0f13] rounded-xl border border-white/[.06] p-3">
              <svg viewBox="0 0 320 120" className="w-full h-32">
                {Array.from({ length: 26 }).map((_, i) => {
                  const up = Math.sin(i * 1.7) > 0;
                  const h = 18 + Math.abs(Math.sin(i * 0.9)) * 46;
                  const y = 60 - h / 2 + Math.sin(i * 0.5) * 14;
                  return (
                    <g key={i}>
                      <line x1={i * 12 + 6} x2={i * 12 + 6} y1={y - 8} y2={y + h + 8} stroke={up ? '#22c55e' : '#ef4444'} strokeWidth="1" opacity=".65" />
                      <rect x={i * 12 + 2} y={y} width="8" height={h} rx="1" fill={up ? '#22c55e' : '#ef4444'} />
                    </g>
                  );
                })}
                <line x1="0" x2="320" y1="52" y2="52" stroke="#22c55e" strokeWidth="1" strokeDasharray="4 3" opacity=".8" />
              </svg>
            </div>

            {/* order book + ticket */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="bg-[#0e0f13] rounded-xl border border-white/[.06] p-3">
                <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">Order book</div>
                {[
                  [64339.69, 0.0001, 'r'],
                  [64339.24, 0.0544, 'r'],
                  [64338.89, 0.0008, 'r'],
                  [64337.56, 1.18, 'g'],
                  [64337.55, 2.06, 'g'],
                  [64337.54, 0.0685, 'g'],
                ].map(([p, v, c], i) => (
                  <div key={i} className="flex justify-between text-[10px] font-mono py-0.5">
                    <span className={c === 'r' ? 'text-rose-400' : 'text-emerald-400'}>{(p as number).toLocaleString('en-US')}</span>
                    <span className="text-slate-500">{v as number}</span>
                  </div>
                ))}
              </div>

              <div className="bg-[#0e0f13] rounded-xl border border-white/[.06] p-3">
                <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                  <button
                    onClick={() => setSide('buy')}
                    className={`py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                      side === 'buy' ? 'bg-emerald-500 text-white' : 'bg-white/[.05] text-slate-500'
                    }`}
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => setSide('sell')}
                    className={`py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                      side === 'sell' ? 'bg-rose-500 text-white' : 'bg-white/[.05] text-slate-500'
                    }`}
                  >
                    Sell
                  </button>
                </div>
                <label className="text-[10px] text-slate-500">Amount, $</label>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(Number(e.target.value))}
                  className="w-full mt-1 px-2.5 py-1.5 bg-[#16181f] border border-white/[.08] rounded-lg text-[12px] text-white focus:outline-none focus:border-[#f5b400]/50"
                />
                <label className="text-[10px] text-slate-500 mt-2 block">Leverage: {leverage}x</label>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={leverage}
                  onChange={e => setLeverage(Number(e.target.value))}
                  className="w-full accent-[#f5b400] mt-1 cursor-pointer"
                />
                <button
                  onClick={onOpenLoginModal}
                  className={`w-full mt-2.5 py-2 rounded-lg text-[12px] font-bold cursor-pointer ${
                    side === 'buy' ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-rose-500 hover:bg-rose-400'
                  } text-white`}
                >
                  {side === 'buy' ? 'Open Long' : 'Open Short'} · ${(amount * leverage).toLocaleString('en-US')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ==================== COMMUNICATION (PDF p.3) ==================== */}
      <Section>
        <div className="text-center max-w-2xl mx-auto mb-12">
          <Eyebrow>Communication</Eyebrow>
          <H2>All communication in one system</H2>
          <p className="text-slate-400 mt-3 text-[15px]">
            The main advantage of the platform is a developed communication layer with the client.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { icon: Bell, t: 'Push notifications', s: 'Instant delivery of messages to the client device, even with the tab closed' },
            { icon: Headphones, t: 'Online support', s: 'Live chat, file sharing and tickets inside the platform' },
            { icon: PhoneCall, t: 'WebRTC calls', s: 'Direct voice connection with the client without third-party services' },
          ].map(c => (
            <div key={c.t} className="bg-[#16181f] border border-white/[.07] rounded-2xl p-6 hover:border-[#f5b400]/30 transition-colors">
              <div className="w-12 h-12 rounded-2xl bg-[#f5b400]/12 flex items-center justify-center">
                <c.icon className="w-6 h-6 text-[#f5b400]" />
              </div>
              <h3 className="text-[17px] font-bold text-white mt-4">{c.t}</h3>
              <p className="text-[13.5px] text-slate-500 mt-2 leading-relaxed">{c.s}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ==================== TRADING CONDITIONS ==================== */}
      <Section className="bg-[#0b0c10] border-y border-white/[.06]">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <Eyebrow>Trading conditions</Eyebrow>
          <H2>Transparent and competitive</H2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { icon: LineChart, t: 'Spreads from 0.0', s: 'Raw market pricing on major pairs' },
            { icon: Zap, t: 'Leverage up to 1:400', s: 'Flexible margin per instrument' },
            { icon: Wallet, t: 'No deposit fees', s: 'Cards, SEPA, USDT and BTC' },
            { icon: Lock, t: 'Segregated funds', s: 'Client money held separately' },
          ].map(c => (
            <div key={c.t} className="bg-[#16181f] border border-white/[.07] rounded-2xl p-5">
              <c.icon className="w-6 h-6 text-[#f5b400]" />
              <div className="text-[15px] font-bold text-white mt-3">{c.t}</div>
              <div className="text-[12.5px] text-slate-500 mt-1">{c.s}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ==================== TRADING STATISTICS (PDF p.17-18) ==================== */}
      <Section>
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1 bg-[#16181f] border border-white/[.08] rounded-2xl p-5">
            <div className="text-[13px] font-bold text-white mb-3">Trading statistics</div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { l: 'Total PnL', v: '$907.43', c: 'text-emerald-400' },
                { l: 'Volume', v: '$136,984.68', c: 'text-white' },
                { l: 'Trades', v: '22', c: 'text-white' },
                { l: 'Win rate', v: '45.5%', c: 'text-[#f5b400]' },
              ].map(k => (
                <div key={k.l} className="bg-[#0e0f13] border border-white/[.06] rounded-xl p-3.5">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide">{k.l}</div>
                  <div className={`text-lg font-extrabold mt-1 ${k.c}`}>{k.v}</div>
                </div>
              ))}
            </div>
            <div className="bg-[#0e0f13] border border-white/[.06] rounded-xl p-3.5 mt-3">
              <div className="text-[10px] text-slate-500 uppercase mb-2">Profit / loss dynamics</div>
              <svg viewBox="0 0 300 70" className="w-full h-20">
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f5b400" stopOpacity=".5" />
                    <stop offset="100%" stopColor="#f5b400" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0,58 L40,52 L80,55 L120,40 L160,44 L200,26 L240,30 L300,10 L300,70 L0,70 Z" fill="url(#g1)" />
                <path d="M0,58 L40,52 L80,55 L120,40 L160,44 L200,26 L240,30 L300,10" fill="none" stroke="#f5b400" strokeWidth="2" />
              </svg>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <Eyebrow>Trading statistics</Eyebrow>
            <H2>See every result of your trading</H2>
            <p className="text-slate-400 mt-4 text-[15px] leading-relaxed">
              The client sees the results of their trading and key metrics for the selected period.
            </p>
            <div className="mt-7 space-y-4">
              {[
                { icon: BarChart3, t: 'Full analytics', s: 'PnL, volume, number of trades, win rate and commissions in one place' },
                { icon: LineChart, t: 'Clear charts', s: 'Profit dynamics and distribution by markets displayed visually' },
                { icon: FileText, t: 'PDF report', s: 'Download a ready statement with your trading statistics in one click' },
              ].map(f => (
                <div key={f.t} className="flex gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#f5b400]/12 flex items-center justify-center shrink-0">
                    <f.icon className="w-5 h-5 text-[#f5b400]" />
                  </div>
                  <div>
                    <div className="font-bold text-white text-[15px]">{f.t}</div>
                    <div className="text-[13px] text-slate-500 mt-0.5">{f.s}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ==================== ACCOUNT TYPES ==================== */}
      <Section id="accounts" className="bg-[#0b0c10] border-y border-white/[.06]">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <Eyebrow>Account types</Eyebrow>
          <H2>Choose your level</H2>
          <p className="text-slate-400 mt-3 text-[15px]">Five account tiers with growing conditions and service.</p>
        </div>
        <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
          {ACCOUNTS.map((a, i) => (
            <div
              key={a.name}
              className={`rounded-2xl p-5 border transition-all ${
                i === 2
                  ? 'bg-[#f5b400]/[.07] border-[#f5b400]/40 shadow-[0_0_40px_-15px_rgba(245,180,0,.5)]'
                  : 'bg-[#16181f] border-white/[.07]'
              }`}
            >
              {i === 2 && (
                <div className="inline-flex items-center gap-1 text-[9px] font-extrabold text-[#17190f] bg-[#f5b400] px-2 py-0.5 rounded-full mb-2">
                  <Star className="w-2.5 h-2.5" /> POPULAR
                </div>
              )}
              <div className="text-[17px] font-extrabold text-white">{a.name}</div>
              <div className="text-2xl font-extrabold text-[#f5b400] mt-2">{a.dep}</div>
              <div className="text-[11px] text-slate-500">minimum deposit</div>
              <div className="mt-4 space-y-1.5 text-[12px] text-slate-400">
                <div className="flex justify-between border-b border-white/[.05] pb-1.5">
                  <span>Spread</span>
                  <span className="text-slate-200 font-semibold">{a.spread}</span>
                </div>
                <div className="flex justify-between border-b border-white/[.05] pb-1.5">
                  <span>Leverage</span>
                  <span className="text-slate-200 font-semibold">{a.lev}</span>
                </div>
              </div>
              <ul className="mt-3.5 space-y-1.5">
                {a.items.map(it => (
                  <li key={it} className="flex gap-2 text-[12px] text-slate-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#f5b400] shrink-0 mt-0.5" />
                    {it}
                  </li>
                ))}
              </ul>
              <button
                onClick={onOpenRegisterModal || onOpenLoginModal}
                className={`w-full mt-4 py-2 rounded-xl text-[12px] font-bold cursor-pointer transition-colors ${
                  i === 2 ? 'bg-[#f5b400] hover:bg-[#ffc21f] text-[#17190f]' : 'bg-white/[.06] hover:bg-white/[.12] text-white'
                }`}
              >
                Open account
              </button>
            </div>
          ))}
        </div>
      </Section>

      {/* ==================== ABOUT / WHY US ==================== */}
      <Section id="about">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <Eyebrow>About us</Eyebrow>
          <H2>What makes us different</H2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { icon: ShieldCheck, t: 'Security first', s: 'Segregated accounts, 2FA and encrypted data storage for every client.' },
            { icon: Users, t: 'Personal approach', s: 'A dedicated advisor guides you from the first deposit onwards.' },
            { icon: MonitorPlay, t: 'Live assistance', s: 'Screen sharing and voice calls right inside the platform.' },
          ].map(c => (
            <div key={c.t} className="bg-[#16181f] border border-white/[.07] rounded-2xl p-6">
              <c.icon className="w-6 h-6 text-[#f5b400]" />
              <h3 className="text-[16px] font-bold text-white mt-3.5">{c.t}</h3>
              <p className="text-[13.5px] text-slate-500 mt-2 leading-relaxed">{c.s}</p>
            </div>
          ))}
        </div>

        {/* Affiliate */}
        <div className="mt-6 bg-gradient-to-r from-[#f5b400]/[.12] to-transparent border border-[#f5b400]/25 rounded-2xl p-8 flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1">
            <Eyebrow>Affiliate program</Eyebrow>
            <h3 className="text-2xl font-extrabold text-white">Earn up to $12 per lot</h3>
            <p className="text-slate-400 text-[14px] mt-2 max-w-xl">
              Refer active traders and receive lifetime revenue share with transparent statistics and weekly payouts.
            </p>
          </div>
          <button
            onClick={onOpenRegisterModal || onOpenLoginModal}
            className="px-6 py-3 rounded-xl bg-[#f5b400] hover:bg-[#ffc21f] text-[#17190f] font-bold text-[14px] flex items-center gap-2 cursor-pointer shrink-0"
          >
            Become a partner <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </Section>

      {/* ==================== DOCUMENTATION ==================== */}
      <Section id="docs" className="bg-[#0b0c10] border-y border-white/[.06]">
        <div className="grid lg:grid-cols-2 gap-10">
          <div>
            <Eyebrow>Documentation</Eyebrow>
            <H2>Legal information</H2>
            <p className="text-slate-400 mt-3 text-[14px]">
              All the documents governing the relationship between the client and the company.
            </p>
            <div className="mt-6 grid sm:grid-cols-2 gap-3">
              {['Client Agreement', 'Privacy Policy', 'AML & KYC Policy', 'Risk Disclosure', 'Terms & Conditions', 'Payment Policy'].map(d => (
                <a
                  key={d}
                  href="#docs"
                  className="flex items-center gap-2.5 bg-[#16181f] border border-white/[.07] rounded-xl px-4 py-3 text-[13px] text-slate-300 hover:border-[#f5b400]/40 hover:text-white transition-colors"
                >
                  <FileText className="w-4 h-4 text-[#f5b400] shrink-0" />
                  {d}
                </a>
              ))}
            </div>
          </div>
          <div className="bg-[#16181f] border border-rose-500/25 rounded-2xl p-6">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-[14px]">
              <ShieldCheck className="w-4.5 h-4.5" /> Risk warning
            </div>
            <p className="text-[13px] text-slate-400 mt-3 leading-relaxed">
              Trading leveraged products such as CFDs and futures involves a high level of risk and may not be suitable
              for all investors. You could sustain a loss of some or all of your invested capital; therefore, you should
              not speculate with capital that you cannot afford to lose. Past performance is not indicative of future
              results. Please ensure you fully understand the risks involved and seek independent advice if necessary.
            </p>
          </div>
        </div>
      </Section>

      {/* ==================== NEWS (temporarily hidden) ====================
           Removed at the client's request pending approval.
           To bring it back, restore this section from git history
           (commit "hide news block, fix register arrow, TradingView redirects").
      ==================================================================== */}

      {/* ==================== CONTACT ==================== */}
      <Section id="contact" className="bg-[#0b0c10] border-t border-white/[.06]">
        <div className="grid lg:grid-cols-2 gap-12">
          <div>
            <Eyebrow>Contact us</Eyebrow>
            <H2>We are here to help</H2>
            <p className="text-slate-400 mt-3 text-[14px]">
              Our support desk works around the clock — reach out any time.
            </p>
            <div className="mt-7 space-y-4">
              {[
                { icon: Mail, t: 'support@tradenation.io', s: 'Average reply time: 15 minutes' },
                { icon: Phone, t: '+1 (888) 555-0140', s: '24/7 US-based support desk' },
                { icon: MapPin, t: '200 Vesey Street, New York, NY 10281', s: 'Head office' },
              ].map(c => (
                <div key={c.t} className="flex gap-3.5 items-start">
                  <div className="w-10 h-10 rounded-xl bg-[#f5b400]/12 flex items-center justify-center shrink-0">
                    <c.icon className="w-5 h-5 text-[#f5b400]" />
                  </div>
                  <div>
                    <div className="font-bold text-white text-[14px]">{c.t}</div>
                    <div className="text-[12.5px] text-slate-500">{c.s}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form
            onSubmit={e => {
              e.preventDefault();
              alert('Thank you! Our manager will contact you shortly.');
            }}
            className="bg-[#16181f] border border-white/[.07] rounded-2xl p-6 space-y-3.5"
          >
            <div className="grid sm:grid-cols-2 gap-3.5">
              <input required placeholder="Full name" className="px-4 py-2.5 bg-[#0e0f13] border border-white/[.08] rounded-xl text-[13px] text-white placeholder:text-slate-600 focus:outline-none focus:border-[#f5b400]/50" />
              <input required type="email" placeholder="E-mail" className="px-4 py-2.5 bg-[#0e0f13] border border-white/[.08] rounded-xl text-[13px] text-white placeholder:text-slate-600 focus:outline-none focus:border-[#f5b400]/50" />
            </div>
            <input placeholder="Phone number" className="w-full px-4 py-2.5 bg-[#0e0f13] border border-white/[.08] rounded-xl text-[13px] text-white placeholder:text-slate-600 focus:outline-none focus:border-[#f5b400]/50" />
            <textarea rows={5} placeholder="Your message" className="w-full px-4 py-2.5 bg-[#0e0f13] border border-white/[.08] rounded-xl text-[13px] text-white placeholder:text-slate-600 focus:outline-none focus:border-[#f5b400]/50 resize-none" />
            <button className="w-full py-3 rounded-xl bg-[#f5b400] hover:bg-[#ffc21f] text-[#17190f] font-bold text-[14px] cursor-pointer transition-colors">
              Send message
            </button>
          </form>
        </div>
      </Section>
    </div>
  );
};
