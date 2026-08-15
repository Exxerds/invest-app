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
      setError(`Minimum investment: $${project.minCheck.toLocaleString()}`);
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
      setError(`Minimum investment: $${project.minCheck.toLocaleString()}`);
      return;
    }
    onConfirmInvest(project, amount);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white relative">
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
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between text-sm">
            <span className="text-slate-600">Your available balance:</span>
            <span className="font-extrabold text-emerald-600">${userBalance.toLocaleString()}</span>
          </div>

          {/* Amount input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
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
                className="w-full pl-9 pr-4 py-3 bg-white border border-slate-300 rounded-xl font-bold text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  {val === userBalance ? 'Max' : `$${val.toLocaleString()}`}
                </button>
              ))}
            </div>
          </div>

          {/* Calculation summary */}
          <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-100 space-y-2">
            <div className="flex justify-between text-xs font-medium text-slate-600">
              <span>Investment term</span>
              <span className="font-bold text-slate-900">{project.termMonths} months</span>
            </div>
            <div className="flex justify-between text-xs font-medium text-slate-600">
              <span>Return (annual rate)</span>
              <span className="font-bold text-emerald-600">{project.apr}% APR</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-blue-200/60">
              <span>Expected net profit</span>
              <span className="text-emerald-600">+${expectedProfit.toLocaleString()} USD</span>
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
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!!error || amount > userBalance || amount < project.minCheck}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-bold transition-colors shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer"
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
