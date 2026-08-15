import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  PhoneCall,
  Mail,
  MapPin,
  ArrowRight,
  FileText,
  Award,
  Wallet,
  Zap,
  Globe,
  TrendingUp,
  MonitorPlay,
  Headset,
  CheckCircle2,
  Sparkles,
  Users,
  Gift,
  Star,
  Eye,
  ChevronRight
} from 'lucide-react';

interface LandingPageProps {
  onOpenLoginModal: () => void;
}

type Section = 'home' | 'about' | 'accounts' | 'legal' | 'news' | 'contact';

const NAV: { id: Section; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'about', label: 'About Us' },
  { id: 'accounts', label: 'Account Types' },
  { id: 'legal', label: 'Documentation' },
  { id: 'news', label: 'News' },
  { id: 'contact', label: 'Contact Us' }
];

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenLoginModal }) => {
  const [activeSection, setActiveSection] = useState<Section>('home');
  const [marketTab, setMarketTab] = useState<'Indices' | 'Futures' | 'Forex'>('Indices');
  const [timeframe, setTimeframe] = useState('1h');
  const [leverage, setLeverage] = useState('10x');
  const [orderMsg, setOrderMsg] = useState<string | null>(null);

  const showOrder = (side: 'BUY' | 'SELL') => {
    setOrderMsg(`${side === 'BUY' ? '🟢 Buy / Long' : '🔴 Sell / Short'} order placed — BTC/USDT · ${leverage} · ${timeframe}`);
    setTimeout(() => setOrderMsg(null), 3500);
  };

  const MARKET_ROWS: Record<string, { s: string; n: string; p: string; c: string; pc: string }[]> = {
    Indices: [
      { s: 'SPXUSD', n: 'S&P 500 Index', p: '7,800.8', c: '-2.50', pc: '-0.03%' },
      { s: 'NSXUSD', n: 'US 100 Cash CFD', p: '30,125.6', c: '+13.30', pc: '+0.04%' },
      { s: 'DJI', n: 'Dow Jones Industrial Average', p: '53,757.3', c: '-109.70', pc: '-0.20%' },
      { s: 'NKY', n: 'Japan 225', p: '68,713.80', c: '+405.21', pc: '+0.59%' },
      { s: 'DEU40', n: 'DAX Index', p: '26,299.74', c: '-31.33', pc: '-0.12%' }
    ],
    Futures: [
      { s: 'BTCUSDT', n: 'Bitcoin Perpetual', p: '64,280.5', c: '+1,510.2', pc: '+2.41%' },
      { s: 'ETHUSDT', n: 'Ethereum Perpetual', p: '2,815.3', c: '+49.8', pc: '+1.80%' },
      { s: 'SOLUSDT', n: 'Solana Perpetual', p: '148.62', c: '+3.15', pc: '+2.17%' },
      { s: 'XAUUSD', n: 'Gold Futures', p: '2,415.20', c: '+14.30', pc: '+0.60%' },
      { s: 'WTI', n: 'Crude Oil Futures', p: '78.42', c: '-0.95', pc: '-1.20%' }
    ],
    Forex: [
      { s: 'EURUSD', n: 'Euro / US Dollar', p: '1.0942', c: '-0.0021', pc: '-0.19%' },
      { s: 'GBPUSD', n: 'British Pound / US Dollar', p: '1.2875', c: '+0.0034', pc: '+0.26%' },
      { s: 'USDJPY', n: 'US Dollar / Japanese Yen', p: '146.28', c: '+0.52', pc: '+0.36%' },
      { s: 'AUDCAD', n: 'Australian / Canadian Dollar', p: '0.98435', c: '-0.0001', pc: '-0.01%' },
      { s: 'USDCHF', n: 'US Dollar / Swiss Franc', p: '0.8590', c: '-0.0012', pc: '-0.14%' }
    ]
  };

  return (
    <div className="pb-16">
      {/* ===== Landing Navigation (like Shoreline Direct) ===== */}
      <div className="bg-white border-b border-slate-200 sticky top-16 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <nav className="flex items-center gap-1 h-14 overflow-x-auto">
            {NAV.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer border-b-2 ${
                  activeSection === item.id
                    ? 'text-blue-700 border-blue-600'
                    : 'text-slate-600 hover:text-slate-900 border-transparent'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ===== HOME ===== */}
      {activeSection === 'home' && (
        <div>
          {/* HERO */}
          <section className="bg-gradient-to-br from-[#0b1b3f] via-[#0d2a5e] to-[#123a7d] text-white relative overflow-hidden">
            <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-blue-500/20 blur-3xl" />
            <div className="absolute -bottom-40 -left-24 w-96 h-96 rounded-full bg-indigo-500/20 blur-3xl" />
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 relative z-10">
              <div className="max-w-3xl space-y-6">
                <div className="inline-flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 border border-white/15 text-white/90 text-xs font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Online Forex & CFD Trading Platform
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-white/10 border border-white/15 text-xs font-bold">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    Excellent · Trustify 5.0
                  </span>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]">
                  Trade Global Markets
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-sky-300 to-blue-400">
                    with Confidence
                  </span>
                </h1>

                <p className="text-blue-100/90 text-base sm:text-lg leading-relaxed max-w-2xl">
                  Dive into Forex, Indices, Commodities & Cryptos — All in One Platform.
                  Seamless Trading. Advanced Tools. Personalized Support.
                </p>

                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <button
                    onClick={onOpenLoginModal}
                    className="px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2 cursor-pointer"
                  >
                    Sign In to Your Account
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setActiveSection('accounts')}
                    className="px-7 py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-xl text-sm transition-all cursor-pointer"
                  >
                    View Account Types
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-3 text-xs text-blue-200/80">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Tight spreads & fast execution
                  <span className="mx-1 text-white/20">•</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Up to 1:500 leverage
                  <span className="mx-1 text-white/20">•</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  24/7 support
                </div>
              </div>
            </div>
          </section>

          {/* MARKETS WIDGET */}
          <section className="max-w-6xl mx-auto px-4 sm:px-6 -mt-8 relative z-20">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/60 p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                    Browse the full range of Markets
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">World markets · live quotes</p>
                </div>
                <div className="sm:ml-auto flex items-center gap-2">
                  {(['Indices', 'Futures', 'Forex'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setMarketTab(t)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        marketTab === t ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[560px]">
                  <thead>
                    <tr className="text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      <th className="py-2.5 pr-4 font-semibold">Instrument</th>
                      <th className="py-2.5 pr-4 font-semibold">Price</th>
                      <th className="py-2.5 pr-4 font-semibold">Change</th>
                      <th className="py-2.5 pr-4 font-semibold">%</th>
                      <th className="py-2.5 text-right font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {MARKET_ROWS[marketTab].map(r => (
                      <tr key={r.s} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 pr-4">
                          <span className="font-bold text-slate-900">{r.s}</span>
                          <span className="text-xs text-slate-400 ml-2 hidden sm:inline">{r.n}</span>
                        </td>
                        <td className="py-3 pr-4 font-bold text-slate-900">{r.p}</td>
                        <td className={`py-3 pr-4 font-semibold ${r.c.startsWith('+') ? 'text-emerald-600' : 'text-rose-600'}`}>{r.c}</td>
                        <td className={`py-3 pr-4 font-semibold ${r.pc.startsWith('+') ? 'text-emerald-600' : 'text-rose-600'}`}>{r.pc}</td>
                        <td className="py-3 text-right">
                          <button
                            onClick={onOpenLoginModal}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-0.5 cursor-pointer"
                          >
                            Trade <ChevronRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* TRADING CONDITIONS */}
          <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
            <div className="text-center mb-10">
              <div className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">Why choose us</div>
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Trading Conditions</h2>
              <p className="text-sm text-slate-500 mt-2">Institutional-grade execution for every trader</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { icon: Zap, title: 'Tight Spreads', desc: 'Benefit from RAW spreads to get the best out of your trades.' },
                { icon: TrendingUp, title: 'Flexible Leverage', desc: 'Amplify your trades and increase your opportunities.' },
                { icon: Wallet, title: 'Low Commission', desc: 'Trade with low commission fees to keep your costs down.' },
                { icon: MonitorPlay, title: 'Instant Execution', desc: 'Fast, real-time trade execution with no delays.' }
              ].map(c => (
                <div
                  key={c.title}
                  className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors flex items-center justify-center mb-4">
                    <c.icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-1.5">{c.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{c.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* WEB PLATFORM */}
          <section className="bg-gradient-to-r from-[#0d2a5e] to-[#123a7d] text-white">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 flex flex-col lg:flex-row lg:items-center gap-10">
              <div className="flex-1 space-y-5">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/10 border border-white/15 text-xs font-semibold">
                  <MonitorPlay className="w-4 h-4 text-sky-300" />
                  TradeNation Web Platform
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
                  Trade Smarter, Anytime, Anywhere
                </h2>
                <p className="text-blue-100/90 text-sm sm:text-base leading-relaxed max-w-xl">
                  A complete web trading experience without the need for specialized software.
                  Charts, orders, balance and your personal manager — all in one browser tab.
                </p>
                <div className="flex flex-wrap gap-4 pt-1">
                  <button
                    onClick={onOpenLoginModal}
                    className="px-6 py-3 bg-white text-blue-800 font-bold rounded-xl text-sm hover:bg-blue-50 transition-all cursor-pointer"
                  >
                    Start Trading
                  </button>
                  <button
                    onClick={() => setActiveSection('about')}
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-xl text-sm transition-all cursor-pointer"
                  >
                    Learn More
                  </button>
                </div>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-4">
                {[
                  { v: '100+', l: 'Countries served' },
                  { v: '1:500', l: 'Max leverage' },
                  { v: '<15 ms', l: 'Order execution' },
                  { v: '24/7', l: 'Markets & support' }
                ].map(s => (
                  <div key={s.l} className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center backdrop-blur-sm">
                    <div className="text-3xl font-extrabold text-sky-300">{s.v}</div>
                    <div className="text-xs text-blue-100/80 font-medium mt-1">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* PLATFORM PREVIEW (как в PDF: график + стакан + ордера) */}
          <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
            <div className="text-center mb-10">
              <div className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">The platform</div>
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">One interface for everything</h2>
              <p className="text-sm text-slate-500 mt-2">
                Live charts, order book, positions and PnL — exactly like in the platform
              </p>
            </div>

            <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
              {/* window top bar */}
              <div className="flex items-center justify-between px-5 py-3 bg-slate-800/80 border-b border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-rose-500/80"></span>
                    <span className="w-3 h-3 rounded-full bg-amber-400/80"></span>
                    <span className="w-3 h-3 rounded-full bg-emerald-500/80"></span>
                  </div>
                  <span className="text-xs font-bold text-slate-300">BTC/USDT — Spot</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-slate-400">Balance: <strong className="text-emerald-400">$26,500</strong></span>
                  <span className="text-slate-400">PnL: <strong className="text-emerald-400">+$4,810</strong></span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3">
                {/* chart */}
                <div className="lg:col-span-2 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-2xl font-extrabold text-white">64,280.5 <span className="text-sm font-bold text-emerald-400 ml-2">+2.4%</span></div>
                    <div className="flex items-center gap-1.5">
                      {['1m', '5m', '15m', '1h', '4h', '1D'].map(t => (
                        <button
                          key={t}
                          onClick={() => setTimeframe(t)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                            timeframe === t ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* SVG chart */}
                  <svg viewBox="0 0 600 220" className="w-full h-52" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {[20, 55, 90, 125, 160, 195].map(y => (
                      <line key={y} x1="0" y1={y} x2="600" y2={y} stroke="#1e293b" strokeWidth="1" />
                    ))}
                    <path
                      d="M0,170 C40,160 60,140 90,145 C120,150 140,120 170,115 C200,110 220,128 250,118 C280,108 300,80 330,85 C360,90 380,70 410,62 C440,54 460,72 490,60 C520,48 550,55 580,40 L600,34 L600,220 L0,220 Z"
                      fill="url(#chartFill)"
                    />
                    <path
                      d="M0,170 C40,160 60,140 90,145 C120,150 140,120 170,115 C200,110 220,128 250,118 C280,108 300,80 330,85 C360,90 380,70 410,62 C440,54 460,72 490,60 C520,48 550,55 580,40 L600,34"
                      fill="none" stroke="#3b82f6" strokeWidth="2.5"
                    />
                  </svg>
                </div>

                {/* order book + buy/sell */}
                <div className="border-t lg:border-t-0 lg:border-l border-slate-700 p-5 space-y-4">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Order book</div>
                  <div className="space-y-1 text-xs">
                    {[
                      ['64,310.0', '2.4 BTC'],
                      ['64,295.5', '1.8 BTC'],
                      ['64,285.0', '0.9 BTC']
                    ].map(([p, v]) => (
                      <div key={p} className="flex justify-between text-rose-400">
                        <span className="font-mono font-bold">{p}</span>
                        <span className="text-slate-500">{v}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-slate-500 border-y border-slate-700 py-1.5 my-1">
                      <span className="font-mono font-bold text-white">64,280.5</span>
                      <span>spread 0.8</span>
                    </div>
                    {[
                      ['64,270.0', '1.2 BTC'],
                      ['64,260.5', '3.1 BTC'],
                      ['64,248.0', '1.7 BTC']
                    ].map(([p, v]) => (
                      <div key={p} className="flex justify-between text-emerald-400">
                        <span className="font-mono font-bold">{p}</span>
                        <span className="text-slate-500">{v}</span>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                      onClick={() => showOrder('BUY')}
                      className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-sm font-bold transition-all cursor-pointer"
                    >
                      Buy / Long
                    </button>
                    <button
                      onClick={() => showOrder('SELL')}
                      className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-sm font-bold transition-all cursor-pointer"
                    >
                      Sell / Short
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center justify-between">
                    <span>Leverage</span>
                    <div className="flex gap-1">
                      {['1x', '5x', '10x', '20x'].map(l => (
                        <button
                          key={l}
                          onClick={() => setLeverage(l)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                            leverage === l ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                  {orderMsg && (
                    <div className="text-[11px] bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-emerald-300 font-semibold animate-pulse">
                      {orderMsg}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* WHAT MAKES DIFFERENT */}
          <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
            <div className="text-center mb-10">
              <div className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">Our edge</div>
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">What Makes TradeNation Different?</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                { icon: Globe, title: 'Global reach', desc: 'We partner with businesses and individuals in over 100 countries, providing reliable and efficient trading solutions.' },
                { icon: Lock, title: 'Security first', desc: 'Your safety is our priority with strict security protocols. Data and transactions are protected with the highest industry standards.' },
                { icon: Headset, title: 'Personalized support', desc: 'Dedicated account managers, built-in WebRTC calls and screen share sessions. Your advisor is one click away.' }
              ].map(c => (
                <div key={c.title} className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20 mb-4">
                    <c.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{c.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{c.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* AFFILIATE */}
          <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
            <div className="bg-gradient-to-br from-slate-900 via-[#0d2a5e] to-blue-900 text-white rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden">
              <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl" />
              <div className="max-w-2xl relative z-10 space-y-5">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-semibold">
                  <Gift className="w-4 h-4" />
                  Affiliate Program
                </div>
                <h2 className="text-3xl font-extrabold tracking-tight leading-tight">
                  Join Our Affiliate Program to Maximize Earnings — Up to $12 per Lot Traded
                </h2>
                <p className="text-blue-100/90 text-sm sm:text-base leading-relaxed">
                  Boost your customer base and join an active community of over 145,000 registered
                  partners! Get live notifications and track & filter your performance.
                </p>
                <div className="flex flex-wrap gap-3 pt-1">
                  <button
                    onClick={onOpenLoginModal}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition-all cursor-pointer"
                  >
                    Become a Partner
                  </button>
                  <button
                    onClick={onOpenLoginModal}
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-xl text-sm transition-all cursor-pointer"
                  >
                    Partner Dashboard
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ===== ABOUT US ===== */}
      {activeSection === 'about' && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 space-y-12">
          <section className="text-center max-w-3xl mx-auto">
            <div className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">About Us</div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              Transforming the landscape of online forex trading
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed mt-5">
              <strong className="text-slate-900">TradeNation is transforming the landscape of online forex
              trading</strong> by providing traders with access to institutional-grade pricing.
            </p>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed mt-3">
              Our leadership team draws on deep expertise across global Forex, CFD, and Equity
              markets. This industry insight enables us to leverage cutting-edge technology and
              partner with top-tier liquidity providers to deliver some of the most competitive
              pricing available.
            </p>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed mt-3">
              Our mission is to deliver the best and most transparent trading experience for both
              retail and institutional clients.
            </p>
          </section>

          <section>
            <div className="text-center mb-8">
              <h3 className="text-2xl font-extrabold tracking-tight text-slate-900">Our Core Values</h3>
              <p className="text-sm text-slate-500 mt-1">
                Our Core Values define who we are and guide every decision we make
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { icon: ShieldCheck, title: 'Integrity & Trust', desc: 'We uphold integrity and trust in all our relationships.' },
                { icon: Award, title: 'Honesty & Fairness', desc: 'We value honesty and fairness in our dealings with clients and partners.' },
                { icon: Eye, title: 'Transparency', desc: 'We believe in transparency, ensuring our clients always know where they stand.' },
                { icon: CheckCircle2, title: 'Commitment', desc: 'We take our commitments seriously, delivering on our promises.' },
                { icon: Users, title: 'Reliability', desc: 'We strive to be reliable, offering consistent support and performance.' },
                { icon: TrendingUp, title: 'Flexibility', desc: 'We embrace flexibility to adapt to our clients’ evolving needs.' },
                { icon: Sparkles, title: 'Innovation', desc: 'We pursue constant innovation to stay at the forefront of trading technology.' },
                { icon: Globe, title: 'Governance', desc: 'We maintain strong corporate governance to ensure ethical and sound business practices.' }
              ].map(v => (
                <div key={v.title} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all space-y-3">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <v.icon className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-slate-900">{v.title}</h4>
                  <p className="text-sm text-slate-500 leading-relaxed">{v.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ===== ACCOUNT TYPES ===== */}
      {activeSection === 'accounts' && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
          <div className="text-center mb-10">
            <div className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">Account Types</div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              Choose the account that fits your goals
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              From entry-level accounts to elite VIP conditions — 5 tiers for every trader
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {[
              { tier: 'ENTRY LEVEL', name: 'Beginner', tagline: 'Best for new traders', minDeposit: '$200', features: ['Basic trading platform', 'Limited asset selection', 'Standard spreads', 'No leverage', 'Basic educational materials', 'Little advisor access'], featured: false },
              { tier: 'BRONZE', name: 'Bronze', tagline: 'Build your foundation', minDeposit: '$5k', features: ['Slightly tighter spreads', 'More tradable assets', 'Intro market analysis', 'Occasional tutorials', 'Limited advisor access'], featured: false },
              { tier: 'SILVER', name: 'Silver', tagline: 'Grow your portfolio', minDeposit: '$25k', features: ['Better spreads & lower fees', 'Advanced charts & indicators', 'Regular insights & signals', 'Some priority support', 'Trading advisor access', 'Faster withdrawals'], featured: true },
              { tier: 'GOLD', name: 'Gold', tagline: 'Professional edge', minDeposit: '$100k', features: ['Much tighter spreads', 'Premium analysis & signals', 'Dedicated account manager', 'VIP strategy sessions', 'Higher leverage options', 'Faster execution'], featured: false },
              { tier: 'DIAMOND', name: 'Diamond', tagline: 'Elite experience', minDeposit: '$500k', features: ['Best spreads & lowest fees', 'Full access to all assets', 'Personal account manager', 'Exclusive insights', 'Priority withdrawals', 'Private events'], featured: false }
            ].map(acc => (
              <div
                key={acc.name}
                className={`relative p-6 rounded-2xl border flex flex-col space-y-4 transition-all ${
                  acc.featured
                    ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-blue-600 shadow-xl shadow-blue-600/20 scale-[1.03]'
                    : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
                }`}
              >
                {acc.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-amber-400 text-slate-900 text-[10px] font-extrabold uppercase tracking-wide shadow">
                    Most popular
                  </span>
                )}
                <div className={`text-[10px] font-extrabold uppercase tracking-widest ${acc.featured ? 'text-blue-200' : 'text-slate-400'}`}>
                  {acc.tier}
                </div>
                <div>
                  <h3 className="text-xl font-extrabold">{acc.name}</h3>
                  <p className={`text-xs mt-0.5 ${acc.featured ? 'text-blue-100' : 'text-slate-500'}`}>{acc.tagline}</p>
                </div>
                <div className={`flex items-end gap-1 ${acc.featured ? 'text-white' : 'text-slate-900'}`}>
                  <span className="text-2xl font-extrabold">{acc.minDeposit}</span>
                  <span className={`text-[10px] pb-1 ${acc.featured ? 'text-blue-200' : 'text-slate-400'}`}>min deposit</span>
                </div>
                <ul className={`space-y-2 text-xs flex-1 ${acc.featured ? 'text-blue-100' : 'text-slate-600'}`}>
                  {acc.features.map(f => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckCircle2 className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${acc.featured ? 'text-amber-300' : 'text-emerald-500'}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={onOpenLoginModal}
                  className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                    acc.featured
                      ? 'bg-white text-blue-700 hover:bg-blue-50'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  Get Started
                </button>
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-500">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            Rated «Excellent» on Trustify — verified reviews from real traders
          </div>
        </div>
      )}

      {/* ===== DOCUMENTATION ===== */}
      {activeSection === 'legal' && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 space-y-10">
          <div className="text-center max-w-2xl mx-auto">
            <div className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">Documentation</div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Legal Documents & Policies</h2>
            <p className="text-sm text-slate-500 mt-2">
              Terms, policies and disclosures governing the platform and client accounts
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: FileText, title: 'Terms & Conditions', desc: 'This agreement defines the rights and obligations of the Client when using the web platform interface and the procedure for executing trading transactions.', color: 'text-blue-600 bg-blue-50' },
              { icon: Lock, title: 'Privacy Policy', desc: 'Personal data is processed with encryption. We guarantee that your private information is never disclosed to third parties.', color: 'text-purple-600 bg-purple-50' },
              { icon: ShieldCheck, title: 'AML Policy', desc: 'The platform complies with international AML standards and performs client identification. All transactions are screened.', color: 'text-emerald-600 bg-emerald-50' },
              { icon: ShieldCheck, title: 'KYC Policy', desc: 'Identity verification (KYC) is mandatory for all clients before deposits and withdrawals. Documents are checked within 24 hours.', color: 'text-amber-600 bg-amber-50' },
              { icon: Award, title: 'Risk Disclosure', desc: 'Transactions with financial instruments involve market risks. Clients make their own decisions regarding the management of their accounts.', color: 'text-rose-600 bg-rose-50' },
              { icon: Wallet, title: 'Deposit & Withdrawal', desc: 'Deposits are credited instantly via crypto gateway, bank transfer or cards. Withdrawals are processed within 24 hours.', color: 'text-indigo-600 bg-indigo-50' }
            ].map(doc => (
              <div key={doc.title} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all space-y-3">
                <div className={`w-11 h-11 rounded-xl ${doc.color.split(' ')[1]} ${doc.color.split(' ')[0]} flex items-center justify-center`}>
                  <doc.icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900">{doc.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{doc.desc}</p>
                <div className="text-sm font-semibold text-blue-600 inline-flex items-center gap-1 cursor-pointer hover:gap-2 transition-all">
                  Read the full document <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 max-w-4xl mx-auto">
            <div className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-2">Risk Warning</div>
            <p className="text-xs text-amber-800/80 leading-relaxed">
              Leveraged products such as CFD's and Forex trading are complex instruments with a high
              risk of losing money. The products offered are intended for professional and retail
              clients. Please note that client accounts could sustain losses of deposited funds or
              in some cases even exceeding their deposit amount. Since clients can lose more than
              the deposit we advise you to trade responsibly so in case funds were lost in trading
              it does not significantly affect your personal and financial well-being.
            </p>
          </div>
        </div>
      )}

      {/* ===== NEWS ===== */}
      {activeSection === 'news' && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
          <div className="text-center mb-10">
            <div className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">Market News</div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Latest updates from the world of crypto and forex markets
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { src: 'Bitcoin.com', date: '14. Aug. 2026', title: 'Whale Places $203M Short Bet Against Tokenized SpaceX Stock' },
              { src: 'CoinTelegraph', date: '14. Aug. 2026', title: 'RedotPay US IPO delayed amid regulatory, legal hurdles: Report' },
              { src: 'Bitcoin.com', date: '14. Aug. 2026', title: 'SEC Delays Tokenization Exemption Again as CLARITY Act Stalls' },
              { src: 'CoinTelegraph', date: '14. Aug. 2026', title: 'JPMorgan cut Polymarket banking ties over regulatory concerns' },
              { src: 'Bitcoin.com', date: '14. Aug. 2026', title: 'JPMorgan Grows Bitcoin ETF Stake to $356M, Adds XRP Exposure' },
              { src: 'CryptoDaily', date: '14. Aug. 2026', title: 'Crypto payments barely register among euro area merchants, ECB finds' }
            ].map(n => (
              <div key={n.title} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-[11px] font-bold">{n.src}</span>
                  <span className="text-[11px] text-slate-400">{n.date}</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 leading-snug">{n.title}</h3>
                <div className="text-xs font-semibold text-blue-600 inline-flex items-center gap-1">
                  Read more <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== CONTACT ===== */}
      {activeSection === 'contact' && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 space-y-10">
          <div className="text-center max-w-2xl mx-auto">
            <div className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">Contact Us</div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Our Contact Information</h2>
            <p className="text-sm text-slate-500 mt-2">
              Our support team and account managers are available 24/7 for any technical or financial questions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Mail className="w-6 h-6" />
              </div>
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Email Us</div>
              <div className="font-bold text-slate-900">support@tradenation.io</div>
              <div className="text-xs text-slate-500">Support answers within 15 minutes</div>
            </div>

            <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <PhoneCall className="w-6 h-6" />
              </div>
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Call Us</div>
              <div className="font-bold text-slate-900 text-sm">UK: +44 20 4586 2197</div>
              <div className="text-xs text-slate-500">CH: +41 26 500 4302 · CA: +1 587 206 8901</div>
            </div>

            <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <MapPin className="w-6 h-6" />
              </div>
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Head Office</div>
              <div className="font-bold text-slate-900">London, United Kingdom</div>
              <div className="text-xs text-slate-500">By appointment only</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 max-w-2xl mx-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-5">Send a message</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'Full Name *', ph: 'Enter your name' },
                { label: 'Working Email *', ph: 'Enter working email' },
                { label: 'Phone Number *', ph: 'Your Contact Number...' },
                { label: 'Company', ph: 'Enter company name' },
                { label: 'Subject *', ph: 'Enter subject' },
                { label: 'Position', ph: 'Enter position' }
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">{f.label}</label>
                  <input
                    type="text"
                    placeholder={f.ph}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                  />
                </div>
              ))}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Message *</label>
                <textarea
                  rows={4}
                  placeholder="Type your message here.."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                ></textarea>
              </div>
            </div>
            <button
              type="button"
              className="mt-5 px-7 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-blue-600/20 cursor-pointer"
            >
              Send Message
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
