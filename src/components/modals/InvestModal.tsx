import React, { useState } from 'react';
import type { Project } from '../../types';
import { X, TrendingUp, AlertCircle, ArrowRight } from 'lucide-react';

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

  const [amount, setAmount] = useState<number>(project.minCheck);
  const [error, setError] = useState<string>('');

  const handleAmountChange = (val: number) => {
    setAmount(val);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#14161c] border border-white/[.08] rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-white/[.06]">
        {/* Header */}
        <div className="bg-[#0f1116] border-b border-white/[.08] p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 text-white text-xs font-semibold mb-2">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Invest online</span>
          </div>
          <h2 className="text-xl font-bold">{project.title}</h2>
          <p className="text-xs text-blue-100 mt-1">{project.categoryLabel} • Return {project.apr}% APR</p>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Balance comparison */}
          <div className="bg-[#1b1e26] p-4 rounded-xl border border-white/[.06] flex items-center justify-between text-sm">
            <span className="text-slate-400">Your available balance:</span>
            <span className="font-extrabold text-emerald-400">${userBalance.toLocaleString('en-US')}</span>
          </div>

          {/* Amount input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide">
              Investment amount ($ USD)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => handleAmountChange(Number(e.target.value))}
                min={project.minCheck}
                max={userBalance}
                step={1000}
                className="w-full pl-9 pr-4 py-3 bg-[#0f1116] border border-white/[.08] rounded-xl font-bold text-lg focus:outline-none focus:ring-2 focus:ring-[#f5b400]/40"
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
                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-white/[.06] hover:bg-white/[.12] text-slate-300 transition-colors"
                >
                  {val === userBalance ? 'Max' : `$${val.toLocaleString('en-US')}`}
                </button>
              ))}
            </div>
          </div>

          {/* Calculation summary */}
          <div className="bg-[#f5b400]/10/70 p-4 rounded-xl border border-[#f5b400]/20 space-y-2">
            <div className="flex justify-between text-xs font-medium text-slate-400">
              <span>Investment term</span>
              <span className="font-bold text-white">{project.termMonths} months</span>
            </div>
            <div className="flex justify-between text-xs font-medium text-slate-400">
              <span>Return (annual rate)</span>
              <span className="font-bold text-emerald-400">{project.apr}% APR</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-[#f5b400]/25/60">
              <span>Expected net profit</span>
              <span className="text-emerald-400">+${expectedProfit.toLocaleString('en-US')} USD</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 leading-relaxed">
            By clicking «Confirm», funds will be debited from your available balance. The trade will
            be instantly reflected in your portfolio and in the CRM system.
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-white/[.06] hover:bg-white/[.12] text-slate-300 text-sm font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!!error || amount > userBalance || amount < project.minCheck}
              className="px-6 py-2.5 rounded-xl bg-[#f5b400] hover:bg-[#ffc21f] disabled:opacity-40 text-white text-sm font-bold transition-colors shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer"
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
