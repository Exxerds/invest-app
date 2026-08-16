import React, { useState } from 'react';
import { X, Mail, Lock, User, ArrowLeft, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { apiRegister } from '../../api';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackToLogin: () => void;
}

export const RegisterModal: React.FC<RegisterModalProps> = ({
  isOpen,
  onClose,
  onBackToLogin
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiRegister(name, email, password);
      setDone(true);
      console.log('[register]', res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
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
          <div className="flex items-center gap-2.5 mb-2">
            <button
              onClick={onBackToLogin}
              className="w-8 h-8 shrink-0 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
              title="Back to sign in"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 text-white text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Registration</span>
            </div>
          </div>
          <h2 className="text-xl font-bold">Create account</h2>
          <p className="text-xs text-slate-400 mt-1">
            The account is activated after email confirmation. After payment you get full access.
          </p>
        </div>

        {done ? (
          <div className="p-6 space-y-4">
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <div className="text-sm text-slate-400 leading-relaxed">
                <strong className="text-white">Account created!</strong>
                <br />
                We sent an email to <strong className="text-[#f5b400]">{email}</strong>.
                Follow the link in the email to confirm your address — then you can sign in.
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full px-6 py-2.5 bg-[#f5b400] hover:bg-[#ffc21f] text-[#17190f] font-bold rounded-xl text-sm transition-all shadow-md shadow-blue-500/20 cursor-pointer"
            >
              Got it
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1">
                Your name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="John Smith"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0f1116] border border-white/[.08] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f5b400]/25 focus:border-[#f5b400]/50"
                />
              </div>
            </div>

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
                  minLength={6}
                  placeholder="Minimum 6 characters"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0f1116] border border-white/[.08] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f5b400]/25 focus:border-[#f5b400]/50"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs text-rose-400">
                {error}
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
                  Creating...
                </>
              ) : (
                'Register'
              )}
            </button>

            <p className="text-center text-xs text-slate-500">
              Already have an account?{' '}
              <button
                type="button"
                onClick={onBackToLogin}
                className="text-[#f5b400] font-semibold hover:underline cursor-pointer"
              >
                Sign in
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
};
