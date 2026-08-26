import React, { useState } from 'react';
import type { Project } from '../../types';
import { X, TrendingUp, AlertCircle, ArrowRight } from 'lucide-react';
import { sanitizeDecimal, parseNumber } from '../../utils/number';

interface InvestModalProps {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
  userBalance: number;
  onConfirmInvest: (project: Project, amount: number) => void;
}

export const InvestModal: React.FC<InvestModalProps> = ({
  project,
  isOpen,
  onClose,
  userBalance,
  onConfirmInvest
}) => {
  if (!isOpen || !project) return null;

  const [amountStr, setAmountStr] = useState<string>(String(project.minCheck));
  const [error, setError] = useState<string>('');
  const amount = parseNumber(amountStr, 0);

  const handleAmountChange = (raw: string | number) => {
    const cleanStr = typeof raw === 'number' ? String(raw) : sanitizeDecimal(raw);
    setAmountStr(cleanStr);
    const val = parseNumber(cleanStr, 0);
    if (val > userBalance) {
      setError('Not enough available funds on your balance');
    } else if (val < project.minCheck) {
      setError(`Minimum investment: $${project.minCheck.toLocaleString('en-US')}`);
    } else {
      setError('');
    }
  };

  const expectedProfit = Math.round((amount * (project.apr / 100) * project.termMonths) / 12);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount > userBalance) {
      setError('Not enough available funds on your balance');
      return;
    }
    if (amount < project.minCheck) {
      setError(`Minimum investment: $${project.minCheck.toLocaleString('en-US')}`);
      return;
    }
    onConfirmInvest(project, amount);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border border-[#E4DECB] rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-[#1C412C] border-b border-[#1C412C] p-6 text-[#F5F2E9] relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer text-white"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 text-[#B08B48] text-xs font-semibold mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-[#B08B48]" />
            <span>Invest online</span>
          </div>
          <h2 className="font-serif text-xl font-bold">{project.title}</h2>
          <p className="text-xs text-[#F5F2E9]/75 mt-1">{project.categoryLabel} • Return {project.apr}% APR</p>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Balance comparison */}
          <div className="bg-[#F5F2E9] p-4 rounded-xl border border-[#E4DECB] flex items-center justify-between text-sm">
            <span className="text-[#213532]/70 font-medium">Your available balance:</span>
            <span className="font-extrabold text-emerald-700">${userBalance.toLocaleString('en-US')}</span>
          </div>

          {/* Amount input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#213532] uppercase tracking-wide">
              Investment amount ($ USD)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#213532]/40 font-bold">$</span>
              <input
                type="text"
                inputMode="decimal"
                value={amountStr}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0"
                className="w-full pl-9 pr-4 py-3 bg-white border border-[#E4DECB] rounded-xl font-bold text-lg text-[#213532] placeholder:text-[#213532]/40 focus:outline-none focus:ring-2 focus:ring-[#B08B48]/20 focus:border-[#B08B48]"
              />
            </div>
            {error && (
              <p className="text-xs text-rose-600 font-medium flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{error}</span>
              </p>
            )}

            {/* Quick buttons */}
            <div className="flex items-center gap-2 pt-1">
              {[project.minCheck, project.minCheck * 2, 25000, userBalance].map((val, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAmountChange(Math.min(userBalance, val))}
                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-[#1C412C]/[.06] hover:bg-[#1C412C]/[.12] text-[#213532] border border-[#E4DECB] transition-colors cursor-pointer"
                >
                  {val === userBalance ? 'Max' : `$${val.toLocaleString('en-US')}`}
                </button>
              ))}
            </div>
          </div>

          {/* Calculation summary */}
          <div className="bg-[#F5F2E9] p-4 rounded-xl border border-[#E4DECB] space-y-2">
            <div className="flex justify-between text-xs font-medium text-[#213532]/70">
              <span>Investment term</span>
              <span className="font-bold text-[#213532]">{project.termMonths} months</span>
            </div>
            <div className="flex justify-between text-xs font-medium text-[#213532]/70">
              <span>Return (annual rate)</span>
              <span className="font-bold text-emerald-700">{project.apr}% APR</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-[#1C412C] pt-2 border-t border-[#E4DECB]">
              <span>Expected net profit</span>
              <span className="text-emerald-700">+${expectedProfit.toLocaleString('en-US')} USD</span>
            </div>
          </div>

          <div className="text-[11px] text-[#213532]/70 leading-relaxed">
            By clicking «Confirm», funds will be debited from your available balance. The trade will
            be instantly reflected in your portfolio and on the platform.
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-[#1C412C]/[.06] hover:bg-[#1C412C]/[.12] text-[#213532] text-sm font-semibold transition-colors cursor-pointer border border-[#E4DECB]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!!error || amount > userBalance || amount < project.minCheck}
              className="px-6 py-2.5 rounded-xl bg-[#B08B48] hover:bg-[#C59D55] disabled:opacity-40 text-white text-sm font-bold transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <span>Confirm investment</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
