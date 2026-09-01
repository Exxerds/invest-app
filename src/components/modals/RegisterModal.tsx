import React, { useState } from 'react';
import { X, Mail, Lock, User, ArrowLeft, MailCheck, Loader2, ShieldCheck, AlertTriangle, RefreshCw } from 'lucide-react';
import { apiRegister, apiResendConfirmation } from '../../api';
import { trackMeta } from '../../analytics/metaPixel';

interface RegisterModalProps {
  isOpen: boolean;
  selectedAccountType?: string | null;
  onClose: () => void;
  onBackToLogin: () => void;
}

export const RegisterModal: React.FC<RegisterModalProps> = ({
  isOpen,
  selectedAccountType = null,
  onClose,
  onBackToLogin
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [emailSent, setEmailSent] = useState(true);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiRegister(name, email, password, selectedAccountType || undefined);
      setEmailSent(res.emailSent !== false);
      trackMeta('CompleteRegistration', {
        content_name: selectedAccountType || 'Account registration',
        status: true,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setResent(false);
    try {
      await apiResendConfirmation(email);
      setResent(true);
    } catch {
      setResent(true); // the endpoint never reveals whether the address exists
    } finally {
      setResending(false);
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
          <div className="flex items-center gap-2.5 mb-2">
            <button
              onClick={onBackToLogin}
              className="w-8 h-8 shrink-0 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer text-white"
              title="Back to sign in"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 text-[#B08B48] text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-[#B08B48]" />
              <span>Registration</span>
            </div>
          </div>
          <h2 className="font-serif text-xl font-bold">Create account</h2>
          <p className="text-xs text-[#F5F2E9]/70 mt-1">
            The account is activated after email confirmation.
          </p>
          {selectedAccountType && (
            <div className="mt-3 inline-flex items-center rounded-lg bg-[#B08B48]/20 border border-[#B08B48]/45 px-3 py-1.5 text-xs font-bold text-[#F5F2E9]">
              Selected package: {selectedAccountType}
            </div>
          )}
        </div>

        {done ? (
          <div className="p-6 space-y-4">
            <div className="flex flex-col items-center text-center gap-3 py-2">
              <div className="w-16 h-16 rounded-full bg-[#1C412C] flex items-center justify-center shadow-sm">
                <MailCheck className="w-8 h-8 text-[#B08B48]" />
              </div>
              <div className="text-base font-bold text-[#1C412C]">Verify your account</div>
              <div className="text-sm text-[#213532]/70 leading-relaxed">
                We&rsquo;ve sent a confirmation email to
                <br />
                <strong className="text-[#1C412C] break-all">{email}</strong>
                <br />
                <span className="block mt-2">
                  Open it and click <strong className="text-[#1C412C]">&laquo;Confirm my email&raquo;</strong> to
                  activate your account. The link is valid for 1 hour.
                </span>
              </div>
            </div>

            {emailSent ? (
              <div className="p-3 bg-[#F5F2E9] border border-[#E4DECB] rounded-xl text-[11px] text-[#213532]/70 leading-relaxed">
                Didn&rsquo;t get it? Check the <strong className="text-[#213532]">Spam</strong> or
                <strong className="text-[#213532]"> Promotions</strong> folder &mdash; delivery can take a couple of minutes.
              </div>
            ) : (
              <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl text-[11px] text-amber-800 leading-relaxed flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Your account was created, but the email could not be delivered right now.
                  Use &laquo;Resend email&raquo; below or contact support to activate it.
                </span>
              </div>
            )}

            <button
              onClick={handleResend}
              disabled={resending}
              className="w-full px-6 py-2.5 bg-[#F5F2E9] hover:bg-[#EFEAD9] disabled:opacity-60 border border-[#E4DECB] text-[#213532] font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {resending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Sending...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" /> Resend email
                </>
              )}
            </button>
            {resent && (
              <p className="text-center text-[11px] text-emerald-700 font-semibold">
                A new confirmation link has been sent.
              </p>
            )}

            <button
              onClick={onClose}
              className="w-full px-6 py-2.5 bg-[#B08B48] hover:bg-[#C59D55] text-white font-bold rounded-xl text-sm transition-all cursor-pointer shadow-sm"
            >
              Got it
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#213532] uppercase tracking-wide mb-1">
                Your name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#213532]/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="John Smith"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E4DECB] rounded-xl text-sm text-[#213532] placeholder:text-[#213532]/40 focus:outline-none focus:ring-2 focus:ring-[#B08B48]/20 focus:border-[#B08B48]"
                />
              </div>
            </div>

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

            <div>
              <label className="block text-xs font-bold text-[#213532] uppercase tracking-wide mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#213532]/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Minimum 6 characters"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E4DECB] rounded-xl text-sm text-[#213532] placeholder:text-[#213532]/40 focus:outline-none focus:ring-2 focus:ring-[#B08B48]/20 focus:border-[#B08B48]"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-2.5 bg-[#B08B48] hover:bg-[#C59D55] disabled:opacity-60 text-white font-bold rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
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

            <p className="text-center text-xs text-[#213532]/70">
              Already have an account?{' '}
              <button
                type="button"
                onClick={onBackToLogin}
                className="text-[#B08B48] font-bold hover:underline cursor-pointer"
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
