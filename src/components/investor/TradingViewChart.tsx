// ============================================================
//  TradingView widgets (free embeddable widgets).
//  Loaded lazily from s3.tradingview.com and themed to match
//  the platform (dark background + gold accent).
//
//  All widgets are fully interactive: hovering shows tooltips,
//  the market overview switches its own tabs and a symbol click
//  opens the live chart. This keeps the landing page feeling
//  alive, which matters more than hiding the source.
//
//  NOTE: the small TradingView logo inside the widget is
//  required by their free-usage terms and must stay.
// ============================================================
import { useEffect, useRef, memo } from 'react';

const THEME = {
  backgroundColor: 'rgba(255, 255, 255, 1)',
  gridColor: 'rgba(228, 222, 203, 0.4)',
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

/** Full advanced chart — stays interactive (trading terminal) */
export const AdvancedChart = memo(({ symbol, height = 480 }: { symbol: string; height?: number }) => {
  const ref = useWidget(
    'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js',
    {
      autosize: true,
      symbol,
      interval: 'D',
      timezone: 'Etc/UTC',
      theme: 'light',
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
      colorTheme: 'light',
      isTransparent: true,
      autosize: false,
      chartOnly: false,
      noTimeScale: false,
      trendLineColor: 'rgba(176, 139, 72, 1)',
      underLineColor: 'rgba(176, 139, 72, 0.15)',
      underLineBottomColor: 'rgba(176, 139, 72, 0)',
    },
    [symbol, height],
  );

  return <div ref={ref} style={{ height }} className="w-full" />;
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
    colorTheme: 'light',
    locale: 'en',
  });

  return <div ref={ref} className="w-full" />;
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

export const MarketOverview = memo(({ height = 460 }: { height?: number }) => {
  const ref = useWidget(
    'https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js',
    {
      colorTheme: 'light',
      dateRange: '3M',
      showChart: true,
      locale: 'en',
      isTransparent: true,
      showSymbolLogo: true,
      showFloatingTooltip: true,
      width: '100%',
      height,
      plotLineColorGrowing: 'rgba(28, 65, 44, 1)',
      plotLineColorFalling: 'rgba(225, 29, 72, 1)',
      gridLineColor: 'rgba(228, 222, 203, 0.4)',
      scaleFontColor: 'rgba(33, 53, 50, 0.7)',
      belowLineFillColorGrowing: 'rgba(176, 139, 72, 0.15)',
      belowLineFillColorFalling: 'rgba(225, 29, 72, 0.12)',
      belowLineFillColorGrowingBottom: 'rgba(176, 139, 72, 0)',
      belowLineFillColorFallingBottom: 'rgba(225, 29, 72, 0)',
      symbolActiveColor: 'rgba(176, 139, 72, 0.15)',
      tabs: MARKET_TABS.map(t => ({ title: t, symbols: TAB_SYMBOLS[t] })),
    },
    [height],
  );

  return <div ref={ref} style={{ minHeight: height }} className="w-full" />;
});
MarketOverview.displayName = 'MarketOverview';

/* ============================================================
   Real-Time Market Data — the large grouped quotes table from
   the client's reference videos: sections (Indices, Bonds,
   Forex, Commodities) with price, change and day range.
   Light theme, because it lives on the landing page.
   ============================================================ */
export const MarketQuotes = memo(({ height = 620 }: { height?: number }) => {
  const ref = useWidget(
    'https://s3.tradingview.com/external-embedding/embed-widget-market-quotes.js',
    {
      width: '100%',
      height,
      symbolsGroups: [
        {
          name: 'Indices',
          originalName: 'Indices',
          symbols: [
            { name: 'FOREXCOM:SPXUSD', displayName: 'S&P 500' },
            { name: 'FOREXCOM:NSXUSD', displayName: 'Nasdaq 100' },
            { name: 'FOREXCOM:DJI', displayName: 'Dow 30' },
            { name: 'INDEX:NKY', displayName: 'Nikkei 225' },
            { name: 'INDEX:DEU40', displayName: 'DAX Index' },
            { name: 'FOREXCOM:UKXGBP', displayName: 'FTSE 100' },
          ],
        },
        {
          name: 'Bonds',
          originalName: 'Bonds',
          // Bond ETFs rather than futures or yield indices: those two feeds are
          // permissioned and render as blank rows in the free widget, while the
          // ETFs quote normally.
          symbols: [
            { name: 'NASDAQ:TLT', displayName: 'US 20+ Year Treasury' },
            { name: 'NASDAQ:IEF', displayName: 'US 7-10 Year Treasury' },
            { name: 'NASDAQ:SHY', displayName: 'US 1-3 Year Treasury' },
            { name: 'AMEX:LQD', displayName: 'Investment Grade Corp' },
            { name: 'AMEX:HYG', displayName: 'High Yield Corp' },
          ],
        },
        {
          name: 'Forex',
          originalName: 'Forex',
          symbols: [
            { name: 'FX:EURUSD', displayName: 'EUR to USD' },
            { name: 'FX:GBPUSD', displayName: 'GBP to USD' },
            { name: 'FX:USDJPY', displayName: 'USD to JPY' },
            { name: 'FX:USDCHF', displayName: 'USD to CHF' },
            { name: 'FX:AUDUSD', displayName: 'AUD to USD' },
            { name: 'FX:USDCAD', displayName: 'USD to CAD' },
          ],
        },
        {
          name: 'Commodities',
          originalName: 'Commodities',
          symbols: [
            { name: 'OANDA:XAUUSD', displayName: 'Gold' },
            { name: 'OANDA:XAGUSD', displayName: 'Silver' },
            { name: 'TVC:USOIL', displayName: 'Crude Oil' },
            { name: 'TVC:UKOIL', displayName: 'Brent Oil' },
            { name: 'NYMEX:NG1!', displayName: 'Natural Gas' },
          ],
        },
        {
          name: 'Crypto',
          originalName: 'Crypto',
          symbols: [
            { name: 'BITSTAMP:BTCUSD', displayName: 'Bitcoin' },
            { name: 'BITSTAMP:ETHUSD', displayName: 'Ethereum' },
            { name: 'BINANCE:SOLUSDT', displayName: 'Solana' },
            { name: 'BINANCE:BNBUSDT', displayName: 'BNB' },
          ],
        },
      ],
      showSymbolLogo: true,
      isTransparent: true,
      colorTheme: 'light',
      locale: 'en',
      backgroundColor: '#ffffff',
    },
    [height],
  );

  return <div ref={ref} style={{ minHeight: height }} className="w-full" />;
});
MarketQuotes.displayName = 'MarketQuotes';

/* Light-theme mini chart for the landing hero */
export const MiniChartLight = memo(
  ({ symbol, height = 170 }: { symbol: string; height?: number }) => {
    const ref = useWidget(
      'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js',
      {
        symbol,
        width: '100%',
        height,
        locale: 'en',
        dateRange: '3M',
        colorTheme: 'light',
        isTransparent: true,
        autosize: false,
        largeChartUrl: '',
        chartOnly: false,
        noTimeScale: false,
        trendLineColor: 'rgba(176, 139, 72, 1)',
        underLineColor: 'rgba(176, 139, 72, 0.15)',
        underLineBottomColor: 'rgba(176, 139, 72, 0)',
      },
      [symbol, height],
    );
    return <div ref={ref} style={{ minHeight: height }} className="w-full" />;
  },
);
MiniChartLight.displayName = 'MiniChartLight';
