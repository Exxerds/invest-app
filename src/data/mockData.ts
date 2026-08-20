import type { Project, Investor, Lead, TransactionRequest, ActiveInvestment } from '../types';

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'p-101',
    title: 'BTC/USDT — Spot & Futures Trading',
    category: 'crypto',
    categoryLabel: 'Crypto Spot / Futures',
    targetAmount: 1000000,
    raisedAmount: 820000,
    apr: 24.5,
    termMonths: 12,
    minCheck: 1000,
    riskLevel: 'medium',
    status: 'active',
    description: 'Trade the leading cryptocurrency with a direct Binance price feed. Spot orders and margin leverage up to 100x.',
    imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
    tags: ['Binance Feed', 'Spot & Futures', 'Leverage 1x-100x']
  },
  {
    id: 'p-102',
    title: 'ETH/USDT — Ethereum Perpetual Futures',
    category: 'futures',
    categoryLabel: 'Perpetual Futures',
    targetAmount: 500000,
    raisedAmount: 410000,
    apr: 32.0,
    termMonths: 6,
    minCheck: 2500,
    riskLevel: 'high',
    status: 'active',
    description: 'Ethereum perpetual futures with automatic Stop Loss / Take Profit control and instant PnL calculation.',
    imageUrl: 'https://images.unsplash.com/photo-1622630998477-20aa696ecb05?auto=format&fit=crop&w=800&q=80',
    tags: ['Ethereum', 'Futures 20x', 'Stop Loss / TP']
  },
  {
    id: 'p-103',
    title: 'XAU/USD — Gold / Precious Metal Spot',
    category: 'forex',
    categoryLabel: 'Forex & Metals',
    targetAmount: 800000,
    raisedAmount: 640000,
    apr: 18.0,
    termMonths: 12,
    minCheck: 5000,
    riskLevel: 'low',
    status: 'active',
    description: 'Gold trading with Twelve Data quotes. Inflation-protected asset with high liquidity on global exchanges.',
    imageUrl: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=800&q=80',
    tags: ['Gold XAU', 'Twelve Data', 'Safe-haven asset']
  },
  {
    id: 'p-104',
    title: 'SOL/USDT — Solana Trading Pool',
    category: 'crypto',
    categoryLabel: 'Crypto Spot / Futures',
    targetAmount: 400000,
    raisedAmount: 380000,
    apr: 45.0,
    termMonths: 6,
    minCheck: 1000,
    riskLevel: 'high',
    status: 'active',
    description: 'High-yield strategies on Solana. Instant Market and Limit order execution in a single interface.',
    imageUrl: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=800&q=80',
    tags: ['Solana', 'High volatility', 'Market/Limit']
  },
  {
    id: 'p-105',
    title: 'EUR/USD — Forex Currency Pair',
    category: 'forex',
    categoryLabel: 'Forex & Metals',
    targetAmount: 600000,
    raisedAmount: 600000,
    apr: 14.2,
    termMonths: 12,
    minCheck: 2500,
    riskLevel: 'low',
    status: 'funded',
    description: 'Classic currency trading on the international Forex market with tight spreads and margin support.',
    imageUrl: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=800&q=80',
    tags: ['Forex', 'EUR/USD', 'Pool closed']
  },
  {
    id: 'p-106',
    title: 'AI Quant Strategy Pool (Binance Feed)',
    category: 'pool',
    categoryLabel: 'Algorithmic Pool',
    targetAmount: 750000,
    raisedAmount: 520000,
    apr: 28.4,
    termMonths: 12,
    minCheck: 5000,
    riskLevel: 'medium',
    status: 'active',
    description: 'Algorithmic trading pool using high-frequency arbitrage on spot and futures markets.',
    imageUrl: 'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?auto=format&fit=crop&w=800&q=80',
    tags: ['AI Quant', 'Arbitrage', '24/7 Trading']
  }
];

/* ============================================================
   NO SAMPLE CLIENTS, LEADS, REQUESTS OR POSITIONS.

   These arrays used to be full of demo records, and the app fell back
   to them whenever the API returned nothing — which is why a freshly
   registered account greeted the client with $98,000 invested, a
   $111,000 portfolio and four positions they never opened.

   Everything below is now empty on purpose: balances, positions, leads
   and requests may only come from the server. Do not re-add fixtures
   here — seed the database instead.
   ============================================================ */

export const INITIAL_INVESTORS: Investor[] = [];

export const INITIAL_LEADS: Lead[] = [];

export const INITIAL_REQUESTS: TransactionRequest[] = [];

export const INITIAL_MY_INVESTMENTS: ActiveInvestment[] = [];
