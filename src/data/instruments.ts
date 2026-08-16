// ============================================================
//  Tradable instruments grouped the way TradingView does it:
//  the client picks a category, then a symbol, then sees the
//  live chart for it.
//  `tv` is the TradingView symbol used by the chart widget.
// ============================================================

export type AssetCategory = 'Stocks' | 'Commodities' | 'Crypto' | 'Currencies';

export interface Instrument {
  symbol: string;
  name: string;
  tv: string;
  category: AssetCategory;
  exchange: string;
  kind: string;
}

export const INSTRUMENTS: Instrument[] = [
  // ---------- Crypto ----------
  { symbol: 'BTCUSD', name: 'Bitcoin', tv: 'BITSTAMP:BTCUSD', category: 'Crypto', exchange: 'Bitstamp', kind: 'spot crypto' },
  { symbol: 'ETHUSD', name: 'Ethereum', tv: 'BITSTAMP:ETHUSD', category: 'Crypto', exchange: 'Bitstamp', kind: 'spot crypto' },
  { symbol: 'SOLUSDT', name: 'Solana', tv: 'BINANCE:SOLUSDT', category: 'Crypto', exchange: 'Binance', kind: 'spot crypto' },
  { symbol: 'BNBUSDT', name: 'BNB', tv: 'BINANCE:BNBUSDT', category: 'Crypto', exchange: 'Binance', kind: 'spot crypto' },
  { symbol: 'XRPUSDT', name: 'Ripple', tv: 'BINANCE:XRPUSDT', category: 'Crypto', exchange: 'Binance', kind: 'spot crypto' },
  { symbol: 'LINKUSDT', name: 'Chainlink', tv: 'BINANCE:LINKUSDT', category: 'Crypto', exchange: 'Binance', kind: 'spot crypto' },

  // ---------- Stocks ----------
  { symbol: 'AAPL', name: 'Apple Inc.', tv: 'NASDAQ:AAPL', category: 'Stocks', exchange: 'NASDAQ', kind: 'stock' },
  { symbol: 'TSLA', name: 'Tesla, Inc.', tv: 'NASDAQ:TSLA', category: 'Stocks', exchange: 'NASDAQ', kind: 'stock' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', tv: 'NASDAQ:NVDA', category: 'Stocks', exchange: 'NASDAQ', kind: 'stock' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', tv: 'NASDAQ:MSFT', category: 'Stocks', exchange: 'NASDAQ', kind: 'stock' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', tv: 'NASDAQ:AMZN', category: 'Stocks', exchange: 'NASDAQ', kind: 'stock' },
  { symbol: 'META', name: 'Meta Platforms, Inc.', tv: 'NASDAQ:META', category: 'Stocks', exchange: 'NASDAQ', kind: 'stock' },

  // ---------- Commodities ----------
  { symbol: 'XAUUSD', name: 'Gold', tv: 'OANDA:XAUUSD', category: 'Commodities', exchange: 'OANDA', kind: 'commodity cfd' },
  { symbol: 'XAGUSD', name: 'Silver', tv: 'OANDA:XAGUSD', category: 'Commodities', exchange: 'OANDA', kind: 'commodity cfd' },
  { symbol: 'USOIL', name: 'Crude Oil WTI', tv: 'TVC:USOIL', category: 'Commodities', exchange: 'TVC', kind: 'commodity cfd' },
  { symbol: 'UKOIL', name: 'Brent Oil', tv: 'TVC:UKOIL', category: 'Commodities', exchange: 'TVC', kind: 'commodity cfd' },
  { symbol: 'NG1!', name: 'Natural Gas', tv: 'NYMEX:NG1!', category: 'Commodities', exchange: 'NYMEX', kind: 'futures' },
  { symbol: 'XPTUSD', name: 'Platinum', tv: 'OANDA:XPTUSD', category: 'Commodities', exchange: 'OANDA', kind: 'commodity cfd' },

  // ---------- Currencies ----------
  { symbol: 'EURUSD', name: 'Euro / U.S. Dollar', tv: 'FX:EURUSD', category: 'Currencies', exchange: 'FX', kind: 'forex' },
  { symbol: 'GBPUSD', name: 'British Pound / U.S. Dollar', tv: 'FX:GBPUSD', category: 'Currencies', exchange: 'FX', kind: 'forex' },
  { symbol: 'USDJPY', name: 'U.S. Dollar / Japanese Yen', tv: 'FX:USDJPY', category: 'Currencies', exchange: 'FX', kind: 'forex' },
  { symbol: 'AUDCAD', name: 'Australian Dollar / Canadian Dollar', tv: 'FX:AUDCAD', category: 'Currencies', exchange: 'FX', kind: 'forex' },
  { symbol: 'USDCHF', name: 'U.S. Dollar / Swiss Franc', tv: 'FX:USDCHF', category: 'Currencies', exchange: 'FX', kind: 'forex' },
  { symbol: 'USDCAD', name: 'U.S. Dollar / Canadian Dollar', tv: 'FX:USDCAD', category: 'Currencies', exchange: 'FX', kind: 'forex' },
];

export const ASSET_CATEGORIES: AssetCategory[] = ['Stocks', 'Commodities', 'Crypto', 'Currencies'];
