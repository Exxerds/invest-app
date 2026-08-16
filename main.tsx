// ============================================================
//  Trading control (PDF pages 6-10): admin manages client
//  balances, spot/futures positions, PnL, leverage, liquidation.
//  Dark + gold theme matching the reference screenshots.
// ============================================================
import React, { useState } from 'react';
import type { Investor } from '../../types';
import { Plus, Edit3, Wallet, TrendingUp, BarChart3, Zap } from 'lucide-react';
import { Card, Btn, Badge, Input, Select, Kpi, Th, Td } from './ui';

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

const Modal: React.FC<{ title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }> = ({
  title,
  subtitle,
  onClose,
  children,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
    <div className="bg-[#14161c] border border-white/[.08] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
      <div>
        <h3 className="text-[16px] font-bold text-white">{title}</h3>
        {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
      <div className="pt-1 text-right">
        <button onClick={onClose} className="text-[11px] text-slate-600 hover:text-slate-400 cursor-pointer">
          Close
        </button>
      </div>
    </div>
  </div>
);

export const CrmTradesManager: React.FC<CrmTradesManagerProps> = ({
  investors,
  trades,
  onUpdateInvestorBalance,
  onCreateTrade,
  onUpdateTradePnl,
  onCloseTrade,
}) => {
  const [selectedInvestorId, setSelectedInvestorId] = useState<string>(investors[0]?.id || 'inv-01');
  const selectedInvestor = investors.find(i => i.id === selectedInvestorId) || investors[0];

  const [balanceInput, setBalanceInput] = useState<number>(selectedInvestor?.balance || 0);
  const [isEditingBalance, setIsEditingBalance] = useState(false);

  const [showNewTradeModal, setShowNewTradeModal] = useState(false);
  const [asset, setAsset] = useState('BTC/USDT (Crypto Spot)');
  const [type, setType] = useState<'LONG' | 'SHORT' | 'SPOT'>('LONG');
  const [amount, setAmount] = useState(15000);
  const [entryPrice, setEntryPrice] = useState(62400);
  const [leverage, setLeverage] = useState(10);
  const [pnl, setPnl] = useState(1450);

  const [editingTrade, setEditingTrade] = useState<AdminTrade | null>(null);
  const [editPnlVal, setEditPnlVal] = useState(0);

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
      pnl,
    });
    setShowNewTradeModal(false);
  };

  return (
    <div className="space-y-5">
      {/* Client selector */}
      <Card className="p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-[16px] font-bold text-white">Client account, balance & positions</h2>
            <p className="text-[12px] text-slate-500 mt-0.5">
              Select a user to adjust balance or positions (Spot / Futures / PnL) in real time
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-bold uppercase text-slate-500">Client</span>
            <Select
              value={selectedInvestorId}
              onChange={e => {
                setSelectedInvestorId(e.target.value);
                const inv = investors.find(i => i.id === e.target.value);
                if (inv) setBalanceInput(inv.balance);
              }}
              className="min-w-64"
            >
              {investors.map(inv => (
                <option key={inv.id} value={inv.id}>
                  {inv.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {/* Balance controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 md:col-span-2">
          <div className="text-[11px] text-slate-500 font-semibold uppercase">Available balance</div>
          {isEditingBalance ? (
            <div className="flex items-center gap-2 mt-2">
              <Input
                type="number"
                value={balanceInput}
                onChange={e => setBalanceInput(Number(e.target.value))}
                className="flex-1 text-lg font-extrabold"
              />
              <Btn variant="gold" onClick={handleSaveBalance}>
                Save
              </Btn>
              <Btn variant="ghost" onClick={() => setIsEditingBalance(false)}>
                Cancel
              </Btn>
            </div>
          ) : (
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-2xl font-extrabold text-emerald-400">
                ${selectedInvestor?.balance.toLocaleString('en-US')}
              </span>
              <Btn
                size="sm"
                variant="ghost"
                icon={Edit3}
                onClick={() => {
                  setBalanceInput(selectedInvestor?.balance || 0);
                  setIsEditingBalance(true);
                }}
              >
                Change balance
              </Btn>
            </div>
          )}
        </Card>
        <Kpi icon={Wallet} label="Invested / in trades" value={`$${(selectedInvestor?.invested || 0).toLocaleString('en-US')}`} tone="blue" />
        <Kpi icon={TrendingUp} label="Total client PnL" value={`+$${(selectedInvestor?.totalProfit || 0).toLocaleString('en-US')}`} tone="green" />
      </div>

      {/* Positions */}
      <Card
        title={`Positions — ${selectedInvestor?.name}`}
        subtitle="Change PnL, leverage, entry price, force close or liquidate"
        actions={
          <Btn variant="gold" icon={Plus} onClick={() => setShowNewTradeModal(true)}>
            Open trade for client
          </Btn>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white/[.02] border-b border-white/[.06]">
              <tr>
                <Th>Instrument</Th>
                <Th>Side</Th>
                <Th>Amount</Th>
                <Th>Entry / Leverage</Th>
                <Th>PnL</Th>
                <Th>Status</Th>
                <Th className="text-right">Control</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[.05]">
              {clientTrades.map(t => (
                <tr key={t.id} className="hover:bg-white/[.02] transition-colors">
                  <Td className="font-semibold text-white">{t.asset}</Td>
                  <Td>
                    <Badge tone={t.type === 'LONG' ? 'green' : t.type === 'SHORT' ? 'red' : 'blue'}>{t.type}</Badge>
                  </Td>
                  <Td className="font-extrabold text-white">${t.amount.toLocaleString('en-US')}</Td>
                  <Td>
                    <div className="text-[12px]">${t.entryPrice.toLocaleString('en-US')}</div>
                    <div className="text-[11px] text-slate-600">Leverage {t.leverage}x</div>
                  </Td>
                  <Td>
                    <span className={`font-extrabold ${t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {t.pnl >= 0 ? '+' : ''}
                      {t.pnl.toLocaleString('en-US')} $
                    </span>
                  </Td>
                  <Td>
                    <Badge tone={t.status === 'OPEN' ? 'gold' : 'gray'}>{t.status}</Badge>
                  </Td>
                  <Td className="text-right">
                    {t.status === 'OPEN' ? (
                      <div className="flex items-center justify-end gap-2">
                        <Btn
                          size="sm"
                          variant="ghost"
                          icon={Edit3}
                          onClick={() => {
                            setEditingTrade(t);
                            setEditPnlVal(t.pnl);
                          }}
                        >
                          Change PnL
                        </Btn>
                        <Btn size="sm" variant="danger" onClick={() => onCloseTrade(t.id)}>
                          Close
                        </Btn>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-600">Completed</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          {clientTrades.length === 0 && (
            <div className="p-10 text-center text-[12px] text-slate-600">
              No positions yet. Click «Open trade for client» to create the first one.
            </div>
          )}
        </div>
      </Card>

      {/* Edit PnL modal */}
      {editingTrade && (
        <Modal
          title="Change trade PnL"
          subtitle={`${editingTrade.asset} (${editingTrade.type}) · $${editingTrade.amount.toLocaleString('en-US')}`}
          onClose={() => setEditingTrade(null)}
        >
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">New PnL result ($)</label>
            <Input
              type="number"
              step={100}
              value={editPnlVal}
              onChange={e => setEditPnlVal(Number(e.target.value))}
              className="w-full text-lg font-extrabold"
            />
            <div className="flex items-center gap-2 mt-2.5">
              {[500, 1500, 3000, -500].map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setEditPnlVal(v)}
                  className="px-2.5 py-1 bg-white/[.06] hover:bg-white/[.12] rounded-lg text-[11px] font-bold text-slate-300 cursor-pointer"
                >
                  {v >= 0 ? `+${v}$` : `${v}$`}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Btn variant="ghost" onClick={() => setEditingTrade(null)}>
              Cancel
            </Btn>
            <Btn
              variant="gold"
              icon={Zap}
              onClick={() => {
                onUpdateTradePnl(editingTrade.id, editPnlVal);
                setEditingTrade(null);
              }}
            >
              Save new PnL
            </Btn>
          </div>
        </Modal>
      )}

      {/* New trade modal */}
      {showNewTradeModal && (
        <Modal
          title="Open a position for the client"
          subtitle={selectedInvestor?.name}
          onClose={() => setShowNewTradeModal(false)}
        >
          <form onSubmit={handleCreateTradeSubmit} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">Asset / pair</label>
              <Select value={asset} onChange={e => setAsset(e.target.value)} className="w-full">
                <option value="BTC/USDT (Crypto Spot)">BTC/USDT (Crypto Spot)</option>
                <option value="ETH/USDT (Futures Long 10x)">ETH/USDT (Futures)</option>
                <option value="XAU/USD — Gold (Precious Metal Spot)">XAU/USD — Gold</option>
                <option value="EUR/USD (Forex)">EUR/USD (Forex)</option>
                <option value="SOL/USDT (Crypto Spot)">SOL/USDT (Crypto Spot)</option>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">Side</label>
                <Select value={type} onChange={e => setType(e.target.value as 'LONG' | 'SHORT' | 'SPOT')} className="w-full">
                  <option value="LONG">LONG (Buy)</option>
                  <option value="SHORT">SHORT (Sell)</option>
                  <option value="SPOT">SPOT</option>
                </Select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">Amount ($)</label>
                <Input type="number" step={1000} value={amount} onChange={e => setAmount(Number(e.target.value))} className="w-full" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">Entry price ($)</label>
                <Input type="number" value={entryPrice} onChange={e => setEntryPrice(Number(e.target.value))} className="w-full" />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">Leverage (x)</label>
                <Input type="number" value={leverage} onChange={e => setLeverage(Number(e.target.value))} className="w-full" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">Starting PnL ($)</label>
              <Input type="number" value={pnl} onChange={e => setPnl(Number(e.target.value))} className="w-full" />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Btn variant="ghost" type="button" onClick={() => setShowNewTradeModal(false)}>
                Cancel
              </Btn>
              <Btn variant="gold" type="submit" icon={BarChart3}>
                Open position
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
