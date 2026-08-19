// ============================================================
//  Trading control (PDF pages 6-10): admin manages client
//  balances, spot/futures positions, PnL, leverage, liquidation.
//  Dark + gold theme matching the reference screenshots.
// ============================================================
import React, { useState } from 'react';
import type { Investor } from '../../types';
import { Plus, Edit3, Wallet, TrendingUp, BarChart3, Zap } from 'lucide-react';
import { Card, Btn, Badge, Input, Select, Kpi, Th, Td } from './ui';
import { sanitizeDecimal, sanitizeInteger, parseNumber } from '../../utils/number';

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
  status: 'OPEN' | 'CLOSED' | 'PENDING';
  /** Trade open time (ISO string, editable by admin/agent) */
  openedAt?: string;
  /** Margin locked for this position (auto or overridden by the desk) */
  margin?: number;
  /** Price at which the position gets liquidated */
  liquidationPrice?: number;
}

interface CrmTradesManagerProps {
  investors: Investor[];
  trades: AdminTrade[];
  onUpdateInvestorBalance: (investorId: string, newBalance: number) => void;
  onCreateTrade: (trade: Omit<AdminTrade, 'id' | 'status'>) => void;
  onUpdateTrade: (tradeId: string, patch: Partial<AdminTrade>) => void;
  onCloseTrade: (tradeId: string) => void;
}

const Modal: React.FC<{ title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }> = ({
  title,
  subtitle,
  onClose,
  children,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
    <div className="bg-white border border-[#E4DECB] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
      <div>
        <h3 className="text-[16px] font-bold text-[#1C412C]">{title}</h3>
        {subtitle && <p className="text-[11px] text-[#213532]/70 mt-0.5">{subtitle}</p>}
      </div>
      {children}
      <div className="pt-1 text-right">
        <button onClick={onClose} className="text-[11px] text-[#213532]/60 hover:text-[#1C412C] cursor-pointer">
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
  onUpdateTrade,
  onCloseTrade,
}) => {
  const [selectedInvestorId, setSelectedInvestorId] = useState<string>(investors[0]?.id || 'inv-01');
  const selectedInvestor = investors.find(i => i.id === selectedInvestorId) || investors[0];

  const [balanceInputStr, setBalanceInputStr] = useState<string>(String(selectedInvestor?.balance || 0));
  const [isEditingBalance, setIsEditingBalance] = useState(false);

  const [showNewTradeModal, setShowNewTradeModal] = useState(false);
  const [asset, setAsset] = useState('BTC/USDT (Crypto Spot)');
  const [type, setType] = useState<'LONG' | 'SHORT' | 'SPOT'>('LONG');
  const [amountStr, setAmountStr] = useState('15000');
  const [entryPriceStr, setEntryPriceStr] = useState('62400');
  const [leverageStr, setLeverageStr] = useState('10');
  const [pnlStr, setPnlStr] = useState('1450');

  const [editingTrade, setEditingTrade] = useState<AdminTrade | null>(null);
  // Full trade editor (PDF p.10 "Full control over the position")
  const [editForm, setEditForm] = useState({
    type: 'LONG' as 'LONG' | 'SHORT' | 'SPOT',
    amount: '0',
    entryPrice: '0',
    currentPrice: '0',
    leverage: '1',
    pnl: '0',
    openedAt: '',
    margin: '0',
    liquidationPrice: '0',
  });
  /** Off = values follow the formulas, On = the desk types them by hand */
  const [marginManual, setMarginManual] = useState(false);

  const editNumAmount = parseNumber(editForm.amount, 0);
  const editNumLeverage = parseNumber(editForm.leverage, 1);
  const editNumEntry = parseNumber(editForm.entryPrice, 0);
  const editNumCurrent = parseNumber(editForm.currentPrice, 0);
  const editNumPnl = parseNumber(editForm.pnl, 0);

  const autoMargin = editNumLeverage > 0 ? Math.round(editNumAmount / editNumLeverage) : editNumAmount;
  const autoLiquidation =
    editNumEntry > 0 && editNumLeverage > 0
      ? editForm.type === 'SHORT'
        ? editNumEntry * (1 + 1 / editNumLeverage)
        : editNumEntry * (1 - 1 / editNumLeverage)
      : 0;

  /** datetime-local needs "YYYY-MM-DDTHH:mm" */
  const toLocalInput = (iso?: string) => {
    const d = iso ? new Date(iso) : new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const openEditor = (t: AdminTrade) => {
    setEditingTrade(t);
    setEditForm({
      type: t.type,
      amount: String(t.amount),
      entryPrice: String(t.entryPrice),
      currentPrice: String(t.currentPrice),
      leverage: String(t.leverage),
      pnl: String(t.pnl),
      openedAt: toLocalInput(t.openedAt),
      margin: String(t.margin ?? (t.leverage > 0 ? Math.round(t.amount / t.leverage) : t.amount)),
      liquidationPrice: String(t.liquidationPrice ?? 0),
    });
    setMarginManual(!!t.margin || !!t.liquidationPrice);
  };

  const clientTrades = trades.filter(t => t.investorId === selectedInvestorId);

  const handleSaveBalance = () => {
    if (selectedInvestor) {
      onUpdateInvestorBalance(selectedInvestor.id, parseNumber(balanceInputStr, 0));
      setIsEditingBalance(false);
    }
  };

  const handleCreateTradeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const entry = parseNumber(entryPriceStr, 0);
    onCreateTrade({
      investorId: selectedInvestorId,
      asset,
      type,
      amount: parseNumber(amountStr, 0),
      entryPrice: entry,
      currentPrice: entry * 1.05,
      leverage: parseNumber(leverageStr, 1),
      pnl: parseNumber(pnlStr, 0),
    });
    setShowNewTradeModal(false);
  };

  return (
    <div className="space-y-5">
      {/* Client selector */}
      <Card className="p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-[16px] font-bold text-[#1C412C]">Client account, balance & positions</h2>
            <p className="text-[12px] text-[#213532]/70 mt-0.5">
              Select a user to adjust balance or positions (Spot / Futures / PnL) in real time
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-bold uppercase text-[#213532]/70">Client</span>
            <Select
              value={selectedInvestorId}
              onChange={e => {
                setSelectedInvestorId(e.target.value);
                const inv = investors.find(i => i.id === e.target.value);
                if (inv) setBalanceInputStr(String(inv.balance));
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
          <div className="text-[11px] text-[#213532]/70 font-semibold uppercase">Available balance</div>
          {isEditingBalance ? (
            <div className="flex items-center gap-2 mt-2">
              <Input
                type="text"
                inputMode="decimal"
                value={balanceInputStr}
                onChange={e => setBalanceInputStr(sanitizeDecimal(e.target.value))}
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
              <span className="text-2xl font-extrabold text-emerald-700">
                ${selectedInvestor?.balance.toLocaleString('en-US')}
              </span>
              <Btn
                size="sm"
                variant="ghost"
                icon={Edit3}
                onClick={() => {
                  setBalanceInputStr(String(selectedInvestor?.balance || 0));
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
        subtitle="Edit side, open time, entry / mark price, leverage and PnL — or force close"
        actions={
          <Btn variant="gold" icon={Plus} onClick={() => setShowNewTradeModal(true)}>
            Open trade for client
          </Btn>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#F5F2E9] border-b border-[#E4DECB]">
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
            <tbody className="divide-y divide-[#E4DECB]">
              {clientTrades.map(t => (
                <tr key={t.id} className="hover:bg-[#F2EEDF]/50 transition-colors">
                  <Td className="font-semibold text-[#1C412C]">{t.asset}</Td>
                  <Td>
                    <Badge tone={t.type === 'LONG' ? 'green' : t.type === 'SHORT' ? 'red' : 'blue'}>{t.type}</Badge>
                  </Td>
                  <Td className="font-extrabold text-[#1C412C]">${t.amount.toLocaleString('en-US')}</Td>
                  <Td>
                    <div className="text-[12px] text-[#213532]">${t.entryPrice.toLocaleString('en-US')}</div>
                    <div className="text-[11px] text-[#213532]/60">Leverage {t.leverage}x</div>
                  </Td>
                  <Td>
                    <span className={`font-extrabold ${t.pnl >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
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
                        <Btn size="sm" variant="ghost" icon={Edit3} onClick={() => openEditor(t)}>
                          Edit trade
                        </Btn>
                        <Btn size="sm" variant="danger" onClick={() => onCloseTrade(t.id)}>
                          Close
                        </Btn>
                      </div>
                    ) : (
                      <span className="text-[11px] text-[#213532]/60">Completed</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          {clientTrades.length === 0 && (
            <div className="p-10 text-center text-[12px] text-[#213532]/60">
              No positions yet. Click «Open trade for client» to create the first one.
            </div>
          )}
        </div>
      </Card>

      {/* Full position editor (PDF p.10: side, leverage, margin, entry & mark price, PnL) */}
      {editingTrade && (
        <Modal
          title="Edit position"
          subtitle={`${editingTrade.asset} · change any parameter in real time`}
          onClose={() => setEditingTrade(null)}
        >
          <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
            {/* Side */}
            <div>
              <label className="block text-[11px] font-bold uppercase text-[#213532]/70 mb-1.5">Side</label>
              <div className="grid grid-cols-3 gap-2">
                {(['LONG', 'SHORT', 'SPOT'] as const).map(side => (
                  <button
                    key={side}
                    type="button"
                    onClick={() => setEditForm(f => ({ ...f, type: side }))}
                    className={`py-2 rounded-xl text-[12px] font-bold cursor-pointer transition-colors ${
                      editForm.type === side
                        ? side === 'SHORT'
                          ? 'bg-rose-600 text-white'
                          : side === 'LONG'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-sky-600 text-white'
                        : 'bg-[#1C412C]/[.06] text-[#213532] hover:bg-[#1C412C]/[.12] border border-[#E4DECB]'
                    }`}
                  >
                    {side}
                  </button>
                ))}
              </div>
            </div>

            {/* Open time */}
            <div>
              <label className="block text-[11px] font-bold uppercase text-[#213532]/70 mb-1.5">Open time</label>
              <Input
                type="datetime-local"
                value={editForm.openedAt}
                onChange={e => setEditForm(f => ({ ...f, openedAt: e.target.value }))}
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#213532]/70 mb-1.5">Amount ($)</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={editForm.amount}
                  onChange={e => setEditForm(f => ({ ...f, amount: sanitizeDecimal(e.target.value) }))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#213532]/70 mb-1.5">Leverage (x)</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={editForm.leverage}
                  onChange={e => setEditForm(f => ({ ...f, leverage: sanitizeInteger(e.target.value) }))}
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#213532]/70 mb-1.5">Entry price</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={editForm.entryPrice}
                  onChange={e => setEditForm(f => ({ ...f, entryPrice: sanitizeDecimal(e.target.value) }))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#213532]/70 mb-1.5">Mark price</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={editForm.currentPrice}
                  onChange={e => setEditForm(f => ({ ...f, currentPrice: sanitizeDecimal(e.target.value) }))}
                  className="w-full"
                />
              </div>
            </div>

            {/* PnL */}
            <div>
              <label className="block text-[11px] font-bold uppercase text-[#213532]/70 mb-1.5">Current profit / loss ($)</label>
              <Input
                type="text"
                inputMode="decimal"
                value={editForm.pnl}
                onChange={e => setEditForm(f => ({ ...f, pnl: e.target.value.replace(/[^0-9.-]/g, '').replace(/^0+(?=\d)/, '') }))}
                className={`w-full text-lg font-extrabold ${
                  editNumPnl >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              />
              <div className="flex items-center gap-2 mt-2.5">
                {[500, 1500, 3000, -500].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setEditForm(f => ({ ...f, pnl: String(v) }))}
                    className="px-2.5 py-1 bg-[#1C412C]/[.06] hover:bg-[#1C412C]/[.12] rounded-lg text-[11px] font-bold text-[#213532] cursor-pointer border border-[#E4DECB]"
                  >
                    {v >= 0 ? `+${v}$` : `${v}$`}
                  </button>
                ))}
              </div>
            </div>

            {/* Margin controls */}
            <div className="bg-[#F5F2E9] border border-[#E4DECB] rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-[#213532]/70">Margin</span>
                <button
                  type="button"
                  onClick={() => setMarginManual(v => !v)}
                  className={`text-[10px] px-2 py-1 rounded-lg cursor-pointer ${
                    marginManual ? 'bg-[#B08B48] text-white shadow-sm' : 'bg-[#1C412C]/[.06] text-[#213532] border border-[#E4DECB]'
                  }`}
                >
                  {marginManual ? 'Manual' : 'Auto'}
                </button>
              </div>

              <div className="flex justify-between text-[11px]">
                <span className="text-[#213532]/70">Position size</span>
                <span className="text-[#1C412C] font-bold">
                  ${(editNumAmount * editNumLeverage).toLocaleString('en-US')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] uppercase text-[#213532]/70 mb-1">Required margin ($)</label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={marginManual ? editForm.margin : String(autoMargin)}
                    disabled={!marginManual}
                    onChange={e => setEditForm(f => ({ ...f, margin: sanitizeDecimal(e.target.value) }))}
                    className="w-full disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-[#213532]/70 mb-1">Liquidation price</label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={marginManual ? editForm.liquidationPrice : autoLiquidation.toFixed(2)}
                    disabled={!marginManual}
                    onChange={e => setEditForm(f => ({ ...f, liquidationPrice: sanitizeDecimal(e.target.value) }))}
                    className="w-full disabled:opacity-60"
                  />
                </div>
              </div>

              <p className="text-[10px] text-[#213532]/60 leading-relaxed">
                Auto mode uses the standard formulas (margin = size ÷ leverage, liquidation at a 1 ÷ leverage move).
                Switch to Manual to type any value yourself.
              </p>
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
                onUpdateTrade(editingTrade.id, {
                  type: editForm.type,
                  amount: editNumAmount,
                  entryPrice: editNumEntry,
                  currentPrice: editNumCurrent,
                  leverage: editNumLeverage,
                  pnl: editNumPnl,
                  openedAt: editForm.openedAt ? new Date(editForm.openedAt).toISOString() : undefined,
                  margin: marginManual ? parseNumber(editForm.margin, autoMargin) : autoMargin,
                  liquidationPrice: marginManual ? parseNumber(editForm.liquidationPrice, autoLiquidation) : autoLiquidation,
                });
                setEditingTrade(null);
              }}
            >
              Save changes
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
              <label className="block text-[11px] font-bold uppercase text-[#213532]/70 mb-1.5">Asset / pair</label>
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
                <label className="block text-[11px] font-bold uppercase text-[#213532]/70 mb-1.5">Side</label>
                <Select value={type} onChange={e => setType(e.target.value as 'LONG' | 'SHORT' | 'SPOT')} className="w-full">
                  <option value="LONG">LONG (Buy)</option>
                  <option value="SHORT">SHORT (Sell)</option>
                  <option value="SPOT">SPOT</option>
                </Select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#213532]/70 mb-1.5">Amount ($)</label>
                <Input type="text" inputMode="decimal" placeholder="Amount" value={amountStr} onChange={e => setAmountStr(sanitizeDecimal(e.target.value))} className="w-full" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#213532]/70 mb-1.5">Entry price ($)</label>
                <Input type="text" inputMode="decimal" placeholder="Entry price" value={entryPriceStr} onChange={e => setEntryPriceStr(sanitizeDecimal(e.target.value))} className="w-full" />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#213532]/70 mb-1.5">Leverage (x)</label>
                <Input type="text" inputMode="numeric" placeholder="Leverage" value={leverageStr} onChange={e => setLeverageStr(sanitizeInteger(e.target.value))} className="w-full" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-[#213532]/70 mb-1.5">Starting PnL ($)</label>
              <Input type="text" inputMode="decimal" placeholder="PnL" value={pnlStr} onChange={e => setPnlStr(e.target.value.replace(/[^0-9.-]/g, '').replace(/^0+(?=\d)/, ''))} className="w-full" />
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
