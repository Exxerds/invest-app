import React from 'react';
import { 
  Briefcase, 
  LayoutDashboard, 
  Users, 
  Wallet, 
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
    <header className="sticky top-0 z-50 bg-[#F5F2E9]/95 backdrop-blur border-b border-[#E4DECB] shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onTabChange('landing')}>
            <img src="/brand-crest.png" alt="Oak Haven Yield" className="w-14 h-14 object-contain" />
            <div>
              <span className="font-serif font-bold text-lg tracking-tight text-[#1C412C]">
                OAK HAVEN <span className="text-[#B08B48] italic font-sans font-extrabold">YIELD</span>
              </span>
              <p className="text-[10px] uppercase tracking-wider text-[#213532]/70 font-semibold">Investment Advisory</p>
            </div>
          </div>

          {/* Logged-in navigation */}
          {isLoggedIn && (
            <nav className="hidden md:flex items-center bg-[#1C412C]/[.06] p-1 rounded-xl border border-[#E4DECB]">
              {!isStaff && (
                <>
                  <button
                    onClick={() => onTabChange('investor')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                      activeTab === 'investor'
                        ? 'bg-[#1C412C] text-[#F5F2E9] shadow-sm'
                        : 'text-[#213532]/80 hover:text-[#1C412C] hover:bg-[#1C412C]/[.05]'
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Dashboard</span>
                  </button>
                  <button
                    onClick={() => onTabChange('catalog')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                      activeTab === 'catalog'
                        ? 'bg-[#1C412C] text-[#F5F2E9] shadow-sm'
                        : 'text-[#213532]/80 hover:text-[#1C412C] hover:bg-[#1C412C]/[.05]'
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
                        ? 'bg-[#1C412C] text-[#F5F2E9] shadow-sm'
                        : 'text-[#213532]/80 hover:text-[#1C412C] hover:bg-[#1C412C]/[.05]'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>Admin panel</span>
                  </button>
                  <button
                    onClick={() => onTabChange('landing')}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-[#213532]/80 hover:text-[#1C412C] hover:bg-[#1C412C]/[.05] transition-all cursor-pointer"
                  >
                    <Globe className="w-4 h-4" />
                    <span>Website</span>
                  </button>
                </>
              )}
            </nav>
          )}

          {/* Right side profile */}
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <>
                {!isStaff && (
                  <div className="hidden sm:flex items-center gap-3 bg-white px-3.5 py-1.5 rounded-xl border border-[#E4DECB] shadow-sm">
                    <div className="text-right">
                      <div className="text-[11px] text-[#213532]/70">Available balance</div>
                      <div className="text-sm font-bold text-emerald-700">
                        ${investorBalance.toLocaleString('en-US')}
                      </div>
                    </div>
                    <button
                      onClick={onOpenDepositModal}
                      className="bg-[#1C412C] hover:bg-[#245238] text-[#F5F2E9] p-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                      title="Deposit funds"
                    >
                      <Wallet className="w-4 h-4" />
                      <span className="hidden lg:inline">+ Deposit</span>
                    </button>
                  </div>
                )}

                {/* Profile */}
                <div className="flex items-center gap-3 pl-2 border-l border-[#E4DECB]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-[#1C412C] flex items-center justify-center font-bold text-sm text-[#F5F2E9] shadow-sm ring-2 ring-[#E4DECB]">
                      {userInitials || '—'}
                    </div>
                    <div className="hidden sm:block">
                      <div className="text-sm font-semibold text-[#1C412C] leading-tight">
                        {userName || 'User'}
                      </div>
                      <div className="text-[10px] text-[#B08B48] font-bold uppercase tracking-wider leading-tight">
                        {userRole === 'ADMIN' ? 'SUPER ADMIN' : userRole === 'MANAGER' ? 'MANAGER' : 'CLIENT'}
                      </div>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-[#213532]/60 hidden sm:block" />
                  </div>
                  <button
                    onClick={onLogout}
                    className="p-2 text-[#213532]/60 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Sign out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={onOpenLoginModal}
                  className="px-5 py-2 bg-[#1C412C] hover:bg-[#245238] text-[#F5F2E9] rounded-xl text-sm font-bold transition-all shadow-sm cursor-pointer"
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
