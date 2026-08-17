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

export const INITIAL_INVESTORS: Investor[] = [
  {
    id: 'inv-01',
    name: 'Michael Carter (You)',
    email: 'm.carter@northbridge-cap.com',
    phone: '+1 (415) 555-0182',
    kycStatus: 'verified',
    balance: 26500,
    invested: 98000,
    totalProfit: 12840,
    registrationDate: '2026-01-15',
    manager: 'Laura Bennett (Senior Advisor)',
    documentName: "Driver's License — CA (KYC Verified)"
  },
  {
    id: 'inv-02',
    name: 'James Whitaker',
    email: 'j.whitaker@gmail.com',
    phone: '+1 (312) 555-0147',
    kycStatus: 'verified',
    balance: 85000,
    invested: 320000,
    totalProfit: 44100,
    registrationDate: '2026-02-10',
    manager: 'Laura Bennett (Senior Advisor)',
    documentName: 'US Passport (Verified)'
  },
  {
    id: 'inv-03',
    name: 'Emily Rodriguez',
    email: 'emily.rodriguez@outlook.com',
    phone: '+1 (646) 555-0119',
    kycStatus: 'pending',
    balance: 15000,
    invested: 50000,
    totalProfit: 6200,
    registrationDate: '2026-07-28',
    manager: 'Daniel Foster (Desk 2)',
    documentName: 'State ID (Compliance review)'
  },
  {
    id: 'inv-04',
    name: 'Robert Hayes',
    email: 'r.hayes@mailbox.com',
    phone: '+1 (720) 555-0164',
    kycStatus: 'verified',
    balance: 4200,
    invested: 140000,
    totalProfit: 19800,
    registrationDate: '2026-03-05',
    manager: 'Daniel Foster (Desk 2)',
    documentName: 'US Passport (Verified)'
  },
  {
    id: 'inv-05',
    name: 'Jessica Turner',
    email: 'jessica.turner@gmail.com',
    phone: '+1 (305) 555-0173',
    kycStatus: 'rejected',
    balance: 0,
    invested: 0,
    totalProfit: 0,
    registrationDate: '2026-08-01',
    manager: 'Laura Bennett (Senior Advisor)',
    documentName: 'Blurred scan (KYC retake required)'
  },
  {
    id: 'inv-06',
    name: 'William Brooks',
    email: 'w.brooks@brookscapital.com',
    phone: '+1 (212) 555-0198',
    kycStatus: 'verified',
    balance: 110000,
    invested: 450000,
    totalProfit: 68500,
    registrationDate: '2025-11-20',
    manager: 'Laura Bennett (Senior Advisor)',
    documentName: 'US Passport (Verified)'
  }
];

export const INITIAL_LEADS: Lead[] = [
  {
    id: 'lead-01',
    name: 'Ethan Cooper',
    phone: '+1 (503) 555-0126',
    potentialAmount: 50000,
    stage: 'new',
    notes: 'Interested in BTC/USDT Futures trading with leverage. Left a request on the landing page.',
    manager: 'Laura Bennett (Desk 1)',
    createdAt: '2026-08-11',
    comments: [
      { id: 'c-1', author: 'Laura Bennett', text: 'Requested a call on Thursday. Sending him a platform overview first.', date: '2026-08-12 10:15' }
    ]
  },
  {
    id: 'lead-02',
    name: 'Sophia Mitchell',
    phone: '+1 (214) 555-0158',
    potentialAmount: 25000,
    stage: 'new',
    notes: 'Looking for an alternative to Forex brokers, ready to start trading gold (XAU/USD).',
    manager: 'Daniel Foster (Desk 2)',
    createdAt: '2026-08-12',
    comments: []
  },
  {
    id: 'lead-03',
    name: 'Christopher Reed',
    phone: '+1 (617) 555-0135',
    potentialAmount: 100000,
    stage: 'contact',
    notes: 'First call completed (WebRTC). Asked about margin leverage up to 100x conditions.',
    manager: 'Laura Bennett (Desk 1)',
    createdAt: '2026-08-09',
    comments: [
      { id: 'c-2', author: 'Laura Bennett', text: 'Call went well. Interested in futures. Send conditions + demo access.', date: '2026-08-10 15:40' },
      { id: 'c-3', author: 'Supervisor', text: 'VIP potential. Connect senior advisor on the next call.', date: '2026-08-11 09:05' }
    ]
  },
  {
    id: 'lead-04',
    name: 'Olivia Bennett',
    phone: '+1 (206) 555-0142',
    potentialAmount: 30000,
    stage: 'contact',
    notes: 'Trader from IT. Tomorrow at 14:00 call about Binance quotes integration.',
    manager: 'Daniel Foster (Desk 2)',
    createdAt: '2026-08-08',
    comments: []
  },
  {
    id: 'lead-05',
    name: 'Andrew Sullivan',
    phone: '+1 (702) 555-0187',
    potentialAmount: 75000,
    stage: 'kyc',
    notes: 'Uploaded government ID for KYC verification, waiting for compliance approval.',
    manager: 'Laura Bennett (Desk 1)',
    createdAt: '2026-08-05',
    comments: [
      { id: 'c-4', author: 'Laura Bennett', text: 'Docs submitted. Sent to compliance.', date: '2026-08-06 12:30' }
    ]
  },
  {
    id: 'lead-06',
    name: 'Hannah Foster',
    phone: '+1 (480) 555-0193',
    potentialAmount: 15000,
    stage: 'kyc',
    notes: 'Pre-account opened for EUR/USD and SOL/USDT trading.',
    manager: 'Daniel Foster (Desk 2)',
    createdAt: '2026-08-06',
    comments: []
  }
];

export const INITIAL_REQUESTS: TransactionRequest[] = [
  {
    id: 'req-201',
    investorId: 'inv-03',
    investorName: 'Olga Vorontsova',
    type: 'deposit',
    amount: 15000,
    status: 'pending',
    date: '2026-08-12 11:45',
    method: 'Crypto gateway (USDT TRC20)'
  },
  {
    id: 'req-202',
    investorId: 'inv-04',
    investorName: 'Dmitry Belousov',
    type: 'withdrawal',
    amount: 5000,
    status: 'pending',
    date: '2026-08-11 18:20',
    method: 'Profit withdrawal to bank account'
  },
  {
    id: 'req-203',
    investorId: 'inv-02',
    investorName: 'Mikhail Sokolov',
    type: 'deposit',
    amount: 50000,
    status: 'approved',
    date: '2026-08-10 14:10',
    method: 'Bank transfer (SWIFT / SEPA)'
  },
  {
    id: 'req-204',
    investorId: 'inv-01',
    investorName: 'Michael Carter (You)',
    type: 'deposit',
    amount: 10000,
    status: 'approved',
    date: '2026-08-08 09:30',
    method: 'Crypto gateway (USDT TRC20)'
  }
];

export const INITIAL_MY_INVESTMENTS: ActiveInvestment[] = [
  {
    id: 'my-01',
    projectId: 'p-101',
    projectTitle: 'BTC/USDT — Spot & Futures Trading',
    categoryLabel: 'Crypto Spot / Futures',
    amount: 35000,
    date: '2026-02-18',
    apr: 24.5,
    nextPayoutDate: '2026-09-01',
    entryPrice: 64337.56,
    accruedProfit: 4810
  },
  {
    id: 'my-02',
    projectId: 'p-102',
    projectTitle: 'ETH/USDT — Ethereum Perpetual Futures',
    categoryLabel: 'Perpetual Futures',
    amount: 38000,
    date: '2026-03-10',
    apr: 32.0,
    nextPayoutDate: '2026-09-01',
    entryPrice: 3182.4,
    accruedProfit: 5760
  },
  {
    id: 'my-03',
    projectId: 'p-103',
    projectTitle: 'XAU/USD — Gold / Precious Metal Spot',
    categoryLabel: 'Forex & Metals',
    amount: 15000,
    date: '2026-04-20',
    apr: 18.0,
    nextPayoutDate: '2026-09-01',
    entryPrice: 2415.3,
    accruedProfit: 1480
  },
  {
    id: 'my-04',
    projectId: 'p-106',
    projectTitle: 'AI Quant Strategy Pool (Binance Feed)',
    categoryLabel: 'Algorithmic Pool',
    amount: 10000,
    date: '2026-06-15',
    apr: 28.4,
    nextPayoutDate: '2026-09-15',
    entryPrice: 1.0,
    accruedProfit: 790
  }
];

export const PORTFOLIO_HISTORY = [
  { month: 'Jan', capital: 45000, profit: 800 },
  { month: 'Feb', capital: 75000, profit: 2100 },
  { month: 'Mar', capital: 90000, profit: 3800 },
  { month: 'Apr', capital: 105000, profit: 5400 },
  { month: 'May', capital: 110000, profit: 7200 },
  { month: 'Jun', capital: 115000, profit: 9100 },
  { month: 'Jul', capital: 120000, profit: 11000 },
  { month: 'Aug', capital: 124500, profit: 12840 }
];

export const CRM_AUM_MONTHS = [
  { month: 'Jan 26', aum: 1.8, activeInvestors: 18 },
  { month: 'Feb 26', aum: 2.2, activeInvestors: 24 },
  { month: 'Mar 26', aum: 2.6, activeInvestors: 31 },
  { month: 'Apr 26', aum: 2.9, activeInvestors: 37 },
  { month: 'May 26', aum: 3.2, activeInvestors: 42 },
  { month: 'Jun 26', aum: 3.5, activeInvestors: 49 },
  { month: 'Jul 26', aum: 3.7, activeInvestors: 55 },
  { month: 'Aug 26', aum: 3.85, activeInvestors: 62 }
];
