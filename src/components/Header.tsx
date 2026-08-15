import React from 'react';
import { 
  Briefcase, 
  LayoutDashboard, 
  Users, 
  Wallet, 
  TrendingUp, 
  LogOut,
  Globe,
  ChevronDown
} from 'lucide-react';

export type ActiveTab = 'landing' | 'investor' | 'catalog' | 'crm';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  investorBalance: number;
  totalPortfolio: number;
  onOpenDepositModal: () => void;
  onOpenLoginModal: () => void;
  isLoggedIn: boolean;
  onLogout: () => void;
  userName?: string;
  userInitials?: string;
  userRole?: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  investorBalance,
  onOpenDepositModal,
  onOpenLoginModal,
  isLoggedIn,
  onLogout,
  userName,
  userInitials,
  userRole
}) => {
  const isStaff = userRole === 'ADMIN' || userRole === 'MANAGER';

  return (
    <header className="sticky top-0 z-50 bg-[#0c0d11] border-b border-white/5 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo (dark header, like PDF) */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onTabChange('landing')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/30">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-white">TradeNation</span>
              <p className="text-[11px] text-slate-500 font-medium">Online Forex & CFD Trading Platform</p>
            </div>
          </div>

          {/* Logged-in navigation */}
          {isLoggedIn && (
            <nav className="hidden md:flex items-center bg-white/5 p-1 rounded-xl border border-white/10">
              {!isStaff && (
                <>
                  <button
                    onClick={() => onTabChange('investor')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                      activeTab === 'investor'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Dashboard</span>
                  </button>
                  <button
                    onClick={() => onTabChange('catalog')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                      activeTab === 'catalog'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Briefcase className="w-4 h-4" />
                    <span>Markets</span>
                  </button>
                </>
              )}
              {isStaff && (
                <>
                  <button
                    onClick={() => onTabChange('crm')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                      activeTab === 'crm'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>Admin panel</span>
                  </button>
                  <button
                    onClick={() => onTabChange('landing')}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                  >
                    <Globe className="w-4 h-4" />
                    <span>Website</span>
                  </button>
                </>
              )}
            </nav>
          )}

          {/* Right side — dark header profile (like PDF) */}
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <>
                {!isStaff && (
                  <div className="hidden sm:flex items-center gap-3 bg-white/5 px-3.5 py-1.5 rounded-xl border border-white/10">
                    <div className="text-right">
                      <div className="text-[11px] text-slate-500">Available balance</div>
                      <div className="text-sm font-bold text-emerald-400">
                        ${investorBalance.toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={onOpenDepositModal}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white p-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                      title="Deposit funds"
                    >
                      <Wallet className="w-4 h-4" />
                      <span className="hidden lg:inline">+ Deposit</span>
                    </button>
                  </div>
                )}

                {/* Profile — like PDF: avatar + name + role */}
                <div className="flex items-center gap-3 pl-2 border-l border-white/10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-sm text-white shadow-inner ring-2 ring-white/10">
                      {userInitials || '—'}
                    </div>
                    <div className="hidden sm:block">
                      <div className="text-sm font-semibold text-white leading-tight">
                        {userName || 'User'}
                      </div>
                      <div className="text-[10px] text-blue-400 font-bold uppercase tracking-wider leading-tight">
                        {userRole === 'ADMIN' ? 'SUPER ADMIN' : userRole === 'MANAGER' ? 'MANAGER' : 'CLIENT'}
                      </div>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500 hidden sm:block" />
                  </div>
                  <button
                    onClick={onLogout}
                    className="p-2 text-slate-500 hover:text-rose-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                    title="Sign out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <span className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                  <Globe className="w-3.5 h-3.5" /> EN
                </span>
                <button
                  onClick={onOpenLoginModal}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-blue-600/30 cursor-pointer"
                >
                  Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
