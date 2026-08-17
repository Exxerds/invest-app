import React, { useState } from 'react';
import { X, Lock, Mail, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';
import { apiLogin, apiResendConfirmation } from '../../api';
import type { ApiUser } from '../../api';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: ApiUser) => void;
  onOpenForgotPassword: () => void;
  onOpenRegister: () => void;
}

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
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');

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
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
      setNeedsConfirm(/not activated|confirm your email/i.test(msg));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendState('sending');
    try {
      await apiResendConfirmation(email);
    } catch {
      /* the endpoint never reveals whether the address exists */
    }
    setResendState('sent');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#14161c] border border-white/[.08] rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-white/[.06]">
        <div className="bg-[#0f1116] border-b border-white/[.08] p-6 text-white relative">
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
          <p className="text-xs text-slate-400 mt-1">Access your accounts, trading and balance</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1">
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
                className="w-full pl-10 pr-4 py-2.5 bg-[#0f1116] border border-white/[.08] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f5b400]/25 focus:border-[#f5b400]/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1">
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
                className="w-full pl-10 pr-4 py-2.5 bg-[#0f1116] border border-white/[.08] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f5b400]/25 focus:border-[#f5b400]/50"
              />
            </div>
            <div className="flex justify-end mt-1.5">
              <button
                type="button"
                onClick={onOpenForgotPassword}
                className="text-xs text-[#f5b400] font-semibold hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs text-rose-400 space-y-2">
              <div>{error}</div>
              {needsConfirm && (
                resendState === 'sent' ? (
                  <div className="text-emerald-400">
                    A new confirmation link has been sent to {email}. Check your inbox and Spam folder.
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendState === 'sending'}
                    className="text-[#f5b400] font-semibold hover:underline cursor-pointer disabled:opacity-60"
                  >
                    {resendState === 'sending' ? 'Sending...' : 'Resend confirmation email'}
                  </button>
                )
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-2.5 bg-[#f5b400] hover:bg-[#ffc21f] disabled:opacity-60 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
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

          <div className="p-3 bg-[#f5b400]/10 rounded-xl border border-[#f5b400]/20 text-xs text-slate-400 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-[#f5b400] shrink-0 mt-0.5" />
            <div>
              No account?{' '}
              <button
                type="button"
                onClick={onOpenRegister}
                className="text-[#f5b400] font-bold hover:underline cursor-pointer"
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
