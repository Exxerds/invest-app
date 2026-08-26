import React, { useState, useEffect } from 'react';
import { X, UserPlus, AlertCircle, ShieldCheck, Loader2 } from 'lucide-react';
import { Btn, Input, Select } from '../crm/ui';
import { apiAdminCreateUser, apiCheckDuplicate, apiCreateLead } from '../../api';
import type { ApiUser } from '../../api';
import { sanitizeDecimal, parseNumber } from '../../utils/number';

interface CreateClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  managers: string[];
  onClientCreated: (user: ApiUser) => void;
}

export const CreateClientModal: React.FC<CreateClientModalProps> = ({
  isOpen,
  onClose,
  managers,
  onClientCreated,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+1 (');
  const [password, setPassword] = useState('Trade123!');
  const [balanceStr, setBalanceStr] = useState('10000');
  const [manager, setManager] = useState(managers[0] || 'Laura Bennett (Senior Advisor)');
  const [status, setStatus] = useState<'active' | 'pending'>('active');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dupWarning, setDupWarning] = useState<string | null>(null);

  // Debounced duplicate check (PDF p.13 Duplicate control)
  useEffect(() => {
    if (!isOpen) return;
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const cleanEmail = email.trim();
    if (cleanPhone.length < 5 && !cleanEmail.includes('@')) {
      setDupWarning(null);
      return;
    }

    const t = setTimeout(async () => {
      try {
        const res = await apiCheckDuplicate(cleanPhone.length >= 5 ? phone : undefined, cleanEmail.includes('@') ? cleanEmail : undefined);
        if (res.duplicate) {
          setDupWarning(`Warning: this ${res.duplicate.field} already matches ${res.duplicate.match} (${res.duplicate.type}).`);
        } else {
          setDupWarning(null);
        }
      } catch {
        /* ignore */
      }
    }, 400);

    return () => clearTimeout(t);
  }, [phone, email, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Name, email and password are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await apiAdminCreateUser({
        name: name.trim(),
        email: email.trim(),
        password: password.trim(),
        phone: phone.trim(),
        balance: parseNumber(balanceStr, 0),
        status,
        role: 'CLIENT',
      });
      try {
        await apiCreateLead({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          potentialAmount: parseNumber(balanceStr, 0),
          stage: 'active',
          notes: 'Created from admin quick registration',
          manager,
          force: true,
        });
      } catch {
        /* account exists even if the lead card fails */
      }
      onClientCreated(res.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create client');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border border-[#E4DECB] rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-[#1C412C] p-6 text-[#F5F2E9] relative border-b border-[#1C412C]">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer text-white"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 text-[#B08B48] text-xs font-semibold mb-2">
            <UserPlus className="w-3.5 h-3.5 text-[#B08B48]" />
            <span>Client Creation</span>
          </div>
          <h2 className="font-serif text-xl font-bold">Create Active Client</h2>
          <p className="text-xs text-[#F5F2E9]/75 mt-1">
            Creates a fully active platform trading account with instant login credentials
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm max-h-[75vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-bold text-[#213532] uppercase tracking-wide mb-1">
              Full Name *
            </label>
            <Input
              required
              placeholder="e.g. Robert Miller"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#213532] uppercase tracking-wide mb-1">
                Email Address *
              </label>
              <Input
                type="email"
                required
                placeholder="client@domain.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#213532] uppercase tracking-wide mb-1">
                Phone Number
              </label>
              <Input
                placeholder="+1 (555) 000-0000"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          {dupWarning && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{dupWarning}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#213532] uppercase tracking-wide mb-1">
                Initial Password *
              </label>
              <Input
                required
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#213532] uppercase tracking-wide mb-1">
                Starting Balance ($ USD)
              </label>
              <Input
                type="text"
                inputMode="decimal"
                value={balanceStr}
                onChange={e => setBalanceStr(sanitizeDecimal(e.target.value))}
                placeholder="0"
                className="w-full font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#213532] uppercase tracking-wide mb-1">
                Assigned Manager
              </label>
              <Select
                value={manager}
                onChange={e => setManager(e.target.value)}
                className="w-full text-xs"
              >
                {managers.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#213532] uppercase tracking-wide mb-1">
                Account Status
              </label>
              <Select
                value={status}
                onChange={e => setStatus(e.target.value as 'active' | 'pending')}
                className="w-full text-xs"
              >
                <option value="active">Active (Immediate Login)</option>
                <option value="pending">Pending Confirmation</option>
              </Select>
            </div>
          </div>

          <div className="p-3 bg-[#F5F2E9] border border-[#E4DECB] rounded-xl text-xs text-[#213532]/75 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-[#B08B48] shrink-0 mt-0.5" />
            <span>
              The client can immediately log in with this email and password, deposit, trade, and request support.
            </span>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Btn variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Btn>
            <Btn
              variant="gold"
              icon={UserPlus}
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                'Create Client Account'
              )}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  );
};
