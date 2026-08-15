import React, { useState } from 'react';
import type { Project, AssetCategory, Lead } from '../../types';
import { X, Wallet, ArrowDownRight, UserPlus, PlusCircle } from 'lucide-react';

/* ========================================================
   DEPOSIT MODAL
======================================================== */
interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDeposit: (amount: number, method: string) => void;
}

export const DepositModal: React.FC<DepositModalProps> = ({
  isOpen,
  onClose,
  onConfirmDeposit
}) => {
  if (!isOpen) return null;

  const [amount, setAmount] = useState<number>(10000);
  const [method, setMethod] = useState<string>('Crypto gateway (USDT TRC20)');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount > 0) {
      onConfirmDeposit(amount, method);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200">
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
          <p className="text-xs text-emerald-100 mt-1">Funds will be credited to your available balance</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              Deposit amount ($ USD)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              min={500}
              step={500}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <div className="flex items-center gap-2 mt-2">
              {[5000, 10000, 25000, 50000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmount(val)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700"
                >
                  +${val.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              Deposit method
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="Crypto gateway (USDT TRC20 / ERC20)">Crypto gateway (USDT TRC20 / ERC20)</option>
              <option value="Bank transfer (SWIFT / SEPA)">Bank transfer (SWIFT / SEPA)</option>
              <option value="Visa / Mastercard">Visa / Mastercard</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md cursor-pointer"
            >
              Deposit
            </button>
          </div>
        </form>
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
  onConfirmWithdraw: (amount: number) => void;
}

export const WithdrawModal: React.FC<WithdrawModalProps> = ({
  isOpen,
  onClose,
  userBalance,
  onConfirmWithdraw
}) => {
  if (!isOpen) return null;

  const [amount, setAmount] = useState<number>(Math.min(userBalance, 5000));
  const [error, setError] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount > userBalance) {
      setError('Amount exceeds available balance');
      return;
    }
    onConfirmWithdraw(amount);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200">
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
            Available balance: ${userBalance.toLocaleString()}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              Withdrawal amount ($ USD)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              max={userBalance}
              min={100}
              step={100}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-lg"
            />
            {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              Payout details (USDT wallet / IBAN)
            </label>
            <input
              type="text"
              defaultValue="TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t (USDT TRC20)"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-700"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={amount > userBalance || amount <= 0}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md cursor-pointer"
            >
              Submit withdrawal request
            </button>
          </div>
        </form>
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
  const [phone, setPhone] = useState('+7 (9');
  const [potentialAmount, setPotentialAmount] = useState(30000);
  const [notes, setNotes] = useState('');
  const [manager, setManager] = useState('Elena Smirnova (Desk 1)');

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200">
        <div className="bg-blue-600 p-6 text-white relative">
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
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
              Full name
            </label>
            <input
              type="text"
              placeholder="Anton Korolev"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
              Phone
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
              Potential amount ($ USD)
            </label>
            <input
              type="number"
              value={potentialAmount}
              onChange={(e) => setPotentialAmount(Number(e.target.value))}
              step={5000}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
              Responsible manager
            </label>
            <select
              value={manager}
              onChange={(e) => setManager(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl"
            >
              <option value="Elena Smirnova (Desk 1)">Elena Smirnova (Desk 1)</option>
              <option value="Artem Lebedev (Desk 2)">Artem Lebedev (Desk 2)</option>
              <option value="Oleg Vasilyev (Desk 3)">Oleg Vasilyev (Desk 3)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
              Manager notes
            </label>
            <textarea
              rows={2}
              placeholder="Interested in BTC/USDT futures trading..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
            ></textarea>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md cursor-pointer"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200">
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
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
              Instrument name
            </label>
            <input
              type="text"
              placeholder="e.g. SOL/USDT Perpetual Futures 10x"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Asset category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as AssetCategory)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl"
              >
                <option value="crypto">Crypto Spot / Futures</option>
                <option value="forex">Forex & Metals (EUR/USD, Gold)</option>
                <option value="futures">Perpetual Futures</option>
                <option value="pool">Algorithmic Pool</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Return (APR %)
              </label>
              <input
                type="number"
                step={0.5}
                value={apr}
                onChange={(e) => setApr(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-emerald-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Target ($)
              </label>
              <input
                type="number"
                step={10000}
                value={targetAmount}
                onChange={(e) => setTargetAmount(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Term (months)
              </label>
              <input
                type="number"
                value={termMonths}
                onChange={(e) => setTermMonths(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Min amount ($)
              </label>
              <input
                type="number"
                step={500}
                value={minCheck}
                onChange={(e) => setMinCheck(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
              Description for investors
            </label>
            <textarea
              rows={2}
              placeholder="Describe the trading strategy and margin..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
            ></textarea>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
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
