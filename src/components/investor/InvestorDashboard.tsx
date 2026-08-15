import React from 'react';
import { 
  Wallet, 
  ArrowUpRight, 
  ShieldCheck, 
  PieChart, 
  Calendar, 
  DollarSign, 
  Briefcase, 
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { ActiveInvestment } from '../../types';
import { PORTFOLIO_HISTORY } from '../../data/mockData';

interface InvestorDashboardProps {
  investorBalance: number;
  myInvestments: ActiveInvestment[];
  onOpenCatalog: () => void;
  onOpenDepositModal: () => void;
  onOpenWithdrawModal: () => void;
  onClaimDividends: (id: string, profit: number) => void;
}

export const InvestorDashboard: React.FC<InvestorDashboardProps> = ({
  investorBalance,
  myInvestments,
  onOpenCatalog,
  onOpenDepositModal,
  onOpenWithdrawModal,
  onClaimDividends
}) => {
  const totalInvested = myInvestments.reduce((sum, inv) => sum + inv.amount, 0);
  const totalAccrued = myInvestments.reduce((sum, inv) => sum + inv.accruedProfit, 0);
  const totalPortfolioValue = totalInvested + investorBalance + totalAccrued;

  return (
    <div className="space-y-6">
      {/* Welcome & Quick actions bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">
              Welcome back, Alexander!
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              KYC Verified
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Your trading portfolio is growing. Today <span className="text-emerald-600 font-semibold">+$420</span> in profit accrued.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenDepositModal}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition-all flex items-center gap-2 shadow-sm shadow-blue-600/20 cursor-pointer"
          >
            <Wallet className="w-4 h-4" />
            <span>Deposit</span>
          </button>
          <button
            onClick={onOpenWithdrawModal}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <span>Withdraw</span>
          </button>
          <button
            onClick={onOpenCatalog}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-medium rounded-xl text-sm transition-all flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Invest</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-sm">
            <span>Total portfolio value</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <PieChart className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            ${totalPortfolioValue.toLocaleString()}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-600 font-medium">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+14.2% average annual return</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-sm">
            <span>Invested in assets</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            ${totalInvested.toLocaleString()}
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-500 mt-2">
            <span>Active: {myInvestments.length} trading positions</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-sm">
            <span>Available balance</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-2">
            ${investorBalance.toLocaleString()}
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-500 mt-2">
            <span>Available for new trades</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-sm">
            <span>Accrued profit</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            ${totalAccrued.toLocaleString()}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-600 font-medium">
            <span>Next payout: September 1</span>
          </div>
        </div>
      </div>

      {/* Main Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Capital Growth ($)</h2>
              <p className="text-xs text-slate-500">Portfolio value in 2026</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                Portfolio equity
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={PORTFOLIO_HISTORY} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCapital" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} tickFormatter={(val) => `$${val/1000}k`} />
                <Tooltip 
                  formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Balance']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                />
                <Area type="monotone" dataKey="capital" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorCapital)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right card - Portfolio structure */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Your Asset Allocation</h3>
            <p className="text-xs text-slate-500 mb-4">
              Portfolio distribution by market and strategy
            </p>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-slate-700">BTC/USDT Spot & Futures</span>
                  <span className="text-slate-900 font-bold">$35,000 (36%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-blue-600 h-full rounded-full" style={{ width: '36%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-slate-700">ETH/USDT Perpetual Futures</span>
                  <span className="text-slate-900 font-bold">$38,000 (39%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full rounded-full" style={{ width: '39%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-slate-700">XAU/USD Gold</span>
                  <span className="text-slate-900 font-bold">$15,000 (15%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-600 h-full rounded-full" style={{ width: '15%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-slate-700">AI Quant Strategy Pool</span>
                  <span className="text-slate-900 font-bold">$10,000 (10%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-purple-600 h-full rounded-full" style={{ width: '10%' }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 bg-slate-50 p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-800">Your personal manager:</div>
                <div className="text-xs text-slate-600 mt-0.5">Elena Smirnova (Senior Advisor)</div>
              </div>
              <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded-md font-medium">
                Online
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Investments Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">My Active Trades</h2>
            <p className="text-xs text-slate-500">
              Open positions, performance and accrued profit
            </p>
          </div>
          <button 
            onClick={onOpenCatalog}
            className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
          >
            <span>New offers in the market</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                <th className="py-3.5 px-6">Asset / Strategy</th>
                <th className="py-3.5 px-6">Category</th>
                <th className="py-3.5 px-6">Amount</th>
                <th className="py-3.5 px-6">Return (APR)</th>
                <th className="py-3.5 px-6">Accrued profit</th>
                <th className="py-3.5 px-6">Next payout</th>
                <th className="py-3.5 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {myInvestments.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-4 px-6 font-semibold text-slate-900">
                    {inv.projectTitle}
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                      {inv.categoryLabel}
                    </span>
                  </td>
                  <td className="py-4 px-6 font-bold text-slate-900">
                    ${inv.amount.toLocaleString()}
                  </td>
                  <td className="py-4 px-6">
                    <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                      {inv.apr}% p.a.
                    </span>
                  </td>
                  <td className="py-4 px-6 font-bold text-emerald-600">
                    +${inv.accruedProfit.toLocaleString()}
                  </td>
                  <td className="py-4 px-6 text-slate-500 text-xs">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{inv.nextPayoutDate}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right">
                    {inv.accruedProfit > 0 ? (
                      <button
                        onClick={() => onClaimDividends(inv.id, inv.accruedProfit)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors shadow-sm cursor-pointer"
                        title="Move accrued profit to available balance"
                      >
                        Claim profit
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">Paid out</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
