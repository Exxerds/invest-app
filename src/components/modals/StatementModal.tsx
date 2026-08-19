import React, { useState, useEffect } from 'react';
import { X, FileText, Printer, Save, Loader2 } from 'lucide-react';
import { Btn, Input } from '../crm/ui';
import { apiStatement, apiSaveStatementOverrides } from '../../api';
import type { ApiStatement } from '../../api';
import { openStatementWindow } from '../../utils/statement';
import { sanitizeDecimal, parseNumber } from '../../utils/number';

interface StatementModalProps {
  isOpen: boolean;
  userId: number;
  userName: string;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

export const StatementModal: React.FC<StatementModalProps> = ({
  isOpen,
  userId,
  userName,
  onClose,
  onNotify,
}) => {
  const [statement, setStatement] = useState<ApiStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable override fields
  const [balance, setBalance] = useState('');
  const [realisedPnl, setRealisedPnl] = useState('');
  const [volume, setVolume] = useState('');
  const [deposits, setDeposits] = useState('');
  const [withdrawals, setWithdrawals] = useState('');
  const [winRate, setWinRate] = useState('');
  const [notes, setNotes] = useState('');

  const loadStatement = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiStatement(userId);
      setStatement(data);
      setBalance(String(data.figures.balance ?? data.computed.balance ?? 0));
      setRealisedPnl(String(data.figures.realisedPnl ?? data.computed.realisedPnl ?? 0));
      setVolume(String(data.figures.volume ?? data.computed.volume ?? 0));
      setDeposits(String(data.figures.deposits ?? data.computed.deposits ?? 0));
      setWithdrawals(String(data.figures.withdrawals ?? data.computed.withdrawals ?? 0));
      setWinRate(String(data.figures.winRate ?? data.computed.winRate ?? 0));
      setNotes(data.notes || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load statement data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && userId) {
      loadStatement();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const handleSaveOverrides = async () => {
    setSaving(true);
    try {
      const overrides = {
        balance: parseNumber(balance, 0),
        realisedPnl: parseNumber(realisedPnl, 0),
        volume: parseNumber(volume, 0),
        deposits: parseNumber(deposits, 0),
        withdrawals: parseNumber(withdrawals, 0),
        winRate: parseNumber(winRate, 0),
        notes: notes.trim(),
      };
      await apiSaveStatementOverrides(userId, overrides);
      onNotify('Statement figures updated successfully');
      await loadStatement();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not save statement');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    if (!statement) return;
    const currentStatement: ApiStatement = {
      ...statement,
      figures: {
        ...statement.figures,
        balance: parseNumber(balance, 0),
        realisedPnl: parseNumber(realisedPnl, 0),
        volume: parseNumber(volume, 0),
        deposits: parseNumber(deposits, 0),
        withdrawals: parseNumber(withdrawals, 0),
        winRate: parseNumber(winRate, 0),
      },
      notes: notes.trim(),
    };
    openStatementWindow(currentStatement);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border border-[#E4DECB] rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-[#1C412C] p-6 text-[#F5F2E9] relative border-b border-[#1C412C]">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer text-white"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 text-[#B08B48] text-xs font-semibold mb-2">
            <FileText className="w-3.5 h-3.5 text-[#B08B48]" />
            <span>PDF Statement Generator</span>
          </div>
          <h2 className="font-serif text-xl font-bold">Account Statement — {userName}</h2>
          <p className="text-xs text-[#F5F2E9]/75 mt-1">
            Review live calculated figures or customize report values before issuing to the client
          </p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-[#213532]/60">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#B08B48] mb-2" />
            <span>Loading statement data...</span>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-rose-700">{error}</div>
        ) : (
          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            <div className="p-3 bg-[#F5F2E9] border border-[#E4DECB] rounded-xl text-xs text-[#213532]/80 flex justify-between items-center">
              <span><strong>Account:</strong> OHY-{String(userId).padStart(6, '0')}</span>
              <span><strong>Trades recorded:</strong> {statement?.trades.length || 0}</span>
              <span><strong>Transactions:</strong> {statement?.transactions.length || 0}</span>
            </div>

            <div className="text-xs font-bold text-[#1C412C] uppercase tracking-wide">
              Statement Headline Figures (Override / Edit)
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[#213532]/70 uppercase mb-1">Balance ($)</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={balance}
                  onChange={e => setBalance(sanitizeDecimal(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#213532]/70 uppercase mb-1">Realised P/L ($)</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={realisedPnl}
                  onChange={e => setRealisedPnl(e.target.value.replace(/[^0-9.-]/g, ''))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#213532]/70 uppercase mb-1">Total Volume ($)</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={volume}
                  onChange={e => setVolume(sanitizeDecimal(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#213532]/70 uppercase mb-1">Deposits ($)</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={deposits}
                  onChange={e => setDeposits(sanitizeDecimal(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#213532]/70 uppercase mb-1">Withdrawals ($)</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={withdrawals}
                  onChange={e => setWithdrawals(sanitizeDecimal(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#213532]/70 uppercase mb-1">Win Rate (%)</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={winRate}
                  onChange={e => setWinRate(sanitizeDecimal(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#213532]/70 uppercase mb-1">
                Advisor Notes / Comments on Statement
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Account verified and compliant. Trading volume exceeds VIP threshold..."
                className="w-full px-3.5 py-2 bg-white border border-[#E4DECB] rounded-xl text-xs text-[#213532] resize-none focus:outline-none focus:border-[#B08B48] focus:ring-2 focus:ring-[#B08B48]/20"
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#E4DECB]">
              <Btn
                variant="ghost"
                icon={Save}
                disabled={saving}
                onClick={handleSaveOverrides}
              >
                {saving ? 'Saving...' : 'Save Overrides'}
              </Btn>

              <div className="flex items-center gap-2">
                <Btn variant="ghost" onClick={onClose}>
                  Cancel
                </Btn>
                <Btn
                  variant="gold"
                  icon={Printer}
                  onClick={handlePrint}
                >
                  Print / Download PDF Statement
                </Btn>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
