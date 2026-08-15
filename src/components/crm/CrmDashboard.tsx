import React, { useState } from 'react';
import type {
  Project,
  Investor,
  Lead,
  TransactionRequest,
  LeadStage,
  CrmSettings
} from '../../types';
import type { ApiUser } from '../../api';
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  Ban,
  ArrowDownToLine,
  ArrowDownCircle,
  PhoneCall,
  Settings,
  LogOut,
  Kanban,
  Plus,
  CheckCircle,
  ShieldCheck,
  AlertCircle,
  Clock,
  UserPlus,
  ArrowRight,
  ArrowLeft,
  Search,
  MessageSquare,
  KeyRound,
  EyeOff,
  Loader2,
  X,
  Mic,
  MonitorPlay,
  Radio,
  PlayCircle,
  BarChart3
} from 'lucide-react';
import { CRM_AUM_MONTHS } from '../../data/mockData';
import { CrmTradesManager } from './CrmTradesManager';
import type { AdminTrade } from './CrmTradesManager';

type CrmTab =
  | 'dashboard'
  | 'trading'
  | 'users'
  | 'blocked'
  | 'leads'
  | 'withdrawals'
  | 'deposits'
  | 'calls'
  | 'analytics'
  | 'settings';

interface CrmDashboardProps {
  leads: Lead[];
  onMoveLeadStage: (id: string, direction: 'next' | 'prev') => void;
  onOpenNewLeadModal: () => void;
  investors: Investor[];
  onApproveKyc: (investorId: string) => void;
  requests: TransactionRequest[];
  onApproveRequest: (requestId: string) => void;
  onRejectRequest: (requestId: string) => void;
  projects: Project[];
  onOpenNewProjectModal: () => void;
  trades: AdminTrade[];
  onUpdateInvestorBalance: (investorId: string, newBalance: number) => void;
  onCreateTrade: (trade: Omit<AdminTrade, 'id' | 'status'>) => void;
  onUpdateTradePnl: (tradeId: string, newPnl: number) => void;
  onCloseTrade: (tradeId: string) => void;
  onAddLeadComment: (leadId: string, text: string) => void;
  users: ApiUser[];
  currentUserName: string;
  currentUserRole: string;
  onChangeUserPassword: (userId: number, newPassword: string) => Promise<void>;
  onUpdateUserStatus: (userId: number, status: string) => Promise<void>;
  settings: CrmSettings;
  onToggleHidePhones: () => void;
}

/** Mask phone: agents see only last 4 digits when enabled by admin */
function maskPhone(phone: string): string {
  const visible = 4;
  if (phone.length <= visible) return '•••';
  return phone.slice(0, -visible).replace(/[0-9]/g, '*') + phone.slice(-visible);
}

const SIDEBAR_GROUPS: { label: string; items: { id: CrmTab; label: string; icon: React.ElementType }[] }[] = [
  {
    label: 'Platform',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'trading', label: 'Trading', icon: TrendingUp },
      { id: 'withdrawals', label: 'Withdrawals', icon: ArrowDownToLine },
      { id: 'deposits', label: 'Deposits', icon: ArrowDownCircle }
    ]
  },
  {
    label: 'CRM',
    items: [
      { id: 'users', label: 'Users', icon: Users },
      { id: 'blocked', label: 'Blocked', icon: Ban },
      { id: 'leads', label: 'Leads', icon: Kanban },
      { id: 'calls', label: 'Calls', icon: PhoneCall },
      { id: 'analytics', label: 'Analytics', icon: BarChart3 },
      { id: 'settings', label: 'Settings', icon: Settings }
    ]
  }
];

const ALL_SIDEBAR_ITEMS = SIDEBAR_GROUPS.flatMap(g => g.items);

export const CrmDashboard: React.FC<CrmDashboardProps> = ({
  leads,
  onMoveLeadStage,
  onOpenNewLeadModal,
  investors,
  onApproveKyc,
  requests,
  onApproveRequest,
  onRejectRequest,
  onOpenNewProjectModal,
  trades,
  onUpdateInvestorBalance,
  onCreateTrade,
  onUpdateTradePnl,
  onCloseTrade,
  onAddLeadComment,
  users,
  currentUserName,
  currentUserRole,
  onChangeUserPassword,
  onUpdateUserStatus,
  settings,
  onToggleHidePhones
}) => {
  const [activeTab, setActiveTab] = useState<CrmTab>('dashboard');
  const [searchInvestor, setSearchInvestor] = useState('');

  // Lead comments modal
  const [commentLead, setCommentLead] = useState<Lead | null>(null);
  const [commentText, setCommentText] = useState('');

  // Change password modal
  const [pwdUser, setPwdUser] = useState<ApiUser | null>(null);
  const [newPwd, setNewPwd] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdDone, setPwdDone] = useState(false);

  const [statusLoadingId, setStatusLoadingId] = useState<number | null>(null);

  const isAdmin = currentUserRole === 'ADMIN';
  const phonesHidden = settings.hidePhonesFromAgents && !isAdmin;
  const displayName = currentUserName || 'Super Admin';

  const columns: { id: LeadStage; title: string; color: string; badgeBg: string }[] = [
    { id: 'new', title: 'NEW', color: 'border-blue-500', badgeBg: 'bg-blue-100 text-blue-800' },
    { id: 'contact', title: 'CALLBACK', color: 'border-amber-500', badgeBg: 'bg-amber-100 text-amber-800' },
    { id: 'kyc', title: 'DEP', color: 'border-purple-500', badgeBg: 'bg-purple-100 text-purple-800' },
    { id: 'active', title: 'ACTIVE', color: 'border-emerald-500', badgeBg: 'bg-emerald-100 text-emerald-800' }
  ];

  const filteredInvestors = investors.filter(inv =>
    inv.name.toLowerCase().includes(searchInvestor.toLowerCase()) ||
    inv.email.toLowerCase().includes(searchInvestor.toLowerCase()) ||
    inv.phone.includes(searchInvestor)
  );

  const pendingRequestsCount = requests.filter(r => r.status === 'pending').length;
  const pendingKycCount = investors.filter(i => i.kycStatus === 'pending').length;

  const handleAddComment = () => {
    if (!commentLead || !commentText.trim()) return;
    onAddLeadComment(commentLead.id, commentText.trim());
    setCommentText('');
  };

  const handleChangePassword = async () => {
    if (!pwdUser) return;
    setPwdLoading(true);
    setPwdError(null);
    try {
      await onChangeUserPassword(pwdUser.id, newPwd);
      setPwdDone(true);
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setPwdLoading(false);
    }
  };

  const handleStatusChange = async (user: ApiUser, status: string) => {
    setStatusLoadingId(user.id);
    try {
      await onUpdateUserStatus(user.id, status);
    } catch {
      // toast in App
    } finally {
      setStatusLoadingId(null);
    }
  };

  const closePwdModal = () => {
    setPwdUser(null);
    setNewPwd('');
    setPwdError(null);
    setPwdDone(false);
  };

  const totalAum = investors.reduce((s, i) => s + i.balance + i.invested, 0);
  const totalProfit = investors.reduce((s, i) => s + i.totalProfit, 0);
  const openTrades = trades.filter(t => t.status === 'OPEN').length;

  return (
    <div className="flex min-h-[calc(100vh-64px)] bg-slate-100">
      {/* ============ SIDEBAR (dark, like PDF) ============ */}
      <aside className="w-60 shrink-0 bg-[#0c0d11] text-slate-300 flex flex-col hidden md:flex sticky top-16 h-[calc(100vh-64px)] overflow-y-auto">
        {/* Profile */}
        <div className="px-4 py-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-white text-sm shadow-md shadow-blue-600/30 ring-2 ring-white/10">
              {displayName.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-bold text-white">{displayName}</div>
              <div className="text-[10px] text-blue-400 font-bold uppercase tracking-wide">
                {currentUserRole === 'ADMIN' ? 'SUPER ADMIN' : currentUserRole || 'SUPER ADMIN'}
              </div>
            </div>
          </div>
        </div>

        {/* Menu with groups (like PDF) */}
        <nav className="flex-1 py-3 px-2 space-y-4 overflow-y-auto">
          {SIDEBAR_GROUPS.map(group => (
            <div key={group.label}>
              <div className="px-3 mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-600">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {item.id === 'leads' && (
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/30 text-blue-300">
                          {leads.length}
                        </span>
                      )}
                      {item.id === 'withdrawals' && pendingRequestsCount > 0 && (
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/40 text-rose-200 animate-pulse">
                          {pendingRequestsCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-white/5">
          <button
            onClick={() => window.location.reload()}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:text-rose-400 hover:bg-white/5 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      </aside>

      {/* ============ CONTENT ============ */}
      <div className="flex-1 min-w-0 p-4 sm:p-6 space-y-6">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              {ALL_SIDEBAR_ITEMS.find(i => i.id === activeTab)?.label || 'Dashboard'}
            </h1>
            <p className="text-xs text-slate-500">TradeNation — admin panel</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenNewLeadModal}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              + Add lead
            </button>
            <button
              onClick={onOpenNewProjectModal}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              New asset
            </button>
          </div>
        </div>

        {/* ===== DASHBOARD (Панель управления) ===== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="text-xs text-slate-500 font-medium">AUM (assets under management)</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1.5">
                  ${(totalAum / 1000).toFixed(1)}K
                </div>
                <div className="text-xs text-emerald-600 mt-1">▲ +14% this month</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="text-xs text-slate-500 font-medium">Clients</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1.5">{investors.length}</div>
                <div className="text-xs text-slate-400 mt-1">{pendingKycCount} pending KYC</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="text-xs text-slate-500 font-medium">Open trades</div>
                <div className="text-2xl font-extrabold text-blue-600 mt-1.5">{openTrades}</div>
                <div className="text-xs text-slate-400 mt-1">across all clients</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="text-xs text-slate-500 font-medium">Total client profit</div>
                <div className="text-2xl font-extrabold text-emerald-600 mt-1.5">
                  +${totalProfit.toLocaleString()}
                </div>
                <div className="text-xs text-slate-400 mt-1">cumulative PnL</div>
              </div>
            </div>

            {/* User card like PDF page 3 */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-bold text-slate-900">Detailed user info</h2>
                <span className="text-xs text-slate-400">Client base · CRM</span>
              </div>
              <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {investors.slice(0, 2).map(inv => (
                  <div key={inv.id} className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white">
                          {inv.name.split(' ').map(p => p[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{inv.name}</div>
                          <div className="text-xs text-slate-500">{inv.email}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{inv.phone}</div>
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        inv.kycStatus === 'verified' ? 'bg-emerald-100 text-emerald-700'
                        : inv.kycStatus === 'pending' ? 'bg-amber-100 text-amber-700'
                        : 'bg-rose-100 text-rose-700'
                      }`}>
                        {inv.kycStatus.toUpperCase()}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-4">
                      <div className="bg-white rounded-xl p-3 border border-slate-200">
                        <div className="text-[10px] text-slate-400">Balance</div>
                        <div className="text-sm font-extrabold text-slate-900">${inv.balance.toLocaleString()}</div>
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-slate-200">
                        <div className="text-[10px] text-slate-400">Invested</div>
                        <div className="text-sm font-extrabold text-slate-900">${inv.invested.toLocaleString()}</div>
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-slate-200">
                        <div className="text-[10px] text-slate-400">Profit</div>
                        <div className="text-sm font-extrabold text-emerald-600">+${inv.totalProfit.toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4">
                      <button
                        onClick={() => setActiveTab('trading')}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                      >
                        Manage account
                      </button>
                      <button
                        onClick={() => setActiveTab('calls')}
                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <PhoneCall className="w-3 h-3" /> Call
                      </button>
                      <button
                        onClick={() => setActiveTab('leads')}
                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <MessageSquare className="w-3 h-3" /> Message
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== TRADING (Трейдинг — приоритет) ===== */}
        {activeTab === 'trading' && (
          <CrmTradesManager
            investors={investors}
            trades={trades}
            onUpdateInvestorBalance={onUpdateInvestorBalance}
            onCreateTrade={onCreateTrade}
            onUpdateTradePnl={onUpdateTradePnl}
            onCloseTrade={onCloseTrade}
          />
        )}

        {/* ===== USERS ===== */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="font-bold text-slate-900">Users ({users.length})</h2>
                <p className="text-xs text-slate-500">Platform accounts, roles and KYC</p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search user..."
                  value={searchInvestor}
                  onChange={(e) => setSearchInvestor(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-100">
                    <th className="py-3.5 px-6">User</th>
                    <th className="py-3.5 px-6">Email</th>
                    <th className="py-3.5 px-6">Role</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredInvestors.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-6 font-bold text-slate-900">{inv.name}</td>
                      <td className="py-4 px-6 text-xs text-slate-600">{inv.email}</td>
                      <td className="py-4 px-6 text-xs text-slate-500">CLIENT</td>
                      <td className="py-4 px-6">
                        {inv.kycStatus === 'verified' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <ShieldCheck className="w-3.5 h-3.5" /> Active
                          </span>
                        ) : inv.kycStatus === 'pending' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                            <Clock className="w-3.5 h-3.5" /> Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                            <AlertCircle className="w-3.5 h-3.5" /> Rejected
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        {inv.kycStatus !== 'verified' && (
                          <button
                            onClick={() => onApproveKyc(inv.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            Approve KYC
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-6 font-bold text-slate-900">{u.name}</td>
                      <td className="py-4 px-6 text-xs text-slate-600">{u.email}</td>
                      <td className="py-4 px-6">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                          u.role === 'ADMIN' ? 'bg-purple-50 text-purple-700'
                          : u.role === 'MANAGER' ? 'bg-blue-50 text-blue-700'
                          : 'bg-slate-50 text-slate-600'
                        }`}>{u.role}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          u.status === 'active' ? 'bg-emerald-100 text-emerald-800'
                          : u.status === 'blocked' ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                        }`}>
                          {u.status === 'active' ? 'Active' : u.status === 'blocked' ? 'Blocked' : 'Pending'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        {isAdmin && u.id !== 0 ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => { setPwdUser(u); setNewPwd(''); setPwdError(null); setPwdDone(false); }}
                              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <KeyRound className="w-3 h-3" /> Password
                            </button>
                            {u.status !== 'blocked' ? (
                              <button
                                onClick={() => handleStatusChange(u, 'blocked')}
                                disabled={statusLoadingId === u.id}
                                className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
                              >
                                {statusLoadingId === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleStatusChange(u, 'active')}
                                disabled={statusLoadingId === u.id}
                                className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
                              >
                                {statusLoadingId === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">{u.id === 0 ? 'Demo' : '—'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== BLOCKED ===== */}
        {activeTab === 'blocked' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">Blocked users</h2>
              <p className="text-xs text-slate-500">Accounts with restricted access</p>
            </div>
            <div className="p-10 text-center text-sm text-slate-400">
              {users.filter(u => u.status === 'blocked').length > 0 ? (
                users.filter(u => u.status === 'blocked').map(u => (
                  <div key={u.id} className="flex items-center justify-between max-w-md mx-auto mb-3 p-4 bg-rose-50 rounded-xl border border-rose-100">
                    <div className="text-left">
                      <div className="font-bold text-slate-900">{u.name}</div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </div>
                    <button
                      onClick={() => handleStatusChange(u, 'active')}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Unblock
                    </button>
                  </div>
                ))
              ) : (
                'No blocked users'
              )}
            </div>
          </div>
        )}

        {/* ===== LEADS / CRM (канбан как в PDF стр.12) ===== */}
        {activeTab === 'leads' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-900">Sales pipeline</h2>
                <p className="text-xs text-slate-500">Leads, managers and client base in one system</p>
              </div>
              {settings.hidePhonesFromAgents && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
                  <EyeOff className="w-3.5 h-3.5" /> Phones hidden from agents
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {columns.map(col => {
                const columnLeads = leads.filter(l => l.stage === col.id);
                const totalVol = columnLeads.reduce((s, l) => s + l.potentialAmount, 0);
                return (
                  <div key={col.id} className="bg-slate-100/80 rounded-2xl p-3 border border-slate-200 min-h-[420px]">
                    <div className="flex items-center justify-between px-2 py-2 border-b border-slate-200 mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${col.color.replace('border-', 'bg-')}`}></span>
                        <h3 className="font-bold text-xs text-slate-900 tracking-wide">{col.title}</h3>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${col.badgeBg}`}>
                        {columnLeads.length}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium px-2 mb-2">
                      Potential: <strong className="text-slate-600">${totalVol.toLocaleString()}</strong>
                    </div>
                    <div className="space-y-2.5">
                      {columnLeads.map(lead => (
                        <div key={lead.id} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-bold text-sm text-slate-900">{lead.name}</div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <PhoneCall className="w-3 h-3 text-slate-400" />
                                {phonesHidden ? maskPhone(lead.phone) : lead.phone}
                              </div>
                            </div>
                            <span className="text-xs font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                              ${lead.potentialAmount.toLocaleString()}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 line-clamp-2">
                            {lead.notes}
                          </p>
                          {lead.comments.slice(0, 1).map(c => (
                            <div key={c.id} className="text-[10px] bg-blue-50/60 border border-blue-100 rounded-lg p-2">
                              <span className="text-slate-500">{c.text}</span>
                              <div className="text-[9px] text-slate-400 mt-0.5">{c.author} · {c.date}</div>
                            </div>
                          ))}
                          <button
                            onClick={() => { setCommentLead(lead); setCommentText(''); }}
                            className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                          >
                            <MessageSquare className="w-3 h-3" />
                            {lead.comments.length > 0 ? `Comments (${lead.comments.length}) — add` : 'Add comment'}
                          </button>
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                            <span className="text-[9px] text-slate-400">{lead.manager}</span>
                            <div className="flex gap-1">
                              <button
                                onClick={() => onMoveLeadStage(lead.id, 'prev')}
                                disabled={lead.stage === 'new'}
                                className="px-1.5 py-1 rounded bg-slate-100 text-slate-500 text-[10px] disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowLeft className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => onMoveLeadStage(lead.id, 'next')}
                                disabled={lead.stage === 'active'}
                                className="px-1.5 py-1 rounded bg-blue-50 text-blue-600 text-[10px] disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {columnLeads.length === 0 && (
                        <div className="text-center text-xs text-slate-400 py-8">No leads</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== WITHDRAWALS ===== */}
        {activeTab === 'withdrawals' && (
          <RequestsTable
            title="Withdrawal requests"
            requests={requests.filter(r => r.type === 'withdrawal')}
            onApprove={onApproveRequest}
            onReject={onRejectRequest}
          />
        )}

        {/* ===== DEPOSITS ===== */}
        {activeTab === 'deposits' && (
          <RequestsTable
            title="Deposit requests"
            requests={requests.filter(r => r.type === 'deposit')}
            onApprove={onApproveRequest}
            onReject={onRejectRequest}
          />
        )}

        {/* ===== CALLS (как в PDF стр. 5) ===== */}
        {activeTab === 'calls' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="font-bold text-slate-900">Call management</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Tools for control and development of managers' work
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mb-3">
                    <Radio className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-sm text-slate-900">Whisper mode (souffler)</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Admin whispers to the manager during a call — the client does not hear it.
                  </p>
                </div>
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
                    <MonitorPlay className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-sm text-slate-900">Screen share</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    The client can show the screen of their device during a call.
                  </p>
                </div>
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
                    <Mic className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-sm text-slate-900">Call recording</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    All calls are recorded for quality control of the whole team.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900">Call history & statistics</h3>
                  <p className="text-xs text-slate-500">Accepted, missed and declined calls</p>
                </div>
                <button
                  onClick={() => setActiveTab('trading')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  <PhoneCall className="w-3.5 h-3.5 inline mr-1" /> Call a client
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-100">
                      <th className="py-3.5 px-6">Client</th>
                      <th className="py-3.5 px-6">Manager</th>
                      <th className="py-3.5 px-6">Status</th>
                      <th className="py-3.5 px-6">Duration</th>
                      <th className="py-3.5 px-6">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {[
                      { client: 'Mikhail Sokolov', manager: 'Elena Smirnova', status: 'accepted', dur: '12:45', date: '12.08.2026' },
                      { client: 'Konstantin Volkov', manager: 'Elena Smirnova', status: 'accepted', dur: '08:12', date: '12.08.2026' },
                      { client: 'Anna Tikhonova', manager: 'Artem Lebedev', status: 'declined', dur: '—', date: '11.08.2026' },
                      { client: 'Olga Vorontsova', manager: 'Artem Lebedev', status: 'missed', dur: '—', date: '10.08.2026' },
                      { client: 'Viktor Kuznetsov', manager: 'Elena Smirnova', status: 'accepted', dur: '23:01', date: '09.08.2026' }
                    ].map(c => (
                      <tr key={c.client} className="hover:bg-slate-50/70">
                        <td className="py-4 px-6 font-bold text-slate-900">{c.client}</td>
                        <td className="py-4 px-6 text-xs text-slate-600">{c.manager}</td>
                        <td className="py-4 px-6">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            c.status === 'accepted' ? 'bg-emerald-100 text-emerald-800'
                            : c.status === 'missed' ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                          }`}>
                            {c.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-xs text-slate-600 flex items-center gap-1.5">
                          {c.dur !== '—' && <PlayCircle className="w-3.5 h-3.5 text-blue-500 cursor-pointer" />}
                          {c.dur}
                        </td>
                        <td className="py-4 px-6 text-xs text-slate-400">{c.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===== ANALYTICS ===== */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">AUM</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-2">$3,850,000</div>
                <div className="text-xs text-emerald-600 mt-1 font-medium">▲ +14% last month</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">Active investors</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-2">62</div>
                <div className="text-xs text-blue-600 mt-1 font-medium">Avg portfolio: $62,090</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">Funnel conversion</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-2">24.5%</div>
                <div className="text-xs text-slate-500 mt-1">Lead → KYC</div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-1">AUM Dynamics ($M)</h3>
              <p className="text-xs text-slate-500 mb-4">Assets under management by month</p>
              <div className="h-56 w-full flex items-end gap-2">
                {CRM_AUM_MONTHS.map(m => (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-slate-400 font-semibold">${m.aum}M</span>
                    <div
                      className="w-full bg-blue-600 rounded-t-md hover:bg-blue-500 transition-colors"
                      style={{ height: `${m.aum * 22}px` }}
                    ></div>
                    <span className="text-[9px] text-slate-400">{m.month}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== SETTINGS ===== */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="font-bold text-slate-900">Access & privacy settings</h2>
              <p className="text-xs text-slate-500 mt-0.5">Admin-only controls for agent permissions</p>
              <div className="mt-4 flex items-center justify-between gap-4 bg-slate-50 border border-slate-200 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <EyeOff className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-900">Hide phone numbers from agents</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      When enabled, managers see masked numbers. Full numbers visible to admins only.
                    </div>
                  </div>
                </div>
                <button
                  onClick={onToggleHidePhones}
                  disabled={!isAdmin}
                  className={`relative w-14 h-8 rounded-full transition-colors shrink-0 cursor-pointer disabled:opacity-40 ${
                    settings.hidePhonesFromAgents ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${
                    settings.hidePhonesFromAgents ? 'left-7' : 'left-1'
                  }`}></span>
                </button>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h3 className="font-bold text-slate-900">Platform users ({users.length})</h3>
                <p className="text-xs text-slate-500">Change passwords, block/unblock, manage roles</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-100">
                      <th className="py-3.5 px-6">User</th>
                      <th className="py-3.5 px-6">Role</th>
                      <th className="py-3.5 px-6">Status</th>
                      <th className="py-3.5 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50/70">
                        <td className="py-4 px-6">
                          <div className="font-bold text-slate-900">{u.name}</div>
                          <div className="text-xs text-slate-500">{u.email}</div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                            u.role === 'ADMIN' ? 'bg-purple-50 text-purple-700'
                            : u.role === 'MANAGER' ? 'bg-blue-50 text-blue-700'
                            : 'bg-slate-50 text-slate-600'
                          }`}>{u.role}</span>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            u.status === 'active' ? 'bg-emerald-100 text-emerald-800'
                            : u.status === 'blocked' ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                          }`}>{u.status}</span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          {isAdmin && u.id !== 0 && (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => { setPwdUser(u); setNewPwd(''); setPwdError(null); setPwdDone(false); }}
                                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                              >
                                <KeyRound className="w-3 h-3" /> Password
                              </button>
                              {u.status !== 'blocked' ? (
                                <button
                                  onClick={() => handleStatusChange(u, 'blocked')}
                                  className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg text-xs font-semibold cursor-pointer"
                                >
                                  Block
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleStatusChange(u, 'active')}
                                  className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg text-xs font-semibold cursor-pointer"
                                >
                                  Unblock
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== MODAL: Lead comments ===== */}
      {commentLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Lead comments</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {commentLead.name} · ${commentLead.potentialAmount.toLocaleString()} potential
                </p>
              </div>
              <button onClick={() => setCommentLead(null)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2.5 max-h-56 overflow-y-auto">
              {commentLead.comments.length === 0 && (
                <div className="text-center text-xs text-slate-400 py-6">No comments yet</div>
              )}
              {commentLead.comments.map(c => (
                <div key={c.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <div className="text-xs text-slate-700">{c.text}</div>
                  <div className="text-[10px] text-slate-400 mt-1.5 font-medium">{c.author} · {c.date}</div>
                </div>
              ))}
            </div>
            <div className="flex items-end gap-2">
              <textarea
                rows={2}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              ></textarea>
              <button
                onClick={handleAddComment}
                disabled={!commentText.trim()}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold cursor-pointer"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL: Change password ===== */}
      {pwdUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Change password</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  User: <strong>{pwdUser.name}</strong> ({pwdUser.email})
                </p>
              </div>
              <button onClick={closePwdModal} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            {pwdDone ? (
              <div className="flex flex-col items-center text-center gap-3 py-4">
                <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle className="w-7 h-7 text-emerald-600" />
                </div>
                <div className="text-sm text-slate-600">Password changed. The user must sign in with the new password.</div>
                <button onClick={closePwdModal} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm cursor-pointer">
                  Done
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">New password (min 6)</label>
                  <input
                    type="text"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>
                {pwdError && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">{pwdError}</div>}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button onClick={closePwdModal} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer">
                    Cancel
                  </button>
                  <button
                    onClick={handleChangePassword}
                    disabled={pwdLoading || newPwd.length < 6}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    {pwdLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <KeyRound className="w-3.5 h-3.5" /> Set new password
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ===== Reusable requests table ===== */
function RequestsTable({
  title,
  requests,
  onApprove,
  onReject
}: {
  title: string;
  requests: TransactionRequest[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100">
        <h2 className="font-bold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-500">Approve or reject client requests</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-100">
              <th className="py-3.5 px-6">ID / Date</th>
              <th className="py-3.5 px-6">Investor</th>
              <th className="py-3.5 px-6">Amount</th>
              <th className="py-3.5 px-6">Method</th>
              <th className="py-3.5 px-6">Status</th>
              <th className="py-3.5 px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {requests.map(req => (
              <tr key={req.id} className="hover:bg-slate-50/70">
                <td className="py-4 px-6 text-xs font-mono text-slate-500">
                  #{req.id}
                  <div className="text-[10px] text-slate-400">{req.date}</div>
                </td>
                <td className="py-4 px-6 font-bold text-slate-900">{req.investorName}</td>
                <td className="py-4 px-6 font-extrabold text-slate-900">${req.amount.toLocaleString()}</td>
                <td className="py-4 px-6 text-xs text-slate-600">{req.method}</td>
                <td className="py-4 px-6">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    req.status === 'approved' ? 'bg-emerald-100 text-emerald-800'
                    : req.status === 'rejected' ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800'
                  }`}>
                    {req.status.toUpperCase()}
                  </span>
                </td>
                <td className="py-4 px-6 text-right">
                  {req.status === 'pending' ? (
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => onApprove(req.id)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold cursor-pointer">
                        ✔ Approve
                      </button>
                      <button onClick={() => onReject(req.id)} className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg text-xs font-semibold cursor-pointer">
                        ✖ Reject
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">Processed</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
