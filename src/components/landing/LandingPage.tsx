// ============================================================
//  Oak Haven Yield — LANDING
//  Design taken 1:1 from the client's PDF presentation (page 1):
//  dark surfaces (#0e0f13 / #16181f) + gold accent (#B08B48),
//  gold-highlighted hero headline, pill nav, gold CTA buttons.
//  Structure follows shorelinedirect.net-style trading landings:
//  hero → live markets → platform → conditions → account types
//  → why us → affiliate → documentation → news → contact.
// ============================================================
import React, { useState, useEffect } from 'react';
import { TickerTape, MarketOverview, MiniChart } from '../investor/TradingViewChart';
import { OakLogo } from '../brand/Logo';
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
  UserPlus,
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
  { name: 'Beginner', dep: '$5,000', spread: 'from 2.0', lev: '1:20', items: ['Personal manager', 'Basic education', 'Email support'] },
  { name: 'Silver', dep: '$20,000', spread: 'from 1.5', lev: '1:50', items: ['Everything in Beginner', 'Market reviews', 'Priority support'] },
  { name: 'Gold', dep: '$50,000', spread: 'from 1.0', lev: '1:100', items: ['Everything in Silver', 'Trading signals', 'Weekly strategy call'] },
  { name: 'Platinum', dep: '$200,000', spread: 'from 0.6', lev: '1:200', items: ['Everything in Gold', 'Senior advisor', 'Custom risk profile'] },
  { name: 'Diamond', dep: '$500,000+', spread: 'from 0.2', lev: '1:400', items: ['Everything in Platinum', 'VIP desk 24/7', 'Zero commission'] },
];

/** Questions clients actually ask before funding an account */
const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: 'What markets can I trade?',
    a: 'Stocks, currencies, commodities, indices and cryptocurrencies — over 200 instruments from a single account.',
  },
  {
    q: 'Is my account protected?',
    a: 'Client funds are held in segregated accounts, all data is encrypted, and withdrawals require identity verification.',
  },
  {
    q: 'How do I start trading?',
    a: 'Create an account, verify your identity and make a deposit. A personal advisor walks you through the first steps.',
  },
  {
    q: 'What is the minimum deposit?',
    a: 'The Beginner account starts at $5,000. Higher tiers unlock tighter spreads and additional services.',
  },
  {
    q: 'How can I deposit funds?',
    a: 'Bank cards, wire transfer, USDT and Bitcoin. Deposits are credited automatically, usually within minutes.',
  },
  {
    q: 'How do I withdraw my funds?',
    a: 'Submit a request from your cabinet. Once compliance approves it, funds are sent back to your original payment method.',
  },
  {
    q: 'Do I need to verify my identity?',
    a: 'Yes. Regulations require a photo ID and a proof of address before withdrawals can be processed.',
  },
  {
    q: 'Can I trade from my mobile device?',
    a: 'Yes — the platform runs in any modern mobile browser, no installation required.',
  },
];

/** Social-proof ticker shown in the corner (idea taken from the reference sites) */
const ACTIVITY = [
  { who: 'Michael from Texas', what: 'just invested', amount: '$12,400' },
  { who: 'Sophia from Florida', what: 'opened a position on', amount: 'AAPL' },
  { who: 'Daniel from Illinois', what: 'just invested', amount: '$8,900' },
  { who: 'Emma from California', what: 'withdrew profit of', amount: '$3,150' },
  { who: 'James from New York', what: 'opened a position on', amount: 'Gold' },
  { who: 'Olivia from Arizona', what: 'just invested', amount: '$21,000' },
];

/** Forest-green highlight — names, asset classes, risk control */
const G: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <strong className="font-semibold text-[#1C412C]">{children}</strong>
);

/** Warm-gold highlight — value, outcome, philosophy */
const Y: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <strong className="font-semibold text-[#B08B48]">{children}</strong>
);

const Section: React.FC<{ id?: string; className?: string; children: React.ReactNode }> = ({ id, className = '', children }) => (
  <section id={id} className={`py-20 px-5 ${className}`}>
    <div className="max-w-6xl mx-auto">{children}</div>
  </section>
);

const Eyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-[11px] font-extrabold tracking-[0.2em] text-[#B08B48] uppercase mb-3">{children}</div>
);

const H2: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <h2 className={`text-3xl md:text-[42px] leading-[1.1] font-extrabold text-[#1C412C] tracking-tight ${className}`}>{children}</h2>
);

/** Rotating "someone just traded" toast — makes the page feel alive */
const ActivityToast: React.FC = () => {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let alive = true;
    const cycle = () => {
      if (!alive) return;
      setVisible(true);
      setTimeout(() => alive && setVisible(false), 5000);
    };
    const first = setTimeout(cycle, 4000);
    const timer = setInterval(() => {
      setIndex(i => (i + 1) % ACTIVITY.length);
      cycle();
    }, 12000);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  const item = ACTIVITY[index];

  return (
    <div
      className={`fixed bottom-5 left-5 z-40 hidden sm:flex items-center gap-3 bg-white border border-[#1C412C]/18 rounded-xl px-4 py-3 shadow-2xl shadow-[#1C412C]/15 transition-all duration-500 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
      }`}
    >
      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
      <span className="text-[12.5px] text-[#213532]">
        {item.who} <span className="text-[#213532]/60">{item.what}</span>{' '}
        <span className="text-[#B08B48] font-bold">{item.amount}</span>
      </span>
    </div>
  );
};

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenLoginModal, onOpenRegisterModal }) => {
  const [faqOpen, setFaqOpen] = useState<number | null>(0);

  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [leverage, setLeverage] = useState(10);
  const [amount, setAmount] = useState(1000);


  return (
    <div className="bg-[#F5F2E9] text-[#213532]">
      {/* ==================== NAVBAR ==================== */}
      <header className="sticky top-0 z-50 bg-[#F5F2E9]/95 backdrop-blur border-b border-[#1C412C]/12">
        <div className="max-w-6xl mx-auto px-5 h-[68px] flex items-center gap-8">
          <a href="#top" className="flex items-center shrink-0">
            <OakLogo size={40} />
          </a>

          <nav className="hidden lg:flex items-center gap-7 text-[14px] font-medium text-[#213532]">
            <a href="#top" className="hover:text-[#1C412C] transition-colors">Home</a>
            <a href="#markets" className="hover:text-[#1C412C] transition-colors">Markets</a>
            {/* Plain link — the client asked to drop the dropdown and jump straight
                to the live quotes table */}
            <a href="#markets" className="hover:text-[#1C412C] transition-colors">
              Trading
            </a>
            <a href="#about" className="hover:text-[#1C412C] transition-colors">About Us</a>
          </nav>

          <div className="ml-auto flex items-center gap-2.5">
            <button
              onClick={onOpenLoginModal}
              className="px-4 py-2 rounded-xl bg-[#1C412C]/[.06] border border-[#1C412C]/18 text-[13px] font-semibold text-[#1C412C] hover:bg-[#1C412C]/[.10] transition-colors cursor-pointer"
            >
              Log in
            </button>
            <button
              onClick={onOpenRegisterModal || onOpenLoginModal}
              className="px-4 py-2 rounded-xl bg-[#B08B48] hover:bg-[#9a7a3e] text-[#1C412C] text-[13px] font-bold transition-colors cursor-pointer shadow-[0_6px_20px_-6px_rgba(176,139,72,.5)]"
            >
              Register
            </button>
          </div>
        </div>
      </header>

      {/* Live ticker strip (TradingView) */}
      <div className="border-b border-[#1C412C]/10 bg-white">
        <TickerTape />
      </div>

      {/* ==================== HERO ==================== */}
      <div id="top" className="relative overflow-hidden border-b border-[#1C412C]/10">
        <div
          className="absolute inset-0 opacity-[0.25]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 50% 0%, rgba(176,139,72,.18), transparent 55%), radial-gradient(circle at 10% 80%, rgba(28,65,44,.08), transparent 45%)',
          }}
        />
        <div className="relative max-w-4xl mx-auto px-5 py-24 md:py-28 text-center">
          <h1 className="text-[38px] md:text-[54px] leading-[1.08] font-extrabold tracking-tight">
            <span className="text-[#B08B48]">Grow your wealth</span>
            <br />
            <span className="text-[#1C412C]">with Oak Haven Yield</span>
          </h1>
          <p className="mt-5 text-[15px] md:text-[17px] text-[#213532]/75 max-w-2xl mx-auto leading-relaxed">
            A professional trading platform with access to global markets and a wide selection of instruments —
            crypto, forex, metals and indices in one account.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              onClick={onOpenRegisterModal || onOpenLoginModal}
              className="px-7 py-3 rounded-xl bg-[#B08B48] hover:bg-[#9a7a3e] text-[#1C412C] font-bold text-[15px] transition-all cursor-pointer shadow-[0_10px_30px_-8px_rgba(176,139,72,.55)]"
            >
              Start trading
            </button>
            <button
              onClick={onOpenLoginModal}
              className="px-7 py-3 rounded-xl bg-[#1C412C]/[.07] border border-[#1C412C]/20 text-[#1C412C] font-bold text-[15px] hover:bg-[#1C412C]/[.12] transition-all cursor-pointer"
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
              <div key={x.t} className="bg-white border border-[#1C412C]/12 shadow-sm rounded-2xl p-4">
                <x.icon className="w-5 h-5 text-[#B08B48]" />
                <div className="text-xl font-extrabold text-[#1C412C] mt-2.5">{x.t}</div>
                <div className="text-[11px] text-[#213532]/60">{x.s}</div>
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
          <p className="text-[#213532]/75 mt-3 text-[15px]">
            Real-time prices across indices, crypto, forex and commodities — powered by live exchange data.
          </p>
        </div>

        <div className="bg-white border border-[#1C412C]/12 shadow-sm rounded-2xl p-3 shadow-2xl shadow-[#1C412C]/10">
          <MarketOverview height={480} />
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { tv: 'BITSTAMP:BTCUSD', label: 'Bitcoin' },
            { tv: 'OANDA:XAUUSD', label: 'Gold' },
            { tv: 'FX:EURUSD', label: 'EUR / USD' },
          ].map(m => (
            <div key={m.tv} className="bg-white border border-[#1C412C]/12 shadow-sm rounded-2xl p-3">
              <div className="text-[12px] font-bold text-[#213532] px-1.5 pb-1">{m.label}</div>
              <MiniChart symbol={m.tv} height={190} />
            </div>
          ))}
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={onOpenRegisterModal || onOpenLoginModal}
            className="px-7 py-3 rounded-xl bg-[#B08B48] hover:bg-[#9a7a3e] text-[#1C412C] font-bold text-[14px] cursor-pointer transition-colors"
          >
            Start trading these markets
          </button>
        </div>
      </Section>

      {/* ==================== WEB PLATFORM (PDF p.2, web only — no APK) ==================== */}
      <Section id="platform" className="bg-white border-y border-[#1C412C]/10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <Eyebrow>Web platform</Eyebrow>
            <H2>The platform is always at hand</H2>
            <p className="text-[#213532]/75 mt-4 text-[15px] leading-relaxed">
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
                  <div className="w-10 h-10 rounded-xl bg-[#B08B48]/12 flex items-center justify-center shrink-0">
                    <f.icon className="w-5 h-5 text-[#B08B48]" />
                  </div>
                  <div>
                    <div className="font-bold text-[#1C412C] text-[15px]">{f.t}</div>
                    <div className="text-[13px] text-[#213532]/60 mt-0.5">{f.s}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive terminal preview — mirrors PDF page 6 */}
          <div className="bg-white border border-[#1C412C]/15 shadow-sm rounded-2xl p-4 shadow-2xl shadow-[#1C412C]/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#B08B48] flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-[#17190f]" />
                </div>
                <span className="font-bold text-[#1C412C] text-[14px]">BTC/USDT</span>
                <span className="text-emerald-400 text-[13px] font-mono">64,337.56</span>
              </div>
              <div className="flex gap-1">
                {['1H', '1D', '1W', '1M'].map((p, i) => (
                  <span
                    key={p}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                      i === 3 ? 'bg-[#B08B48]/20 text-[#B08B48]' : 'bg-[#1C412C]/[.06] text-[#213532]/60'
                    }`}
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>

            {/* candles */}
            <div className="bg-[#0e0f13] rounded-xl border border-[#1C412C]/10 p-3">
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
              <div className="bg-[#0e0f13] rounded-xl border border-[#1C412C]/10 p-3">
                <div className="text-[10px] font-bold text-[#213532]/60 uppercase mb-2">Order book</div>
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
                    <span className="text-[#213532]/60">{v as number}</span>
                  </div>
                ))}
              </div>

              <div className="bg-[#0e0f13] rounded-xl border border-[#1C412C]/10 p-3">
                <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                  <button
                    onClick={() => setSide('buy')}
                    className={`py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                      side === 'buy' ? 'bg-emerald-500 text-[#1C412C]' : 'bg-[#1C412C]/[.06] text-[#213532]/60'
                    }`}
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => setSide('sell')}
                    className={`py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                      side === 'sell' ? 'bg-rose-500 text-[#1C412C]' : 'bg-[#1C412C]/[.06] text-[#213532]/60'
                    }`}
                  >
                    Sell
                  </button>
                </div>
                <label className="text-[10px] text-[#213532]/60">Amount, $</label>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(Number(e.target.value))}
                  className="w-full mt-1 px-2.5 py-1.5 bg-white border border-[#1C412C]/15 shadow-sm rounded-lg text-[12px] text-[#1C412C] focus:outline-none focus:border-[#B08B48]/50"
                />
                <label className="text-[10px] text-[#213532]/60 mt-2 block">Leverage: {leverage}x</label>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={leverage}
                  onChange={e => setLeverage(Number(e.target.value))}
                  className="w-full accent-[#B08B48] mt-1 cursor-pointer"
                />
                <button
                  onClick={onOpenLoginModal}
                  className={`w-full mt-2.5 py-2 rounded-lg text-[12px] font-bold cursor-pointer ${
                    side === 'buy' ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-rose-500 hover:bg-rose-400'
                  } text-[#1C412C]`}
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
          <p className="text-[#213532]/75 mt-3 text-[15px]">
            The main advantage of the platform is a developed communication layer with the client.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { icon: Bell, t: 'Push notifications', s: 'Instant delivery of messages to the client device, even with the tab closed' },
            { icon: Headphones, t: 'Online support', s: 'Live chat, file sharing and tickets inside the platform' },
            { icon: PhoneCall, t: 'WebRTC calls', s: 'Direct voice connection with the client without third-party services' },
          ].map(c => (
            <div key={c.t} className="bg-white border border-[#1C412C]/12 shadow-sm rounded-2xl p-6 hover:border-[#B08B48]/35 transition-colors">
              <div className="w-12 h-12 rounded-2xl bg-[#B08B48]/12 flex items-center justify-center">
                <c.icon className="w-6 h-6 text-[#B08B48]" />
              </div>
              <h3 className="text-[17px] font-bold text-[#1C412C] mt-4">{c.t}</h3>
              <p className="text-[13.5px] text-[#213532]/60 mt-2 leading-relaxed">{c.s}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ==================== TRADING CONDITIONS ==================== */}
      <Section className="bg-white border-y border-[#1C412C]/10">
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
            <div key={c.t} className="bg-white border border-[#1C412C]/12 shadow-sm rounded-2xl p-5">
              <c.icon className="w-6 h-6 text-[#B08B48]" />
              <div className="text-[15px] font-bold text-[#1C412C] mt-3">{c.t}</div>
              <div className="text-[12.5px] text-[#213532]/60 mt-1">{c.s}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ==================== TRADING STATISTICS (PDF p.17-18) ==================== */}
      <Section>
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1 bg-white border border-[#1C412C]/15 shadow-sm rounded-2xl p-5">
            <div className="text-[13px] font-bold text-[#1C412C] mb-3">Trading statistics</div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { l: 'Total PnL', v: '$907.43', c: 'text-emerald-400' },
                { l: 'Volume', v: '$136,984.68', c: 'text-[#1C412C]' },
                { l: 'Trades', v: '22', c: 'text-[#1C412C]' },
                { l: 'Win rate', v: '45.5%', c: 'text-[#B08B48]' },
              ].map(k => (
                <div key={k.l} className="bg-[#0e0f13] border border-[#1C412C]/10 rounded-xl p-3.5">
                  <div className="text-[10px] text-[#213532]/60 uppercase tracking-wide">{k.l}</div>
                  <div className={`text-lg font-extrabold mt-1 ${k.c}`}>{k.v}</div>
                </div>
              ))}
            </div>
            <div className="bg-[#0e0f13] border border-[#1C412C]/10 rounded-xl p-3.5 mt-3">
              <div className="text-[10px] text-[#213532]/60 uppercase mb-2">Profit / loss dynamics</div>
              <svg viewBox="0 0 300 70" className="w-full h-20">
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#B08B48" stopOpacity=".5" />
                    <stop offset="100%" stopColor="#B08B48" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0,58 L40,52 L80,55 L120,40 L160,44 L200,26 L240,30 L300,10 L300,70 L0,70 Z" fill="url(#g1)" />
                <path d="M0,58 L40,52 L80,55 L120,40 L160,44 L200,26 L240,30 L300,10" fill="none" stroke="#B08B48" strokeWidth="2" />
              </svg>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <Eyebrow>Trading statistics</Eyebrow>
            <H2>See every result of your trading</H2>
            <p className="text-[#213532]/75 mt-4 text-[15px] leading-relaxed">
              The client sees the results of their trading and key metrics for the selected period.
            </p>
            <div className="mt-7 space-y-4">
              {[
                { icon: BarChart3, t: 'Full analytics', s: 'PnL, volume, number of trades, win rate and commissions in one place' },
                { icon: LineChart, t: 'Clear charts', s: 'Profit dynamics and distribution by markets displayed visually' },
                { icon: FileText, t: 'PDF report', s: 'Download a ready statement with your trading statistics in one click' },
              ].map(f => (
                <div key={f.t} className="flex gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#B08B48]/12 flex items-center justify-center shrink-0">
                    <f.icon className="w-5 h-5 text-[#B08B48]" />
                  </div>
                  <div>
                    <div className="font-bold text-[#1C412C] text-[15px]">{f.t}</div>
                    <div className="text-[13px] text-[#213532]/60 mt-0.5">{f.s}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ==================== HOW IT WORKS (3 steps) ==================== */}
      <Section id="how" className="bg-white border-y border-[#1C412C]/10">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <Eyebrow>Simple process</Eyebrow>
          <H2>Start investing in three steps</H2>
          <p className="text-[#213532]/75 mt-3 text-[15px]">
            No paperwork marathons — an account is ready in minutes.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {[
            {
              n: '01',
              t: 'Registration',
              s: 'Create your account and pass a quick identity check to unlock the platform.',
              icon: UserPlus,
            },
            {
              n: '02',
              t: 'Deposit',
              s: 'Fund the account with a card, bank transfer or crypto — whatever suits you.',
              icon: Wallet,
            },
            {
              n: '03',
              t: 'Start trading',
              s: 'Access global markets with a personal advisor guiding your first steps.',
              icon: TrendingUp,
            },
          ].map(step => (
            <div
              key={step.n}
              className="relative bg-white border border-[#1C412C]/12 shadow-sm rounded-2xl p-6 hover:border-[#B08B48]/35 transition-colors"
            >
              <span className="absolute top-5 right-6 text-[38px] font-extrabold text-[#1C412C]/[.05] leading-none">
                {step.n}
              </span>
              <div className="w-12 h-12 rounded-2xl bg-[#B08B48]/12 flex items-center justify-center">
                <step.icon className="w-6 h-6 text-[#B08B48]" />
              </div>
              <h3 className="text-[17px] font-bold text-[#1C412C] mt-4">{step.t}</h3>
              <p className="text-[13.5px] text-[#213532]/60 mt-2 leading-relaxed">{step.s}</p>
            </div>
          ))}
        </div>

        {/* Trust numbers */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {[
            { v: '150+', l: 'Countries' },
            { v: '200+', l: 'Trading assets' },
            { v: '24/7', l: 'Client support' },
            { v: '99.99%', l: 'Platform uptime' },
          ].map(x => (
            <div key={x.l} className="bg-white border border-[#1C412C]/12 shadow-sm rounded-2xl p-5 text-center">
              <div className="text-3xl font-extrabold text-[#B08B48]">{x.v}</div>
              <div className="text-[12px] text-[#213532]/60 mt-1">{x.l}</div>
            </div>
          ))}
        </div>

        <p className="text-center text-[12px] text-[#213532]/45 mt-5">
          Secure infrastructure, global access and professional tools designed for modern investors.
        </p>
      </Section>

      {/* ==================== ACCOUNT TYPES ==================== */}
      <Section id="accounts" className="bg-white border-y border-[#1C412C]/10">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <Eyebrow>Account types</Eyebrow>
          <H2>Choose your level</H2>
          <p className="text-[#213532]/75 mt-3 text-[15px]">Five account tiers with growing conditions and service.</p>
        </div>
        <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
          {ACCOUNTS.map((a, i) => (
            <div
              key={a.name}
              className={`rounded-2xl p-5 border transition-all ${
                i === 2
                  ? 'bg-[#B08B48]/[.08] border-[#B08B48]/45 shadow-[0_0_40px_-15px_rgba(245,180,0,.5)]'
                  : 'bg-white border-[#1C412C]/12'
              }`}
            >
              {i === 2 && (
                <div className="inline-flex items-center gap-1 text-[9px] font-extrabold text-[#17190f] bg-[#B08B48] px-2 py-0.5 rounded-full mb-2">
                  <Star className="w-2.5 h-2.5" /> POPULAR
                </div>
              )}
              <div className="text-[17px] font-extrabold text-[#1C412C]">{a.name}</div>
              <div className="text-2xl font-extrabold text-[#B08B48] mt-2">{a.dep}</div>
              <div className="text-[11px] text-[#213532]/60">minimum deposit</div>
              <div className="mt-4 space-y-1.5 text-[12px] text-[#213532]/75">
                <div className="flex justify-between border-b border-white/[.05] pb-1.5">
                  <span>Spread</span>
                  <span className="text-[#213532] font-semibold">{a.spread}</span>
                </div>
                <div className="flex justify-between border-b border-white/[.05] pb-1.5">
                  <span>Leverage</span>
                  <span className="text-[#213532] font-semibold">{a.lev}</span>
                </div>
              </div>
              <ul className="mt-3.5 space-y-1.5">
                {a.items.map(it => (
                  <li key={it} className="flex gap-2 text-[12px] text-[#213532]/75">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#B08B48] shrink-0 mt-0.5" />
                    {it}
                  </li>
                ))}
              </ul>
              <button
                onClick={onOpenRegisterModal || onOpenLoginModal}
                className={`w-full mt-4 py-2 rounded-xl text-[12px] font-bold cursor-pointer transition-colors ${
                  i === 2 ? 'bg-[#B08B48] hover:bg-[#9a7a3e] text-[#1C412C]' : 'bg-[#1C412C]/[.07] hover:bg-[#1C412C]/[.12] text-[#1C412C]'
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
        <div className="text-center max-w-2xl mx-auto mb-10">
          <Eyebrow>Our story</Eyebrow>
          <H2>Built as a haven, not a machine</H2>
        </div>

        {/* Founder's letter. Highlight colours follow the brand guide:
            gold = value and outcome, green = names, assets and risk control */}
        <div className="max-w-3xl mx-auto space-y-5 text-[15.5px] leading-[1.75] text-[#213532] mb-14">
          <p>
            <G>In 2008</G>, as global financial markets fractured, we sat on the trading floors of Wall Street's elite
            firms, watching the system lose its way. Corporate profits were being prioritized over the families whose
            lifelong savings hung in the balance. We saw brilliant strategies deployed to maximize company margins
            rather than protect ordinary people.
          </p>
          <p>
            We knew there had to be a better way. In the wake of that crisis, we walked away from high-corner offices to
            build something enduring, officially launching <G>Oak Haven Yield</G> in <Y>2010</Y>.
          </p>
          <p>
            We founded our firm on a single, unshakeable principle:{' '}
            <Y>
              an investment advisory should act as a sanctuary for its clients' financial futures, not a machine for its
              own short-term gain.
            </Y>
          </p>
          <p>
            The <G>oak</G> stands for <G>deep roots and strength</G> through every market cycle; the <G>haven</G>{' '}
            represents <G>safety in uncertain weather</G>; and <G>yield</G> is the quiet,{' '}
            <Y>steady compounding of real growth</Y>.
          </p>
          <p>
            Instead of chasing volatile trends or pushing high-fee products, we built a <Y>client-first model</Y>. By
            combining <G>institutional-grade market access</G> across traditional <G>stocks</G>, <G>commodities</G>,{' '}
            <G>indices</G>, and <G>modern digital assets</G>, we focus on <G>managing risk first</G> and generating{' '}
            <Y>reliable growth second</Y>.
          </p>
          <p>
            At <G>Oak Haven Yield</G>, our success is not measured by our company's balance sheet, but by the{' '}
            <Y>peace of mind</Y> we deliver to the families who trust us with their life's work.
          </p>
        </div>

        <div className="text-center max-w-2xl mx-auto mb-10">
          <H2 className="text-[30px]">What makes us different</H2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { icon: ShieldCheck, t: 'Security first', s: 'Segregated accounts, 2FA and encrypted data storage for every client.' },
            { icon: Users, t: 'Personal approach', s: 'A dedicated advisor guides you from the first deposit onwards.' },
            { icon: MonitorPlay, t: 'Live assistance', s: 'Screen sharing and voice calls right inside the platform.' },
          ].map(c => (
            <div key={c.t} className="bg-white border border-[#1C412C]/12 shadow-sm rounded-2xl p-6">
              <c.icon className="w-6 h-6 text-[#B08B48]" />
              <h3 className="text-[16px] font-bold text-[#1C412C] mt-3.5">{c.t}</h3>
              <p className="text-[13.5px] text-[#213532]/60 mt-2 leading-relaxed">{c.s}</p>
            </div>
          ))}
        </div>

        {/* Affiliate */}
        <div className="mt-6 bg-gradient-to-r from-[#B08B48]/[.14] to-transparent border border-[#B08B48]/30 rounded-2xl p-8 flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1">
            <Eyebrow>Affiliate program</Eyebrow>
            <h3 className="text-2xl font-extrabold text-[#1C412C]">Earn up to $12 per lot</h3>
            <p className="text-[#213532]/75 text-[14px] mt-2 max-w-xl">
              Refer active traders and receive lifetime revenue share with transparent statistics and weekly payouts.
            </p>
          </div>
          <button
            onClick={onOpenRegisterModal || onOpenLoginModal}
            className="px-6 py-3 rounded-xl bg-[#B08B48] hover:bg-[#9a7a3e] text-[#1C412C] font-bold text-[14px] flex items-center gap-2 cursor-pointer shrink-0"
          >
            Become a partner <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </Section>

      {/* ==================== DOCUMENTATION ==================== */}
      <Section id="docs" className="bg-white border-y border-[#1C412C]/10">
        <div className="grid lg:grid-cols-2 gap-10">
          <div>
            <Eyebrow>Documentation</Eyebrow>
            <H2>Legal information</H2>
            <p className="text-[#213532]/75 mt-3 text-[14px]">
              All the documents governing the relationship between the client and the company.
            </p>
            <div className="mt-6 grid sm:grid-cols-2 gap-3">
              {['Client Agreement', 'Privacy Policy', 'AML & KYC Policy', 'Risk Disclosure', 'Terms & Conditions', 'Payment Policy'].map(d => (
                <a
                  key={d}
                  href="#docs"
                  className="flex items-center gap-2.5 bg-white border border-[#1C412C]/12 shadow-sm rounded-xl px-4 py-3 text-[13px] text-[#213532] hover:border-[#B08B48]/45 hover:text-[#1C412C] transition-colors"
                >
                  <FileText className="w-4 h-4 text-[#B08B48] shrink-0" />
                  {d}
                </a>
              ))}
            </div>
          </div>
          <div className="bg-white border border-rose-500/25 rounded-2xl p-6">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-[14px]">
              <ShieldCheck className="w-4.5 h-4.5" /> Risk warning
            </div>
            <p className="text-[13px] text-[#213532]/75 mt-3 leading-relaxed">
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

      {/* ==================== FAQ ==================== */}
      <Section id="faq" className="bg-white border-y border-[#1C412C]/10">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <Eyebrow>Support</Eyebrow>
          <H2>Frequently asked questions</H2>
        </div>

        <div className="max-w-3xl mx-auto space-y-2.5">
          {FAQ_ITEMS.map((item, i) => {
            const open = faqOpen === i;
            return (
              <div
                key={item.q}
                className={`bg-white border rounded-2xl overflow-hidden transition-colors ${
                  open ? 'border-[#B08B48]/35' : 'border-[#1C412C]/12'
                }`}
              >
                <button
                  onClick={() => setFaqOpen(open ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer"
                >
                  <span className="text-[14.5px] font-semibold text-[#1C412C]">{item.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 shrink-0 transition-transform ${
                      open ? 'rotate-180 text-[#B08B48]' : 'text-[#213532]/60'
                    }`}
                  />
                </button>
                {open && (
                  <div className="px-5 pb-4 text-[13.5px] text-[#213532]/75 leading-relaxed">{item.a}</div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <ActivityToast />

      {/* ==================== CONTACT ==================== */}
      <Section id="contact" className="bg-white border-t border-[#1C412C]/10">
        <div className="grid lg:grid-cols-2 gap-12">
          <div>
            <Eyebrow>Contact us</Eyebrow>
            <H2>We are here to help</H2>
            <p className="text-[#213532]/75 mt-3 text-[14px]">
              Our support desk works around the clock — reach out any time.
            </p>
            <div className="mt-7 space-y-4">
              {[
                { icon: Mail, t: 'support@oakhavenyield.com', s: 'Average reply time: 15 minutes' },
                { icon: Phone, t: '+1 (888) 555-0140', s: '24/7 US-based support desk' },
                { icon: MapPin, t: '300 Delaware Ave, Wilmington, DE 19801', s: 'Head office' },
              ].map(c => (
                <div key={c.t} className="flex gap-3.5 items-start">
                  <div className="w-10 h-10 rounded-xl bg-[#B08B48]/12 flex items-center justify-center shrink-0">
                    <c.icon className="w-5 h-5 text-[#B08B48]" />
                  </div>
                  <div>
                    <div className="font-bold text-[#1C412C] text-[14px]">{c.t}</div>
                    <div className="text-[12.5px] text-[#213532]/60">{c.s}</div>
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
            className="bg-white border border-[#1C412C]/12 shadow-sm rounded-2xl p-6 space-y-3.5"
          >
            <div className="grid sm:grid-cols-2 gap-3.5">
              <input required placeholder="Full name" className="px-4 py-2.5 bg-[#0e0f13] border border-[#1C412C]/15 rounded-xl text-[13px] text-[#1C412C] placeholder:text-[#213532]/45 focus:outline-none focus:border-[#B08B48]/50" />
              <input required type="email" placeholder="E-mail" className="px-4 py-2.5 bg-[#0e0f13] border border-[#1C412C]/15 rounded-xl text-[13px] text-[#1C412C] placeholder:text-[#213532]/45 focus:outline-none focus:border-[#B08B48]/50" />
            </div>
            <input placeholder="Phone number" className="w-full px-4 py-2.5 bg-[#0e0f13] border border-[#1C412C]/15 rounded-xl text-[13px] text-[#1C412C] placeholder:text-[#213532]/45 focus:outline-none focus:border-[#B08B48]/50" />
            <textarea rows={5} placeholder="Your message" className="w-full px-4 py-2.5 bg-[#0e0f13] border border-[#1C412C]/15 rounded-xl text-[13px] text-[#1C412C] placeholder:text-[#213532]/45 focus:outline-none focus:border-[#B08B48]/50 resize-none" />
            <button className="w-full py-3 rounded-xl bg-[#B08B48] hover:bg-[#9a7a3e] text-[#1C412C] font-bold text-[14px] cursor-pointer transition-colors">
              Send message
            </button>
          </form>
        </div>
      </Section>
    </div>
  );
};
