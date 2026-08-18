import React, { useState } from 'react';
import type { Project, AssetCategory, Lead } from '../../types';
import { X, Wallet, ArrowDownRight, UserPlus, PlusCircle, Clock, Loader2, ShieldCheck } from 'lucide-react';
import { apiRequestDeposit, apiRequestWithdrawal } from '../../api';

/* ========================================================
   DEPOSIT MODAL
======================================================== */
interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after the request reaches the finance desk (balance is NOT changed) */
  onRequested?: () => void;
}

export const DepositModal: React.FC<DepositModalProps> = ({
  isOpen,
  onClose,
  onRequested
}) => {
  const [amount, setAmount] = useState<number>(10000);
  const [method, setMethod] = useState<string>('Crypto gateway (USDT TRC20 / ERC20)');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const close = () => {
    setSubmitted(false);
    setError(null);
    onClose();
  };

  /**
   * Money never moves here. The client files a request; the finance desk
   * confirms the incoming payment in the CRM and only then the account
   * is credited.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(amount > 0)) return;
    setSending(true);
    setError(null);
    try {
      await apiRequestDeposit(amount, method);
      setSubmitted(true);
      onRequested?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit the request');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#14161c] border border-white/[.08] rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-white/[.06]">
        <div className="bg-emerald-600 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 text-white text-xs font-semibold mb-2">
            <Wallet className="w-3.5 h-3.5" />
            <span>Deposit</span>
          </div>
          <h2 className="text-xl font-bold">Deposit funds</h2>
          <p className="text-xs text-emerald-100 mt-1">
            Credited once our finance team confirms your payment
          </p>
        </div>

        {submitted ? (
          <div className="p-6 space-y-4">
            <div className="flex flex-col items-center text-center gap-3 py-2">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <Clock className="w-7 h-7 text-emerald-400" />
              </div>
              <div className="text-base font-bold text-white">Request received</div>
              <p className="text-sm text-slate-400 leading-relaxed">
                Your deposit of{' '}
                <strong className="text-[#f5b400]">${amount.toLocaleString('en-US')}</strong> is
                pending confirmation. Send the funds using the details provided by your advisor —
                the balance updates as soon as our finance team verifies the payment.
              </p>
              <div className="text-[11px] text-slate-500">
                You can track the status under Transactions.
              </div>
            </div>
            <button
              onClick={close}
              className="w-full px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold cursor-pointer"
            >
              Got it
            </button>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">
              Deposit amount ($ USD)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              min={500}
              step={500}
              className="w-full px-4 py-2.5 bg-[#0f1116] border border-white/[.08] rounded-xl font-bold text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <div className="flex items-center gap-2 mt-2">
              {[5000, 10000, 25000, 50000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmount(val)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/[.06] hover:bg-white/[.12] text-slate-300"
                >
                  +${val.toLocaleString('en-US')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">
              Deposit method
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#0f1116] border border-white/[.08] rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="Crypto gateway (USDT TRC20 / ERC20)">Crypto gateway (USDT TRC20 / ERC20)</option>
              <option value="Bank transfer (SWIFT / SEPA)">Bank transfer (SWIFT / SEPA)</option>
              <option value="Visa / Mastercard">Visa / Mastercard</option>
            </select>
          </div>

          <div className="p-3 bg-white/[.04] border border-white/[.08] rounded-xl text-[11px] text-slate-400 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Deposits are reviewed by our finance team before they appear on your balance.
              This protects your account against unauthorised transfers.
            </span>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs text-rose-400">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={close}
              className="px-4 py-2 rounded-xl bg-white/[.06] hover:bg-white/[.12] text-slate-300 text-sm font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold shadow-md cursor-pointer flex items-center gap-2"
            >
              {sending && <Loader2 className="w-4 h-4 animate-spin" />}
              {sending ? 'Submitting...' : 'Submit request'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};

/* ========================================================
   WITHDRAW MODAL
======================================================== */
interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  userBalance: number;
  /** Called after the request is filed (balance is NOT changed yet) */
  onRequested?: () => void;
}

export const WithdrawModal: React.FC<WithdrawModalProps> = ({
  isOpen,
  onClose,
  userBalance,
  onRequested
}) => {
  const [amount, setAmount] = useState<number>(0);
  const [destination, setDestination] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const close = () => {
    setSubmitted(false);
    setError(null);
    onClose();
  };

  /** Compliance releases the payout — the client only files the request. */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(amount > 0)) {
      setError('Enter an amount');
      return;
    }
    if (amount > userBalance) {
      setError('Amount exceeds available balance');
      return;
    }
    if (!destination.trim()) {
      setError('Enter your payout details');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await apiRequestWithdrawal(amount, 'Bank transfer / USDT', destination.trim());
      setSubmitted(true);
      onRequested?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit the request');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#14161c] border border-white/[.08] rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-white/[.06]">
        <div className="bg-slate-800 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 text-white text-xs font-semibold mb-2">
            <ArrowDownRight className="w-3.5 h-3.5" />
            <span>Withdrawal</span>
          </div>
          <h2 className="text-xl font-bold">Withdrawal request</h2>
          <p className="text-xs text-slate-300 mt-1">
            Available balance: ${userBalance.toLocaleString('en-US')}
          </p>
        </div>

        {submitted ? (
          <div className="p-6 space-y-4">
            <div className="flex flex-col items-center text-center gap-3 py-2">
              <div className="w-14 h-14 rounded-full bg-[#f5b400]/15 border border-[#f5b400]/30 flex items-center justify-center">
                <Clock className="w-7 h-7 text-[#f5b400]" />
              </div>
              <div className="text-base font-bold text-white">Request submitted</div>
              <p className="text-sm text-slate-400 leading-relaxed">
                Your withdrawal of{' '}
                <strong className="text-[#f5b400]">${amount.toLocaleString('en-US')}</strong> is
                under review by our compliance team. Funds are released to your verified payout
                details once approved.
              </p>
              <div className="text-[11px] text-slate-500">
                You can track the status under Transactions.
              </div>
            </div>
            <button
              onClick={close}
              className="w-full px-5 py-2.5 rounded-xl bg-[#f5b400] hover:bg-[#ffc21f] text-[#17190f] text-sm font-bold cursor-pointer"
            >
              Got it
            </button>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">
              Withdrawal amount ($ USD)
            </label>
            <input
              type="number"
              value={amount || ''}
              onChange={(e) => setAmount(Number(e.target.value))}
              max={userBalance}
              min={0}
              step={100}
              placeholder="0"
              className="w-full px-4 py-2.5 bg-[#0f1116] border border-white/[.08] rounded-xl font-bold text-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">
              Payout details (USDT wallet / IBAN)
            </label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Wallet address or bank account"
              className="w-full px-4 py-2.5 bg-[#0f1116] border border-white/[.08] rounded-xl text-sm text-slate-300"
            />
          </div>

          <div className="p-3 bg-white/[.04] border border-white/[.08] rounded-xl text-[11px] text-slate-400 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-[#f5b400] shrink-0 mt-0.5" />
            <span>
              Withdrawals are released after compliance review and identity verification.
            </span>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs text-rose-400">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={close}
              className="px-4 py-2 rounded-xl bg-white/[.06] hover:bg-white/[.12] text-slate-300 text-sm font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending || amount > userBalance || amount <= 0}
              className="px-5 py-2 rounded-xl bg-[#f5b400] hover:bg-[#ffc21f] disabled:opacity-60 text-[#17190f] text-sm font-bold shadow-md cursor-pointer flex items-center gap-2"
            >
              {sending && <Loader2 className="w-4 h-4 animate-spin" />}
              {sending ? 'Submitting...' : 'Submit request'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};

/* ========================================================
   NEW LEAD MODAL (CRM)
======================================================== */
interface NewLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateLead: (lead: Omit<Lead, 'id' | 'createdAt'>) => void;
}

export const NewLeadModal: React.FC<NewLeadModalProps> = ({
  isOpen,
  onClose,
  onCreateLead
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+1 (');
  const [potentialAmount, setPotentialAmount] = useState(30000);
  const [notes, setNotes] = useState('');
  const [manager, setManager] = useState('Laura Bennett (Desk 1)');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;

    onCreateLead({
      name,
      phone,
      potentialAmount,
      stage: 'new',
      notes: notes || 'New trading request from the website.',
      manager,
      comments: []
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#14161c] border border-white/[.08] rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-white/[.06]">
        <div className="bg-[#f5b400] p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 text-white text-xs font-semibold mb-2">
            <UserPlus className="w-3.5 h-3.5" />
            <span>CRM Pipeline</span>
          </div>
          <h2 className="text-xl font-bold">New client (Lead)</h2>
          <p className="text-xs text-blue-100 mt-1">Add a lead to the first Kanban column</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1">
              Full name
            </label>
            <input
              type="text"
              placeholder="Anton Korolev"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-[#0f1116] border border-white/[.08] rounded-xl"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1">
              Phone
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-[#0f1116] border border-white/[.08] rounded-xl"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1">
              Potential amount ($ USD)
            </label>
            <input
              type="number"
              value={potentialAmount}
              onChange={(e) => setPotentialAmount(Number(e.target.value))}
              step={5000}
              className="w-full px-4 py-2.5 bg-[#0f1116] border border-white/[.08] rounded-xl font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1">
              Responsible manager
            </label>
            <select
              value={manager}
              onChange={(e) => setManager(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#0f1116] border border-white/[.08] rounded-xl"
            >
              <option value="Laura Bennett (Desk 1)">Laura Bennett (Desk 1)</option>
              <option value="Daniel Foster (Desk 2)">Daniel Foster (Desk 2)</option>
              <option value="Oleg Vasilyev (Desk 3)">Oleg Vasilyev (Desk 3)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1">
              Manager notes
            </label>
            <textarea
              rows={2}
              placeholder="Interested in BTC/USDT futures trading..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 bg-[#0f1116] border border-white/[.08] rounded-xl text-xs"
            ></textarea>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/[.06] hover:bg-white/[.12] text-slate-300 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#f5b400] hover:bg-[#ffc21f] text-[#17190f] font-bold shadow-md cursor-pointer"
            >
              Add to pipeline
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ========================================================
   NEW PROJECT MODAL (CRM — create trading asset)
======================================================== */
interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (project: Omit<Project, 'id' | 'raisedAmount' | 'status'>) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onCreateProject
}) => {
  if (!isOpen) return null;

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<AssetCategory>('crypto');
  const [targetAmount, setTargetAmount] = useState(500000);
  const [apr, setApr] = useState(25.0);
  const [termMonths, setTermMonths] = useState(12);
  const [minCheck, setMinCheck] = useState(1000);
  const [description, setDescription] = useState('');

  const getCategoryLabel = (cat: AssetCategory) => {
    switch (cat) {
      case 'crypto': return 'Crypto Spot / Futures';
      case 'forex': return 'Forex & Metals';
      case 'futures': return 'Perpetual Futures';
      case 'pool': return 'Algorithmic Pool';
    }
  };

  const getDefaultImage = (cat: AssetCategory) => {
    switch (cat) {
      case 'crypto': return 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80';
      case 'forex': return 'https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=800&q=80';
      case 'futures': return 'https://images.unsplash.com/photo-1622630998477-20aa696ecb05?auto=format&fit=crop&w=800&q=80';
      case 'pool': return 'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?auto=format&fit=crop&w=800&q=80';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    onCreateProject({
      title,
      category,
      categoryLabel: getCategoryLabel(category),
      targetAmount,
      apr,
      termMonths,
      minCheck,
      riskLevel: category === 'futures' ? 'high' : 'medium',
      description: description || 'Trading asset with high liquidity and institutional quotes.',
      imageUrl: getDefaultImage(category),
      tags: ['New asset', 'Spot/Futures', 'Binance Feed']
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#14161c] border border-white/[.08] rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-white/[.06]">
        <div className="bg-purple-600 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 text-white text-xs font-semibold mb-2">
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Catalog management</span>
          </div>
          <h2 className="text-xl font-bold">Publish trading asset / pool</h2>
          <p className="text-xs text-purple-100 mt-1">The instrument will appear on the marketplace for all investors</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1">
              Instrument name
            </label>
            <input
              type="text"
              placeholder="e.g. SOL/USDT Perpetual Futures 10x"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-[#0f1116] border border-white/[.08] rounded-xl font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1">
                Asset category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as AssetCategory)}
                className="w-full px-3 py-2.5 bg-[#0f1116] border border-white/[.08] rounded-xl"
              >
                <option value="crypto">Crypto Spot / Futures</option>
                <option value="forex">Forex & Metals (EUR/USD, Gold)</option>
                <option value="futures">Perpetual Futures</option>
                <option value="pool">Algorithmic Pool</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1">
                Return (APR %)
              </label>
              <input
                type="number"
                step={0.5}
                value={apr}
                onChange={(e) => setApr(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-[#0f1116] border border-white/[.08] rounded-xl font-bold text-emerald-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1">
                Target ($)
              </label>
              <input
                type="number"
                step={10000}
                value={targetAmount}
                onChange={(e) => setTargetAmount(Number(e.target.value))}
                className="w-full px-3 py-2 bg-[#0f1116] border border-white/[.08] rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1">
                Term (months)
              </label>
              <input
                type="number"
                value={termMonths}
                onChange={(e) => setTermMonths(Number(e.target.value))}
                className="w-full px-3 py-2 bg-[#0f1116] border border-white/[.08] rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1">
                Min amount ($)
              </label>
              <input
                type="number"
                step={500}
                value={minCheck}
                onChange={(e) => setMinCheck(Number(e.target.value))}
                className="w-full px-3 py-2 bg-[#0f1116] border border-white/[.08] rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1">
              Description for investors
            </label>
            <textarea
              rows={2}
              placeholder="Describe the trading strategy and margin..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 bg-[#0f1116] border border-white/[.08] rounded-xl text-xs"
            ></textarea>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/[.06] hover:bg-white/[.12] text-slate-300 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-md cursor-pointer"
            >
              Publish on marketplace
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
