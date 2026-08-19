import React, { useState } from 'react';
import { X, Lock, CheckCircle2, Loader2, KeyRound } from 'lucide-react';
import { apiResetPassword } from '../../api';

interface ResetPasswordModalProps {
  isOpen: boolean;
  token: string | null;
  onClose: () => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  isOpen,
  token,
  onClose
}) => {
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== password2) {
      setError('Passwords do not match');
      return;
    }
    if (!token) {
      setError('Reset token is missing. Follow a fresh link from the email.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiResetPassword(token, password);
      setDone(true);
      console.log('[reset-password]', res.message);
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
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 text-[#B08B48] text-xs font-semibold mb-2">
            <KeyRound className="w-3.5 h-3.5 text-[#B08B48]" />
            <span>New password</span>
          </div>
          <h2 className="font-serif text-xl font-bold">Set a new password</h2>
          <p className="text-xs text-[#F5F2E9]/70 mt-1">You followed the link from the email</p>
        </div>

        {done ? (
          <div className="p-6 space-y-4">
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <div className="text-sm text-[#213532]/80 leading-relaxed">
                <strong className="text-[#1C412C]">Password updated!</strong>
                <br />
                Now you can sign in with your new password.
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full px-6 py-2.5 bg-[#B08B48] hover:bg-[#C59D55] text-white font-bold rounded-xl text-sm transition-all shadow-sm cursor-pointer"
            >
              Great
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#213532] uppercase tracking-wide mb-1">
                New password
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

            <div>
              <label className="block text-xs font-bold text-[#213532] uppercase tracking-wide mb-1">
                Repeat password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#213532]/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Once more"
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
                  Saving...
                </>
              ) : (
                'Save new password'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
