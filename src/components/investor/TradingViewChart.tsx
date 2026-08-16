// ============================================================
//  TradingView widgets (free embeddable widgets).
//  Loaded lazily from s3.tradingview.com and themed to match
//  the platform (dark background + gold accent).
//
//  IMPORTANT — outbound navigation is disabled:
//  the display-only widgets (ticker tape, market overview,
//  mini charts) are rendered inside a `pointer-events: none`
//  wrapper, so a visitor can never click a symbol and be sent
//  to tradingview.com. They stay purely informational.
//  Only the trading terminal chart stays interactive, because
//  the client needs zoom, drawing tools and timeframes there.
//
//  NOTE: the small TradingView logo inside the widget is
//  required by their free-usage terms and must stay.
// ============================================================
import { useEffect, useRef, memo } from 'react';

const THEME = {
  backgroundColor: 'rgba(15, 17, 22, 1)',
  gridColor: 'rgba(245, 180, 0, 0.06)',
};

/** Injects a TradingView widget script into a container */
function useWidget(src: string, config: Record<string, unknown>, deps: unknown[] = []) {
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    el.innerHTML = '';

    const mount = document.createElement('div');
    mount.className = 'tradingview-widget-container';
    mount.style.height = '100%';

    const inner = document.createElement('div');
    inner.className = 'tradingview-widget-container__widget';
    inner.style.height = '100%';
    mount.appendChild(inner);

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.type = 'text/javascript';
    script.innerHTML = JSON.stringify(config);
    mount.appendChild(script);

    el.appendChild(mount);
    return () => {
      el.innerHTML = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return holder;
}

/**
 * Wrapper that makes a widget read-only.
 * `pointer-events: none` stops every click/tap from reaching the iframe,
 * so no symbol can open tradingview.com. Purely visual, data keeps updating.
 */
const ReadOnly: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties }> = ({
  children,
  className = '',
  style,
}) => (
  <div className={`relative select-none ${className}`} style={style} aria-hidden="false">
    <div style={{ pointerEvents: 'none' }}>{children}</div>
  </div>
);

/** Full advanced chart — stays interactive (trading terminal) */
export const AdvancedChart = memo(({ symbol, height = 480 }: { symbol: string; height?: number }) => {
  const ref = useWidget(
    'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js',
    {
      autosize: true,
      symbol,
      interval: 'D',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      hide_side_toolbar: false,
      allow_symbol_change: false,
      withdateranges: true,
      details: true,
      calendar: false,
      support_host: 'https://www.tradingview.com',
      ...THEME,
    },
    [symbol],
  );

  return <div ref={ref} style={{ height }} className="w-full rounded-xl overflow-hidden" />;
});
AdvancedChart.displayName = 'AdvancedChart';

/** Compact symbol overview — read-only */
export const MiniChart = memo(({ symbol, height = 220 }: { symbol: string; height?: number }) => {
  const ref = useWidget(
    'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js',
    {
      symbol,
      width: '100%',
      height,
      locale: 'en',
      dateRange: '3M',
      colorTheme: 'dark',
      isTransparent: true,
      autosize: false,
      chartOnly: false,
      noTimeScale: false,
    },
    [symbol, height],
  );

  return (
    <ReadOnly>
      <div ref={ref} style={{ height }} className="w-full" />
    </ReadOnly>
  );
});
MiniChart.displayName = 'MiniChart';

/** Scrolling quotes ticker — read-only */
export const TickerTape = memo(() => {
  const ref = useWidget('https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js', {
    symbols: [
      { proName: 'BITSTAMP:BTCUSD', title: 'Bitcoin' },
      { proName: 'BITSTAMP:ETHUSD', title: 'Ethereum' },
      { proName: 'FX_IDC:EURUSD', title: 'EUR/USD' },
      { proName: 'OANDA:XAUUSD', title: 'Gold' },
      { proName: 'NASDAQ:AAPL', title: 'Apple' },
      { proName: 'NASDAQ:TSLA', title: 'Tesla' },
      { proName: 'NASDAQ:NVDA', title: 'Nvidia' },
      { proName: 'TVC:USOIL', title: 'Crude Oil' },
    ],
    showSymbolLogo: true,
    isTransparent: true,
    displayMode: 'adaptive',
    colorTheme: 'dark',
    locale: 'en',
  });

  return (
    <ReadOnly>
      <div ref={ref} className="w-full" />
    </ReadOnly>
  );
});
TickerTape.displayName = 'TickerTape';

/* ============================================================
   Market overview.
   The widget itself is read-only, so its built-in tabs would be
   dead. Instead we expose the categories as our own buttons and
   feed the widget a single tab at a time — same UX, no outbound
   links.
   ============================================================ */
export type MarketTab = 'Indices' | 'Crypto' | 'Forex' | 'Commodities';

export const MARKET_TABS: MarketTab[] = ['Indices', 'Crypto', 'Forex', 'Commodities'];

const TAB_SYMBOLS: Record<MarketTab, { s: string; d: string }[]> = {
  Indices: [
    { s: 'FOREXCOM:SPXUSD', d: 'S&P 500' },
    { s: 'FOREXCOM:NSXUSD', d: 'Nasdaq 100' },
    { s: 'FOREXCOM:DJI', d: 'Dow 30' },
    { s: 'INDEX:DEU40', d: 'DAX' },
    { s: 'FOREXCOM:UKXGBP', d: 'FTSE 100' },
  ],
  Crypto: [
    { s: 'BITSTAMP:BTCUSD', d: 'Bitcoin' },
    { s: 'BITSTAMP:ETHUSD', d: 'Ethereum' },
    { s: 'BINANCE:SOLUSDT', d: 'Solana' },
    { s: 'BINANCE:BNBUSDT', d: 'BNB' },
    { s: 'BINANCE:XRPUSDT', d: 'Ripple' },
  ],
  Forex: [
    { s: 'FX:EURUSD', d: 'EUR/USD' },
    { s: 'FX:GBPUSD', d: 'GBP/USD' },
    { s: 'FX:USDJPY', d: 'USD/JPY' },
    { s: 'FX:AUDCAD', d: 'AUD/CAD' },
    { s: 'FX:USDCHF', d: 'USD/CHF' },
  ],
  Commodities: [
    { s: 'OANDA:XAUUSD', d: 'Gold' },
    { s: 'OANDA:XAGUSD', d: 'Silver' },
    { s: 'TVC:USOIL', d: 'Crude Oil' },
    { s: 'TVC:UKOIL', d: 'Brent Oil' },
    { s: 'NYMEX:NG1!', d: 'Natural Gas' },
  ],
};

export const MarketOverview = memo(({ tab = 'Indices', height = 460 }: { tab?: MarketTab; height?: number }) => {
  const ref = useWidget(
    'https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js',
    {
      colorTheme: 'dark',
      dateRange: '3M',
      showChart: true,
      locale: 'en',
      isTransparent: true,
      showSymbolLogo: true,
      showFloatingTooltip: false,
      width: '100%',
      height,
      plotLineColorGrowing: 'rgba(245, 180, 0, 1)',
      plotLineColorFalling: 'rgba(239, 68, 68, 1)',
      gridLineColor: 'rgba(255, 255, 255, 0.06)',
      scaleFontColor: 'rgba(148, 163, 184, 1)',
      belowLineFillColorGrowing: 'rgba(245, 180, 0, 0.12)',
      belowLineFillColorFalling: 'rgba(239, 68, 68, 0.12)',
      belowLineFillColorGrowingBottom: 'rgba(245, 180, 0, 0)',
      belowLineFillColorFallingBottom: 'rgba(239, 68, 68, 0)',
      symbolActiveColor: 'rgba(245, 180, 0, 0.12)',
      tabs: [{ title: tab, symbols: TAB_SYMBOLS[tab] }],
    },
    [tab, height],
  );

  return (
    <ReadOnly style={{ minHeight: height }}>
      <div ref={ref} style={{ minHeight: height }} className="w-full" />
    </ReadOnly>
  );
});
MarketOverview.displayName = 'MarketOverview';
