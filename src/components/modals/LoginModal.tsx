import React, { useState } from 'react';
import { X, Lock, Mail, ArrowRight, ShieldCheck, Loader2, Sparkles, UserCog, KeyRound } from 'lucide-react';
import { apiLogin } from '../../api';
import type { ApiUser } from '../../api';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: ApiUser) => void;
  onOpenForgotPassword: () => void;
  onOpenRegister: () => void;
}

/** Быстрый вход без сервера (демо-режим) */
const DEMO_USERS: { label: string; role: 'ADMIN' | 'MANAGER' | 'CLIENT'; user: ApiUser }[] = [
  {
    label: 'Demo Admin (CRM)',
    role: 'ADMIN',
    user: { id: 0, name: 'Super Admin', email: 'admin@demo.io', role: 'ADMIN', status: 'active' }
  },
  {
    label: 'Demo Manager',
    role: 'MANAGER',
    user: { id: 0, name: 'Elena Smirnova', email: 'manager@demo.io', role: 'MANAGER', status: 'active' }
  },
  {
    label: 'Demo Client',
    role: 'CLIENT',
    user: { id: 0, name: 'Alexander Gromov', email: 'client@demo.io', role: 'CLIENT', status: 'active' }
  }
];

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  onOpenForgotPassword,
  onOpenRegister
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiLogin(email, password);
      localStorage.setItem('tn_token', res.token);
      onLoginSuccess(res.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = (demo: typeof DEMO_USERS[number]) => {
    onLoginSuccess(demo.user);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 text-white text-xs font-semibold mb-2">
            <Lock className="w-3.5 h-3.5" />
            <span>Authorization</span>
          </div>
          <h2 className="text-xl font-bold">Sign in to your account</h2>
          <p className="text-xs text-blue-100 mt-1">Access your accounts, trading and balance</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
              Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@email.com"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Your password"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              />
            </div>
            <div className="flex justify-end mt-1.5">
              <button
                type="button"
                onClick={onOpenForgotPassword}
                className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <span>Sign in</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Test credentials hint */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 space-y-1">
            <div className="font-bold text-slate-600 flex items-center gap-1.5">
              <KeyRound className="w-3 h-3" /> Test accounts (server):
            </div>
            <div>Admin → <span className="font-mono font-bold text-slate-700">admin@trade.io / admin123</span></div>
            <div>Manager → <span className="font-mono font-bold text-slate-700">manager@trade.io / manager123</span></div>
            <div>Client → <span className="font-mono font-bold text-slate-700">client@trade.io / client123</span></div>
          </div>

          {/* Quick demo access (works even without server) */}
          <div className="pt-1">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Quick demo access (no server needed)
            </div>
            <div className="grid grid-cols-3 gap-2">
              {DEMO_USERS.map(d => (
                <button
                  key={d.role}
                  type="button"
                  onClick={() => handleDemoLogin(d)}
                  className="px-2 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-slate-700 text-[11px] font-semibold flex flex-col items-center gap-1 transition-colors cursor-pointer"
                  title={`Enter as ${d.label} without server`}
                >
                  {d.role === 'ADMIN' ? (
                    <UserCog className="w-4 h-4 text-purple-600" />
                  ) : d.role === 'MANAGER' ? (
                    <UserCog className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                  )}
                  <span className="text-center leading-tight">{d.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100 text-xs text-slate-600 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              No account?{' '}
              <button
                type="button"
                onClick={onOpenRegister}
                className="text-blue-600 font-bold hover:underline cursor-pointer"
              >
                Register
              </button>
              {' '}— the account is created right away, full access opens after payment.
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
