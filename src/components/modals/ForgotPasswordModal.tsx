import React, { useState } from 'react';
import { X, Mail, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { apiForgotPassword } from '../../api';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackToLogin: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  onBackToLogin
}) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiForgotPassword(email);
      setSent(true);
      console.log('[forgot-password]', res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border border-[#E4DECB] rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
        <div className="bg-[#1C412C] border-b border-[#1C412C] p-6 text-[#F5F2E9] relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer text-white"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2.5 mb-2 pr-10">
            <button
              onClick={onBackToLogin}
              className="w-8 h-8 shrink-0 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer text-white"
              title="Back to sign in"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 text-[#B08B48] text-xs font-semibold">
              <Mail className="w-3.5 h-3.5 text-[#B08B48]" />
              <span>Account recovery</span>
            </div>
          </div>
          <h2 className="font-serif text-xl font-bold">Forgot your password?</h2>
          <p className="text-xs text-[#F5F2E9]/70 mt-1">We'll send you a password reset link</p>
        </div>

        {sent ? (
          <div className="p-6 space-y-4">
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <div className="text-sm text-[#213532]/80 leading-relaxed">
                <strong className="text-[#1C412C]">Email sent!</strong>
                <br />
                If <strong className="text-[#B08B48]">{email}</strong> is registered, you'll receive a
                password reset link (valid for 1 hour).
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full px-6 py-2.5 bg-[#B08B48] hover:bg-[#C59D55] text-white font-bold rounded-xl text-sm transition-all shadow-sm cursor-pointer"
            >
              Got it
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#213532] uppercase tracking-wide mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#213532]/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@email.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E4DECB] rounded-xl text-sm text-[#213532] placeholder:text-[#213532]/40 focus:outline-none focus:ring-2 focus:ring-[#B08B48]/20 focus:border-[#B08B48]"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs text-rose-700">
                {error}
              </div>
            )}

            <div className="p-3 bg-[#F5F2E9] rounded-xl border border-[#E4DECB] text-xs text-[#213532]/70 leading-relaxed">
              The link is valid for 1 hour. If the email doesn&rsquo;t arrive within a few minutes,
              please check your <strong className="text-[#213532]">Spam</strong> folder.
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-2.5 bg-[#B08B48] hover:bg-[#C59D55] disabled:opacity-60 text-white font-bold rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send reset link'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
