import React, { useState } from 'react';
import type { Investor } from '../../types';
import { 
  Plus, 
  Edit3
} from 'lucide-react';

export interface AdminTrade {
  id: string;
  investorId: string;
  asset: string;
  type: 'LONG' | 'SHORT' | 'SPOT';
  amount: number;
  entryPrice: number;
  currentPrice: number;
  leverage: number;
  pnl: number;
  status: 'OPEN' | 'CLOSED';
}

interface CrmTradesManagerProps {
  investors: Investor[];
  trades: AdminTrade[];
  onUpdateInvestorBalance: (investorId: string, newBalance: number) => void;
  onCreateTrade: (trade: Omit<AdminTrade, 'id' | 'status'>) => void;
  onUpdateTradePnl: (tradeId: string, newPnl: number) => void;
  onCloseTrade: (tradeId: string) => void;
}

export const CrmTradesManager: React.FC<CrmTradesManagerProps> = ({
  investors,
  trades,
  onUpdateInvestorBalance,
  onCreateTrade,
  onUpdateTradePnl,
  onCloseTrade
}) => {
  const [selectedInvestorId, setSelectedInvestorId] = useState<string>(investors[0]?.id || 'inv-01');
  const selectedInvestor = investors.find(i => i.id === selectedInvestorId) || investors[0];

  const [balanceInput, setBalanceInput] = useState<number>(selectedInvestor?.balance || 0);
  const [isEditingBalance, setIsEditingBalance] = useState<boolean>(false);

  // New trade state
  const [showNewTradeModal, setShowNewTradeModal] = useState(false);
  const [asset, setAsset] = useState('BTC/USDT (Crypto Spot)');
  const [type, setType] = useState<'LONG' | 'SHORT' | 'SPOT'>('LONG');
  const [amount, setAmount] = useState(15000);
  const [entryPrice, setEntryPrice] = useState(62400);
  const [leverage, setLeverage] = useState(10);
  const [pnl, setPnl] = useState(1450);

  // Edit PnL modal
  const [editingTrade, setEditingTrade] = useState<AdminTrade | null>(null);
  const [editPnlVal, setEditPnlVal] = useState<number>(0);

  const clientTrades = trades.filter(t => t.investorId === selectedInvestorId);

  const handleSaveBalance = () => {
    if (selectedInvestor) {
      onUpdateInvestorBalance(selectedInvestor.id, balanceInput);
      setIsEditingBalance(false);
    }
  };

  const handleCreateTradeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateTrade({
      investorId: selectedInvestorId,
      asset,
      type,
      amount,
      entryPrice,
      currentPrice: entryPrice * 1.05,
      leverage,
      pnl
    });
    setShowNewTradeModal(false);
  };

  const handleSavePnl = () => {
    if (editingTrade) {
      onUpdateTradePnl(editingTrade.id, editPnlVal);
      setEditingTrade(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Client Selector & Quick Balance Control */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Client Account, Balance & Trades Management
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select a user from the database to manually adjust balances or positions (Crypto Spot / Futures / PnL)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-slate-700 uppercase">Client:</label>
            <select
              value={selectedInvestorId}
              onChange={(e) => {
                setSelectedInvestorId(e.target.value);
                const inv = investors.find(i => i.id === e.target.value);
                if (inv) setBalanceInput(inv.balance);
              }}
              className="px-4 py-2 bg-slate-100 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {investors.map(inv => (
                <option key={inv.id} value={inv.id}>
                  {inv.name} ({inv.email})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Client Balance & Equity Editor Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-5 rounded-2xl border border-slate-200">
          <div>
            <div className="text-xs text-slate-500 font-semibold">Current available balance ($)</div>
            {isEditingBalance ? (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="number"
                  value={balanceInput}
                  onChange={(e) => setBalanceInput(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-lg font-extrabold text-slate-900"
                />
                <button
                  onClick={handleSaveBalance}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer"
                >
                  Save
                </button>
                <button
                  onClick={() => setIsEditingBalance(false)}
                  className="px-2 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs shrink-0 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 mt-1">
                <span className="text-2xl font-extrabold text-emerald-600">
                  ${selectedInvestor?.balance.toLocaleString()}
                </span>
                <button
                  onClick={() => {
                    setBalanceInput(selectedInvestor?.balance || 0);
                    setIsEditingBalance(true);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3 h-3 text-blue-600" />
                  <span>Change balance</span>
                </button>
              </div>
            )}
          </div>

          <div>
            <div className="text-xs text-slate-500 font-semibold">Invested / In trades</div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">
              ${selectedInvestor?.invested.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Active positions and pools</div>
          </div>

          <div>
            <div className="text-xs text-slate-500 font-semibold">Total client profit (PnL)</div>
            <div className="text-2xl font-extrabold text-blue-600 mt-1">
              +${selectedInvestor?.totalProfit.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Cumulative accrued profit</div>
          </div>
        </div>
      </div>

      {/* Trades Table & Open Trade Button */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Client's active trades: {selectedInvestor?.name}
            </h3>
            <p className="text-xs text-slate-500">
              Admin can change profit/loss (PnL), leverage and close trades
            </p>
          </div>
          <button
            onClick={() => setShowNewTradeModal(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm transition-all flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Open trade for client</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                <th className="py-3.5 px-6">Instrument / Asset</th>
                <th className="py-3.5 px-6">Position type</th>
                <th className="py-3.5 px-6">Trade amount ($)</th>
                <th className="py-3.5 px-6">Entry price / Leverage</th>
                <th className="py-3.5 px-6">Current PnL ($)</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Trade control (CRM)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {clientTrades.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-4 px-6 font-bold text-slate-900">
                    {t.asset}
                  </td>
                  <td className="py-4 px-6">
                    <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
                      t.type === 'LONG'
                        ? 'bg-emerald-100 text-emerald-800'
                        : t.type === 'SHORT'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {t.type}
                    </span>
                  </td>
                  <td className="py-4 px-6 font-extrabold text-slate-900">
                    ${t.amount.toLocaleString()}
                  </td>
                  <td className="py-4 px-6 text-xs text-slate-600">
                    <div>Entry: ${t.entryPrice.toLocaleString()}</div>
                    <div className="text-[11px] text-slate-400">Leverage: {t.leverage}x</div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`font-extrabold text-sm ${
                      t.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {t.pnl >= 0 ? `+${t.pnl.toLocaleString()}` : t.pnl.toLocaleString()} $
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    {t.status === 'OPEN' ? (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        Open
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                        Closed
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-right">
                    {t.status === 'OPEN' ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingTrade(t);
                            setEditPnlVal(t.pnl);
                          }}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                          title="Change trade PnL"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Change PnL</span>
                        </button>
                        <button
                          onClick={() => onCloseTrade(t.id)}
                          className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Close trade
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">Completed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {clientTrades.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-xs">
              No open trades for this user yet. Click «+ Open trade for client» to create the first position.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Edit Trade PnL */}
      {editingTrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">
              Change trade PnL (profit/loss)
            </h3>
            <p className="text-xs text-slate-500">
              Trade: <strong>{editingTrade.asset} ({editingTrade.type})</strong> for ${editingTrade.amount.toLocaleString()}
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                New PnL result ($ USD)
              </label>
              <input
                type="number"
                step={100}
                value={editPnlVal}
                onChange={(e) => setEditPnlVal(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-extrabold text-lg"
              />
              <div className="flex items-center gap-2 mt-2">
                {[500, 1500, 3000, -500].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setEditPnlVal(v)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-700"
                  >
                    {v >= 0 ? `+${v}$` : `${v}$`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingTrade(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePnl}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md"
              >
                Save new PnL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create New Trade for Client */}
      {showNewTradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">
              Open a trading position for the client
            </h3>
            <p className="text-xs text-slate-500">
              Investor: <strong>{selectedInvestor?.name}</strong>
            </p>

            <form onSubmit={handleCreateTradeSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Asset / Trading pair
                </label>
                <select
                  value={asset}
                  onChange={(e) => setAsset(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                >
                  <option value="BTC/USDT (Crypto Spot)">BTC/USDT (Crypto Spot)</option>
                  <option value="ETH/USDT (Futures Long 10x)">ETH/USDT (Futures Long)</option>
                  <option value="XAU/USD — Gold (Precious Metal Spot)">XAU/USD — Gold (Spot Metal)</option>
                  <option value="EUR/USD (Forex)">EUR/USD (Forex)</option>
                  <option value="SOL/USDT (Crypto Spot)">SOL/USDT (Crypto Spot)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Trade type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                  >
                    <option value="LONG">LONG (Buy)</option>
                    <option value="SHORT">SHORT (Sell)</option>
                    <option value="SPOT">SPOT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Amount ($ USD)
                  </label>
                  <input
                    type="number"
                    step={1000}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Entry price ($)
                  </label>
                  <input
                    type="number"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Leverage (x)
                  </label>
                  <input
                    type="number"
                    value={leverage}
                    onChange={(e) => setLeverage(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Starting PnL ($)
                </label>
                <input
                  type="number"
                  value={pnl}
                  onChange={(e) => setPnl(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewTradeModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Open trade in portfolio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
