// ============================================================
//  Oak Haven Yield — CRM / Admin panel
//  Design 1:1 with the reference screenshots + PDF presentation:
//  near-black surfaces (#0a0b0e / #14161c) + gold accent (#f5b400),
//  dark sidebar with Platform / CRM switcher, collapsible groups,
//  "User details" page with action bar and the "More" dropdown.
//  Interface language: ENGLISH (per TZ).
// ============================================================
import React, { useState, useRef, useEffect } from 'react';
import type { Project, Investor, Lead, TransactionRequest, LeadStage, CrmSettings, ClientNote } from '../../types';
import { CLIENT_STATUSES, KYC_DOC_LABELS, statusTone } from '../../types';
import type { ApiKycDoc, ApiNotification } from '../../api';
import { fetchKycFile, apiMailAudience, apiSendMailing, apiDepositWallets, apiSaveDepositWallets, apiClientWallets, apiSaveClientWallets } from '../../api';
import type { ApiUser } from '../../api';
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  Ban,
  ArrowDownToLine,
  PhoneCall,
  Settings,
  LogOut,
  Kanban,
  Plus,
  CheckCircle,
  CheckCircle2,
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
  BarChart3,
  Bell,
  Phone,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Gift,
  LogIn,
  History,
  FileText,
  BellRing,
  Lock,
  Landmark,
  LifeBuoy,
  Mail,
  Wallet,
  Activity,
  Download,
  Circle,
} from 'lucide-react';
import { CRM_AUM_MONTHS } from '../../data/mockData';
import { CrmTradesManager } from './CrmTradesManager';
import type { AdminTrade } from './CrmTradesManager';
import { Card, Btn, Badge, Field, Input, Select, Kpi, Th, Td, Avatar } from './ui';

type CrmTab =
  | 'dashboard'
  | 'trading'
  | 'users'
  | 'user-details'
  | 'blocked'
  | 'happy-letter'
  | 'withdrawals'
  | 'deposits'
  | 'banks'
  | 'leads'
  | 'support'
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
  /** Clears the session and returns to the public site */
  onLogout: () => void;
  /** Admin: sign in as a client to see their cabinet */
  onImpersonateUser?: (user: ApiUser) => void;
  onRejectRequest: (requestId: string) => void;
  projects: Project[];
  onOpenNewProjectModal: () => void;
  trades: AdminTrade[];
  onUpdateInvestorBalance: (investorId: string, newBalance: number) => void;
  onCreateTrade: (trade: Omit<AdminTrade, 'id' | 'status'>) => void;
  onUpdateTrade: (tradeId: string, patch: Partial<AdminTrade>) => void;
  onCloseTrade: (tradeId: string) => void;
  onAddLeadComment: (leadId: string, text: string) => void;
  users: ApiUser[];
  currentUserName: string;
  currentUserRole: string;
  onChangeUserPassword: (userId: number, newPassword: string) => Promise<void>;
  onUpdateUserStatus: (userId: number, status: string) => Promise<void>;
  settings: CrmSettings;
  onToggleHidePhones: () => void;
  onNotify: (message: string) => void;
  notes: ClientNote[];
  onAddNote: (clientId: string, text: string) => void;
  clientStatuses: Record<string, string>;
  onSetClientStatus: (clientId: string, status: string) => void;
  kycDocuments: ApiKycDoc[];
  onReviewKyc: (docId: number, status: 'approved' | 'rejected', reason?: string) => void;
  notifications: ApiNotification[];
  unreadCount: number;
  onMarkNotificationsRead: (id?: number) => void;
}

function maskPhone(phone: string): string {
  const visible = 4;
  if (phone.length <= visible) return '•••';
  return phone.slice(0, -visible).replace(/[0-9]/g, '*') + phone.slice(-visible);
}

/* ============================================================
   SIDEBAR STRUCTURE — Platform / CRM sections (as on reference)
   ============================================================ */
type NavItem = {
  id: CrmTab;
  label: string;
  icon: React.ElementType;
  /** Visible to ADMIN only — managers/agents never see these sections */
  adminOnly?: boolean;
  children?: { id: CrmTab; label: string }[];
};

/** Sections that only an administrator may open (platform-wide configuration) */
const ADMIN_ONLY_TABS: CrmTab[] = ['settings', 'banks'];

/**
 * A single flat menu. The Platform / CRM split was removed at the client's
 * request: staff kept hunting for a section instead of a screen.
 */
const MAIN_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'trading', label: 'Trading', icon: TrendingUp },
  { id: 'leads', label: 'Leads', icon: Kanban },
  {
    id: 'users',
    label: 'Users',
    icon: Users,
    children: [
      { id: 'users', label: 'All users' },
      { id: 'blocked', label: 'Blocked' },
      { id: 'happy-letter', label: 'Happy letter' },
    ],
  },
  { id: 'withdrawals', label: 'Withdrawals', icon: ArrowDownToLine },
  { id: 'deposits', label: 'Deposits', icon: DollarSign },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'support', label: 'Support', icon: LifeBuoy },
  { id: 'calls', label: 'Calls', icon: PhoneCall },
  { id: 'banks', label: 'Partner banks', icon: Landmark, adminOnly: true },
  { id: 'settings', label: 'Settings', icon: Settings, adminOnly: true },
];

const TAB_TITLES: Record<CrmTab, { title: string; sub: string }> = {
  dashboard: { title: 'Dashboard', sub: 'Welcome to the Oak Haven Yield admin panel' },
  trading: { title: 'Trading', sub: 'Full control over client positions and balances' },
  users: { title: 'All users', sub: 'Platform accounts, roles and access' },
  'user-details': { title: 'User details', sub: 'Detailed information about the user' },
  blocked: { title: 'Blocked', sub: 'Accounts with restricted access' },
  'happy-letter': { title: 'Happy letter', sub: 'Mass mailing to the client base' },
  withdrawals: { title: 'Withdrawals', sub: 'Client withdrawal requests' },
  deposits: { title: 'Deposits', sub: 'Incoming payments and top-ups' },
  banks: { title: 'Partner banks', sub: 'Payment providers and routing' },
  leads: { title: 'Leads', sub: 'Sales funnel and lead distribution' },
  support: { title: 'Support', sub: 'Live chat, tickets and history' },
  calls: { title: 'Calls', sub: 'WebRTC calls, prompter and screen sharing' },
  analytics: { title: 'Analytics', sub: 'Base quality, managers and trading stats' },
  settings: { title: 'Settings', sub: 'Global platform and CRM rules' },
};

export const CrmDashboard: React.FC<CrmDashboardProps> = ({
  leads,
  onMoveLeadStage,
  onOpenNewLeadModal,
  investors,
  onApproveKyc,
  requests,
  onApproveRequest,
  onLogout,
  onImpersonateUser,
  onRejectRequest,
  onOpenNewProjectModal,
  trades,
  onUpdateInvestorBalance,
  onCreateTrade,
  onUpdateTrade,
  onCloseTrade,
  onAddLeadComment,
  users,
  currentUserName,
  currentUserRole,
  onChangeUserPassword,
  onUpdateUserStatus,
  settings,
  onToggleHidePhones,
  onNotify,
  notes,
  onAddNote,
  clientStatuses,
  onSetClientStatus,
  kycDocuments,
  onReviewKyc,
  notifications,
  unreadCount,
  onMarkNotificationsRead,
}) => {
  const [activeTab, setActiveTab] = useState<CrmTab>('dashboard');
  const [openGroup, setOpenGroup] = useState<string | null>('Users');
  const [searchInvestor, setSearchInvestor] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>(investors[0]?.id ?? '');

  // Lead comments modal
  const [commentLead, setCommentLead] = useState<Lead | null>(null);
  const [commentText, setCommentText] = useState('');

  // Change password modal
  const [pwdUser, setPwdUser] = useState<{ id: number; name: string; email: string } | null>(null);
  const [newPwd, setNewPwd] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdDone, setPwdDone] = useState(false);
  const [statusLoadingId, setStatusLoadingId] = useState<number | null>(null);

  // Topbar dropdowns
  const [profileOpen, setProfileOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  // Settings toggles (interactive)
  const [rules, setRules] = useState({
    duplicateControl: true,
    manualClosing: false,
    callRecording: true,
  });
  const [modules, setModules] = useState<Record<string, boolean>>({
    Spot: true, Futures: true, P2P: true, Binary: true, Staking: true,
    'AI Trading': false, Swap: false, 'Copy trading': false,
  });
  const [providers, setProviders] = useState<Record<string, boolean>>({
    'USDT TRC-20': true, 'Visa / Mastercard': true, 'SEPA transfer': false,
    Bitcoin: true, PayPal: false, 'ACH transfer': true,
  });

  // Support
  const [activeTicket, setActiveTicket] = useState<string | null>(null);
  const [chatText, setChatText] = useState('');
  const [chatLog, setChatLog] = useState<{ me: boolean; text: string; time: string }[]>([
    { me: false, text: 'Hello, when will my withdrawal be processed?', time: '12:04' },
    { me: true, text: 'Good afternoon! Your request is in processing, funds arrive within 24 hours.', time: '12:06' },
  ]);

  // Happy letter
  const [letterSubject, setLetterSubject] = useState('Your weekly trading report is ready');
  const [letterBody, setLetterBody] = useState(
    'Dear client,\n\nYour account statement for the current period is now available in your personal cabinet.\n\nBest regards,\nOak Haven Yield',
  );
  const [letterAudience, setLetterAudience] = useState('All clients');
  const [sendingLetter, setSendingLetter] = useState(false);
  const [walletDraft, setWalletDraft] = useState<Record<string, string>>({ BTC: '', ETH: '', USDC: '' });
  const [savingWallets, setSavingWallets] = useState(false);

  // Load the configured deposit addresses when Settings opens
  useEffect(() => {
    if (activeTab !== 'settings') return;
    apiDepositWallets()
      .then(r => setWalletDraft(r.wallets))
      .catch(() => undefined);
  }, [activeTab]);
  const [mailAudience, setMailAudience] = useState({ all: 0, active: 0, noDeposit: 0 });

  // Live recipient counts straight from the database
  useEffect(() => {
    if (activeTab !== 'happy-letter') return;
    apiMailAudience()
      .then(setMailAudience)
      .catch(() => setMailAudience({ all: 0, active: 0, noDeposit: 0 }));
  }, [activeTab]);

  // Close dropdowns on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const isAdmin = currentUserRole === 'ADMIN';
  const phonesHidden = settings.hidePhonesFromAgents && !isAdmin;
  const displayName = currentUserName || 'Admin';
  const roleLabel = isAdmin ? 'ADMIN' : currentUserRole || 'MANAGER';

  // Managers/agents must not see platform configuration sections
  const nav = MAIN_NAV.filter(item => !item.adminOnly || isAdmin);

  // Hard guard: a non-admin can never stay on an admin-only screen
  useEffect(() => {
    if (!isAdmin && ADMIN_ONLY_TABS.includes(activeTab)) setActiveTab('dashboard');
  }, [isAdmin, activeTab]);


  /**
   * Client list = demo portfolio records + everyone who actually registered
   * on the site. Real sign-ups have no trading history yet, so they show up
   * with zero balances until the trading data moves to the database too.
   */
  const allClients: Investor[] = React.useMemo(() => {
    const known = new Set(investors.map(i => i.email.toLowerCase()));
    const registered: Investor[] = users
      .filter(u => u.role === 'CLIENT' && !known.has(u.email.toLowerCase()))
      .map(u => ({
        id: `acc-${u.id}`,
        name: u.name,
        email: u.email,
        phone: '—',
        kycStatus: u.status === 'active' ? 'verified' : 'pending',
        balance: 0,
        invested: 0,
        totalProfit: 0,
        registrationDate: (u.created_at || '').slice(0, 10),
        manager: 'No manager (super-admin)',
      }));
    return [...investors, ...registered];
  }, [investors, users]);

  const selectedUser = allClients.find(i => i.id === selectedUserId) || allClients[0];

  const filteredInvestors = allClients.filter(
    inv =>
      inv.name.toLowerCase().includes(searchInvestor.toLowerCase()) ||
      inv.email.toLowerCase().includes(searchInvestor.toLowerCase()) ||
      inv.phone.includes(searchInvestor),
  );

  const pendingRequestsCount = requests.filter(r => r.status === 'pending').length;
  const totalAum = investors.reduce((s, i) => s + i.balance + i.invested, 0);
  const totalProfit = investors.reduce((s, i) => s + i.totalProfit, 0);
  const openTrades = trades.filter(t => t.status === 'OPEN').length;

  const openUser = (id: string) => {
    setSelectedUserId(id);
    setActiveTab('user-details');
  };

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
      /* handled by App toast */
    } finally {
      setStatusLoadingId(null);
    }
  };

  /** Always open the dialog with a clean slate */
  const openPwdModal = (u: { id: number; name: string; email: string }) => {
    setNewPwd('');
    setPwdError(null);
    setPwdDone(false);
    setPwdUser(u);
  };

  const closePwdModal = () => {
    setPwdUser(null);
    setNewPwd('');
    setPwdError(null);
    setPwdDone(false);
  };

  const header = TAB_TITLES[activeTab];

  return (
    <div className="flex min-h-screen bg-[#0a0b0e] text-slate-200">
      {/* ==================== SIDEBAR ==================== */}
      <aside className="w-[248px] shrink-0 bg-[#0f1116] border-r border-white/[.06] hidden lg:flex flex-col sticky top-0 h-screen">
        {/* Logo + language */}
        <div className="px-4 py-4 flex items-center gap-2.5 border-b border-white/[.06]">
          <div className="w-9 h-9 rounded-full bg-[#f5b400] flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 text-[#17190f]" />
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-extrabold text-white">Oak Haven <span className="text-[#B08B48]">Yield</span></div>
            <div className="text-[9px] font-bold text-[#f5b400] tracking-widest">ADMIN</div>
          </div>
        </div>

        {/* Profile */}
        <div className="px-4 py-4 flex items-center gap-3">
          <Avatar name={displayName} size={38} />
          <div className="leading-tight min-w-0">
            <div className="text-[13px] font-bold text-white truncate">{displayName}</div>
            <div className="text-[9px] font-bold text-slate-500 tracking-widest">{roleLabel}</div>
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
          {nav.map(item => {
            const Icon = item.icon;
            const hasChildren = !!item.children?.length;
            const groupOpen = openGroup === item.label;
            const isActive =
              !hasChildren && (activeTab === item.id || (item.id === 'users' && activeTab === 'user-details'));
            return (
              <div key={item.label}>
                <button
                  onClick={() => {
                    if (hasChildren) setOpenGroup(groupOpen ? null : item.label);
                    else setActiveTab(item.id);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all cursor-pointer ${
                    isActive ? 'bg-[#f5b400]/12 text-[#f5b400]' : 'text-slate-400 hover:text-white hover:bg-white/[.05]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.id === 'withdrawals' && pendingRequestsCount > 0 && (
                    <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-rose-500/25 text-rose-300 font-bold">
                      {pendingRequestsCount}
                    </span>
                  )}
                  {item.id === 'leads' && (
                    <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-slate-300 font-bold">
                      {leads.length}
                    </span>
                  )}
                  {hasChildren && (
                    <ChevronDown
                      className={`w-3.5 h-3.5 ml-auto shrink-0 transition-transform ${groupOpen ? 'rotate-180' : ''}`}
                    />
                  )}
                </button>

                {hasChildren && groupOpen && (
                  <div className="mt-0.5 space-y-0.5">
                    {item.children!.map(child => {
                      const childActive =
                        activeTab === child.id || (child.id === 'users' && activeTab === 'user-details');
                      return (
                        <button
                          key={child.label}
                          onClick={() => setActiveTab(child.id)}
                          className={`w-full text-left pl-10 pr-3 py-2 rounded-xl text-[12.5px] transition-all cursor-pointer ${
                            childActive
                              ? 'bg-[#f5b400]/12 text-[#f5b400] font-semibold'
                              : 'text-slate-500 hover:text-slate-200 hover:bg-white/[.04]'
                          }`}
                        >
                          {child.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-slate-500 hover:text-rose-400 hover:bg-white/[.05] transition-colors cursor-pointer mt-2"
          >
            <LogOut className="w-4 h-4" /> Log out
          </button>
        </nav>
      </aside>

      {/* ==================== MAIN ==================== */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="h-16 shrink-0 border-b border-white/[.06] bg-[#0f1116]/80 backdrop-blur sticky top-0 z-30 flex items-center justify-between px-5">
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="hover:text-slate-300 cursor-pointer"
            >
              Home
            </button>
            <ChevronRight className="w-3 h-3" />
            <span className="px-2 py-1 rounded-lg bg-white/[.05] text-slate-300">{header.title}</span>
          </div>
          <div className="flex items-center gap-2.5">
            {/* Notifications */}
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => { setBellOpen(v => !v); setProfileOpen(false); }}
                className="w-9 h-9 rounded-full bg-white/[.05] border border-white/[.07] flex items-center justify-center text-slate-400 hover:text-white cursor-pointer relative"
              >
                <Bell className="w-4 h-4" />
                {(unreadCount > 0 || pendingRequestsCount > 0) && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#f5b400] text-[9px] font-extrabold text-[#17190f] flex items-center justify-center">
                    {unreadCount || pendingRequestsCount}
                  </span>
                )}
              </button>
              {bellOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-[#1b1e26] border border-white/[.08] rounded-xl shadow-2xl shadow-black/60 py-2 z-50">
                  <div className="px-4 py-2 flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Notifications
                    </span>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => onMarkNotificationsRead()}
                        className="text-[10px] text-[#f5b400] hover:underline cursor-pointer"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {/* live events from the server */}
                    {notifications.map(n => (
                      <button
                        key={n.id}
                        onClick={() => {
                          onMarkNotificationsRead(n.id);
                          if (n.link === 'user-details') setActiveTab('users');
                          setBellOpen(false);
                        }}
                        className={`w-full flex items-start gap-2.5 px-4 py-2.5 text-left cursor-pointer hover:bg-white/[.06] ${
                          n.read ? 'opacity-60' : ''
                        }`}
                      >
                        <FileText className="w-4 h-4 text-[#f5b400] shrink-0 mt-0.5" />
                        <span className="min-w-0">
                          <span className="block text-[12.5px] text-white font-semibold">{n.title}</span>
                          <span className="block text-[11px] text-slate-400">{n.message}</span>
                          <span className="block text-[10px] text-slate-600 mt-0.5">
                            {new Date(n.createdAt).toLocaleString('en-US')}
                          </span>
                        </span>
                        {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-[#f5b400] shrink-0 mt-1.5" />}
                      </button>
                    ))}

                    {/* always-present operational shortcuts */}
                    {[
                      { t: `${pendingRequestsCount} withdrawal request(s) pending`, tab: 'withdrawals' as CrmTab, icon: ArrowDownToLine },
                      { t: `${leads.filter(l => l.stage === 'new').length} new lead(s) assigned`, tab: 'leads' as CrmTab, icon: Kanban },
                    ].map(n => (
                      <button
                        key={n.t}
                        onClick={() => { setActiveTab(n.tab); setBellOpen(false); }}
                        className="w-full flex items-start gap-2.5 px-4 py-2.5 text-left text-[12.5px] text-slate-300 hover:bg-white/[.06] hover:text-white cursor-pointer border-t border-white/[.05]"
                      >
                        <n.icon className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                        {n.t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setActiveTab('calls')}
              title="Call centre"
              className="w-9 h-9 rounded-full bg-white/[.05] border border-white/[.07] flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
            >
              <Phone className="w-4 h-4" />
            </button>

            {/* Profile menu */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => { setProfileOpen(v => !v); setBellOpen(false); }}
                className="flex items-center gap-2.5 pl-2.5 pr-3 py-1.5 rounded-full bg-white/[.05] border border-white/[.07] hover:bg-white/[.09] cursor-pointer transition-colors"
              >
                <Avatar name={displayName} size={28} />
                <div className="leading-tight hidden sm:block text-left">
                  <div className="text-[12px] font-bold text-white">{displayName}</div>
                  <div className="text-[9px] font-bold text-slate-500 tracking-wider">{roleLabel}</div>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-[#1b1e26] border border-white/[.08] rounded-xl shadow-2xl shadow-black/60 py-1.5 z-50">
                  <div className="px-4 py-2 border-b border-white/[.06]">
                    <div className="text-[13px] font-bold text-white">{displayName}</div>
                    <div className="text-[11px] text-slate-500">{roleLabel}</div>
                  </div>
                  {[
                    ...(isAdmin
                      ? [{ icon: Settings, label: 'Settings', onClick: () => setActiveTab('settings') }]
                      : []),
                    { icon: Users, label: 'All users', onClick: () => setActiveTab('users') },
                    { icon: BarChart3, label: 'Analytics', onClick: () => setActiveTab('analytics') },
                  ].map(i => (
                    <button
                      key={i.label}
                      onClick={() => { i.onClick(); setProfileOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-[12.5px] text-slate-300 hover:bg-white/[.06] hover:text-white cursor-pointer"
                    >
                      <i.icon className="w-4 h-4" /> {i.label}
                    </button>
                  ))}
                  <button
                    onClick={() => { setProfileOpen(false); onLogout(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-[12.5px] text-rose-400 hover:bg-rose-500/10 cursor-pointer border-t border-white/[.06] mt-1"
                  >
                    <LogOut className="w-4 h-4" /> Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="p-5 space-y-5 flex-1">
          {/* Page title */}
          {activeTab !== 'user-details' && (
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <h1 className="text-2xl font-extrabold text-white tracking-tight">{header.title}</h1>
                <p className="text-[12px] text-slate-500 mt-0.5">{header.sub}</p>
              </div>
              <div className="flex items-center gap-2">
                <Btn variant="ghost" icon={UserPlus} onClick={onOpenNewLeadModal}>
                  Add lead
                </Btn>
                <Btn variant="gold" icon={Plus} onClick={onOpenNewProjectModal}>
                  New asset
                </Btn>
              </div>
            </div>
          )}

          {/* ===================== DASHBOARD ===================== */}
          {activeTab === 'dashboard' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Kpi icon={Users} label="Total users" value={String(investors.length)} hint="+12% this month" />
                <Kpi icon={Activity} label="Active clients" value={String(investors.filter(i => i.kycStatus === 'verified').length)} tone="green" hint="+4%" />
                <Kpi icon={TrendingUp} label="Open trades" value={String(openTrades)} tone="blue" />
                <Kpi icon={Ban} label="Blocked" value={String(users.filter(u => u.status === 'blocked').length)} tone="red" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <Card title="Online chat" subtitle="Unanswered messages" className="lg:col-span-1">
                  <div className="p-5">
                    <div className="text-3xl font-extrabold text-[#f5b400]">0</div>
                    <p className="text-[11px] text-slate-500 mt-1">No unanswered messages</p>
                  </div>
                </Card>
                <Card title="Withdrawals" subtitle="Pending processing">
                  <div className="p-5">
                    <div className="text-3xl font-extrabold text-white">{pendingRequestsCount}</div>
                    <p className="text-[11px] text-slate-500 mt-1">requests in queue</p>
                    <Btn size="sm" variant="ghost" className="mt-3" onClick={() => setActiveTab('withdrawals')}>
                      Open
                    </Btn>
                  </div>
                </Card>
                <Card title="Deposits" subtitle="Total volume">
                  <div className="p-5">
                    <div className="text-2xl font-extrabold text-emerald-400">${totalAum.toLocaleString('en-US')}</div>
                    <p className="text-[11px] text-slate-500 mt-1">{requests.filter(r => r.type === 'deposit').length} deposits</p>
                  </div>
                </Card>
                <Card title="Quick registration" subtitle="Create a client account">
                  <div className="p-5 space-y-2">
                    <Btn variant="gold" size="sm" icon={UserPlus} onClick={onOpenNewLeadModal}>
                      Create client
                    </Btn>
                    <p className="text-[11px] text-slate-500">Automatic welcome e-mail with credentials</p>
                  </div>
                </Card>
              </div>

              {/* Trading modules row (PDF: Spot / Futures / Binary / P2P) */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { t: 'P2P Trading', v: '120', s: 'open orders', tone: 'gold' },
                  { t: 'Spot Trading', v: `${trades.filter(x => x.type === 'SPOT').length}`, s: 'last trades', tone: 'blue' },
                  { t: 'Futures Trading', v: `${trades.filter(x => x.type !== 'SPOT').length}`, s: 'open positions', tone: 'green' },
                  { t: 'Binary Trading', v: '8', s: 'active bets', tone: 'red' },
                ].map(m => (
                  <Card key={m.t} className="p-5">
                    <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">{m.t}</div>
                    <div className="text-2xl font-extrabold text-white mt-1.5">{m.v}</div>
                    <div className="text-[11px] text-slate-500">{m.s}</div>
                  </Card>
                ))}
              </div>

              {/* Users quick list */}
              <Card title="Detailed user info" subtitle="Client base · CRM">
                <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {investors.slice(0, 4).map(inv => (
                    <div key={inv.id} className="bg-[#1b1e26] border border-white/[.06] rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar name={inv.name} size={42} />
                          <div className="min-w-0">
                            <div className="font-bold text-white text-[14px] truncate">{inv.name}</div>
                            <div className="text-[11px] text-slate-500 truncate">{inv.email}</div>
                            <div className="text-[11px] text-slate-600">{phonesHidden ? maskPhone(inv.phone) : inv.phone}</div>
                          </div>
                        </div>
                        <Badge tone={inv.kycStatus === 'verified' ? 'green' : inv.kycStatus === 'pending' ? 'gold' : 'red'}>
                          {inv.kycStatus}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-4">
                        <div className="bg-[#14161c] rounded-xl p-2.5 border border-white/[.05]">
                          <div className="text-[10px] text-slate-500">Balance</div>
                          <div className="text-[13px] font-extrabold text-white">${inv.balance.toLocaleString('en-US')}</div>
                        </div>
                        <div className="bg-[#14161c] rounded-xl p-2.5 border border-white/[.05]">
                          <div className="text-[10px] text-slate-500">Invested</div>
                          <div className="text-[13px] font-extrabold text-white">${inv.invested.toLocaleString('en-US')}</div>
                        </div>
                        <div className="bg-[#14161c] rounded-xl p-2.5 border border-white/[.05]">
                          <div className="text-[10px] text-slate-500">Profit</div>
                          <div className="text-[13px] font-extrabold text-emerald-400">+${inv.totalProfit.toLocaleString('en-US')}</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-4">
                        <Btn size="sm" variant="gold" onClick={() => openUser(inv.id)}>
                          Manage
                        </Btn>
                        <Btn size="sm" variant="ghost" icon={PhoneCall} onClick={() => setActiveTab('calls')}>
                          Call
                        </Btn>
                        <Btn size="sm" variant="ghost" icon={MessageSquare} onClick={() => setActiveTab('support')}>
                          Message
                        </Btn>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* ===================== TRADING ===================== */}
          {activeTab === 'trading' && (
            <CrmTradesManager
              investors={investors}
              trades={trades}
              onUpdateInvestorBalance={onUpdateInvestorBalance}
              onCreateTrade={onCreateTrade}
              onUpdateTrade={onUpdateTrade}
              onCloseTrade={onCloseTrade}
            />
          )}

          {/* ===================== ALL USERS ===================== */}
          {activeTab === 'users' && (
            <Card
              title={`All users (${investors.length})`}
              subtitle="Platform accounts, balances and access"
              actions={
                <div className="relative w-64">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Search by name, e-mail, phone..."
                    value={searchInvestor}
                    onChange={e => setSearchInvestor(e.target.value)}
                    className="w-full pl-9"
                  />
                </div>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-white/[.02] border-b border-white/[.06]">
                    <tr>
                      <Th>Client</Th>
                      <Th>Phone</Th>
                      <Th>Balance</Th>
                      <Th>Invested</Th>
                      <Th>Manager</Th>
                      <Th>Status</Th>
                      <Th className="text-right">Actions</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[.05]">
                    {filteredInvestors.map(inv => (
                      <tr key={inv.id} className="hover:bg-white/[.02] transition-colors">
                        <Td>
                          <button onClick={() => openUser(inv.id)} className="flex items-center gap-3 cursor-pointer text-left">
                            <Avatar name={inv.name} size={34} />
                            <div>
                              <div className="font-semibold text-white">{inv.name}</div>
                              <div className="text-[11px] text-slate-500">{inv.email}</div>
                            </div>
                          </button>
                        </Td>
                        <Td className="font-mono text-[12px]">{phonesHidden ? maskPhone(inv.phone) : inv.phone}</Td>
                        <Td className="font-bold text-white">${inv.balance.toLocaleString('en-US')}</Td>
                        <Td>${inv.invested.toLocaleString('en-US')}</Td>
                        <Td className="text-[12px] text-slate-500">{inv.manager}</Td>
                        <Td>
                          <Badge tone={inv.kycStatus === 'verified' ? 'green' : inv.kycStatus === 'pending' ? 'gold' : 'red'}>
                            {inv.kycStatus === 'verified' ? 'Active' : inv.kycStatus}
                          </Badge>
                        </Td>
                        <Td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {inv.kycStatus === 'pending' && (
                              <Btn size="sm" variant="success" onClick={() => onApproveKyc(inv.id)}>
                                Approve KYC
                              </Btn>
                            )}
                            <Btn size="sm" variant="gold" onClick={() => openUser(inv.id)}>
                              Open
                            </Btn>
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Platform accounts (backend users) */}
              <div className="border-t border-white/[.06] p-5">
                <h4 className="text-[13px] font-semibold text-white mb-3">Platform accounts ({users.length})</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-white/[.02]">
                      <tr>
                        <Th>Name</Th>
                        <Th>E-mail</Th>
                        <Th>Role</Th>
                        <Th>Status</Th>
                        <Th className="text-right">Actions</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[.05]">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-white/[.02]">
                          <Td className="font-semibold text-white">{u.name}</Td>
                          <Td className="text-[12px]">{u.email}</Td>
                          <Td>
                            <Badge tone={u.role === 'ADMIN' ? 'gold' : u.role === 'MANAGER' ? 'blue' : 'gray'}>{u.role}</Badge>
                          </Td>
                          <Td>
                            <Badge tone={u.status === 'active' ? 'green' : u.status === 'blocked' ? 'red' : 'gold'}>
                              {u.status}
                            </Badge>
                          </Td>
                          <Td className="text-right">
                            {isAdmin && (
                              <div className="flex items-center justify-end gap-2">
                                <Btn size="sm" variant="ghost" icon={KeyRound} onClick={() => openPwdModal(u)}>
                                  Password
                                </Btn>
                                {statusLoadingId === u.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                                ) : u.status !== 'blocked' ? (
                                  <Btn size="sm" variant="danger" onClick={() => handleStatusChange(u, 'blocked')}>
                                    Block
                                  </Btn>
                                ) : (
                                  <Btn size="sm" variant="success" onClick={() => handleStatusChange(u, 'active')}>
                                    Unblock
                                  </Btn>
                                )}
                              </div>
                            )}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          )}

          {/* ===================== USER DETAILS ===================== */}
          {activeTab === 'user-details' && selectedUser && (
            <UserDetails
              user={selectedUser}
              trades={trades.filter(t => t.investorId === selectedUser.id)}
              phonesHidden={phonesHidden}
              onBack={() => setActiveTab('users')}
              onGoTrading={() => setActiveTab('trading')}
              onGoCalls={() => setActiveTab('calls')}
              onGoTransactions={() => setActiveTab('deposits')}
              onUpdateBalance={onUpdateInvestorBalance}
              onNotify={onNotify}
              notes={notes.filter(n => n.clientId === selectedUser.id)}
              onAddNote={onAddNote}
              status={clientStatuses[selectedUser.id] || 'New'}
              onSetStatus={onSetClientStatus}
              currentUserName={displayName}
              kycDocuments={kycDocuments.filter(
                d =>
                  d.userEmail.toLowerCase() === selectedUser.email.toLowerCase() ||
                  d.userName.toLowerCase() === selectedUser.name.replace(' (You)', '').toLowerCase(),
              )}
              onReviewKyc={onReviewKyc}
              account={users.find(u => u.email.toLowerCase() === selectedUser.email.toLowerCase())}
              onChangePassword={openPwdModal}
              onImpersonate={onImpersonateUser}
              onUpdateUserStatus={onUpdateUserStatus}
              isAdmin={isAdmin}
            />
          )}

          {/* ===================== BLOCKED ===================== */}
          {activeTab === 'blocked' && (
            <Card title="Blocked users" subtitle="Accounts that cannot sign in">
              <div className="p-5 space-y-2">
                {users.filter(u => u.status === 'blocked').length === 0 && (
                  <div className="text-center text-[12px] text-slate-600 py-10">No blocked users</div>
                )}
                {users
                  .filter(u => u.status === 'blocked')
                  .map(u => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between bg-[#1b1e26] border border-white/[.06] rounded-xl px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} size={34} />
                        <div>
                          <div className="text-[13px] font-semibold text-white">{u.name}</div>
                          <div className="text-[11px] text-slate-500">{u.email}</div>
                        </div>
                      </div>
                      <Btn size="sm" variant="success" onClick={() => handleStatusChange(u, 'active')}>
                        Unblock
                      </Btn>
                    </div>
                  ))}
              </div>
            </Card>
          )}

          {/* ===================== HAPPY LETTER ===================== */}
          {activeTab === 'happy-letter' && (
            <Card title="Happy letter" subtitle="Mass e-mail to the selected base">
              <form
                onSubmit={async e => {
                  e.preventDefault();
                  if (sendingLetter) return;
                  setSendingLetter(true);
                  try {
                    const audience =
                      letterAudience === 'Active only'
                        ? 'active'
                        : letterAudience === 'No deposit'
                        ? 'noDeposit'
                        : 'all';
                    const r = await apiSendMailing(letterSubject, letterBody, audience);
                    onNotify(r.message);
                  } catch (err) {
                    onNotify(err instanceof Error ? err.message : 'Could not send the letter');
                  } finally {
                    setSendingLetter(false);
                  }
                }}
                className="p-5 space-y-4 max-w-2xl"
              >
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-500">Recipients</label>
                  <Select className="w-full mt-1.5" value={letterAudience} onChange={e => setLetterAudience(e.target.value)}>
                    <option>All clients</option>
                    <option>Active only</option>
                    <option>No deposit</option>
                  </Select>
                  <div className="text-[11px] text-slate-600 mt-1">
                    {letterAudience === 'Active only'
                      ? mailAudience.active
                      : letterAudience === 'No deposit'
                      ? mailAudience.noDeposit
                      : mailAudience.all}{' '}
                    recipient(s) selected
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-500">Subject</label>
                  <Input className="w-full mt-1.5" value={letterSubject} onChange={e => setLetterSubject(e.target.value)} />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-500">Message</label>
                  <textarea
                    rows={7}
                    value={letterBody}
                    onChange={e => setLetterBody(e.target.value)}
                    className="w-full mt-1.5 px-3.5 py-2.5 bg-[#0f1116] border border-white/[.08] rounded-xl text-[13px] text-slate-100 focus:outline-none focus:border-[#f5b400]/50 resize-none"
                  />
                </div>
                <Btn
                  variant="gold"
                  icon={Mail}
                  type="submit"
                  disabled={!letterSubject.trim() || !letterBody.trim() || sendingLetter}
                >
                  {sendingLetter ? 'Sending...' : 'Send letter'}
                </Btn>
                <p className="text-[11px] text-slate-600">
                  Letters go out through the platform mail server to real client inboxes.
                </p>
              </form>
            </Card>
          )}

          {/* ===================== WITHDRAWALS / DEPOSITS ===================== */}
          {(activeTab === 'withdrawals' || activeTab === 'deposits') && (
            <RequestsTable
              title={activeTab === 'withdrawals' ? 'Withdrawal requests' : 'Deposits'}
              requests={requests.filter(r => (activeTab === 'withdrawals' ? r.type === 'withdrawal' : r.type === 'deposit'))}
              onApprove={onApproveRequest}
              onReject={onRejectRequest}
            />
          )}

          {/* ===================== PARTNER BANKS ===================== */}
          {activeTab === 'banks' && (
            <Card title="Partner banks & providers" subtitle="Payment routing for deposits">
              <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { n: 'USDT TRC-20', s: 'Crypto wallet' },
                  { n: 'Visa / Mastercard', s: 'Card acquiring' },
                  { n: 'SEPA transfer', s: 'EU bank wire' },
                  { n: 'Bitcoin', s: 'BTC wallet' },
                  { n: 'PayPal', s: 'E-wallet' },
                  { n: 'ACH transfer', s: 'US bank transfer' },
                ].map(b => (
                  <button
                    key={b.n}
                    onClick={() => setProviders(p => ({ ...p, [b.n]: !p[b.n] }))}
                    className={`text-left border rounded-2xl p-4 cursor-pointer transition-colors ${
                      providers[b.n]
                        ? 'bg-[#f5b400]/[.07] border-[#f5b400]/30'
                        : 'bg-[#1b1e26] border-white/[.06] hover:border-white/[.15]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-white text-[13px]">{b.n}</div>
                      <Badge tone={providers[b.n] ? 'green' : 'gray'}>{providers[b.n] ? 'active' : 'off'}</Badge>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">{b.s}</div>
                    <div className="text-[10px] text-slate-600 mt-2">Click to {providers[b.n] ? 'disable' : 'enable'}</div>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* ===================== LEADS ===================== */}
          {activeTab === 'leads' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {(
                [
                  { id: 'new', title: 'NEW', tone: 'blue' },
                  { id: 'contact', title: 'CALLBACK', tone: 'gold' },
                  { id: 'kyc', title: 'DEP', tone: 'violet' },
                  { id: 'active', title: 'ACTIVE', tone: 'green' },
                ] as { id: LeadStage; title: string; tone: 'blue' | 'gold' | 'violet' | 'green' }[]
              ).map(col => (
                <div key={col.id} className="bg-[#14161c] border border-white/[.07] rounded-2xl p-3">
                  <div className="flex items-center justify-between px-1 pb-3">
                    <Badge tone={col.tone}>{col.title}</Badge>
                    <span className="text-[11px] text-slate-600">{leads.filter(l => l.stage === col.id).length}</span>
                  </div>
                  <div className="space-y-2">
                    {leads
                      .filter(l => l.stage === col.id)
                      .map(lead => (
                        <div key={lead.id} className="bg-[#1b1e26] border border-white/[.06] rounded-xl p-3">
                          <div className="font-semibold text-white text-[13px]">{lead.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {phonesHidden ? maskPhone(lead.phone) : lead.phone}
                          </div>
                          <div className="text-[12px] text-[#f5b400] font-bold mt-1">
                            ${lead.potentialAmount.toLocaleString('en-US')}
                          </div>
                          <div className="text-[10px] text-slate-600 mt-1">{lead.manager}</div>
                          <div className="flex items-center gap-1.5 mt-2.5">
                            <button
                              onClick={() => onMoveLeadStage(lead.id, 'prev')}
                              className="p-1.5 rounded-lg bg-white/[.05] text-slate-400 hover:text-white cursor-pointer"
                            >
                              <ArrowLeft className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setCommentLead(lead)}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-white/[.05] text-slate-300 text-[10px] font-bold hover:bg-white/[.1] cursor-pointer"
                            >
                              <MessageSquare className="w-3 h-3" /> {lead.comments.length}
                            </button>
                            <button
                              onClick={() => onMoveLeadStage(lead.id, 'next')}
                              className="p-1.5 rounded-lg bg-[#f5b400]/15 text-[#f5b400] hover:bg-[#f5b400]/25 cursor-pointer"
                            >
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ===================== SUPPORT ===================== */}
          {activeTab === 'support' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card title="Tickets" subtitle="Click a ticket to open the conversation" className="lg:col-span-1">
                <div className="p-4 space-y-2">
                  {investors.slice(0, 4).map((inv, i) => (
                    <button
                      key={inv.id}
                      onClick={() => setActiveTicket(inv.id)}
                      className={`w-full text-left border rounded-xl p-3 cursor-pointer transition-colors ${
                        activeTicket === inv.id
                          ? 'bg-[#f5b400]/[.1] border-[#f5b400]/40'
                          : 'bg-[#1b1e26] border-white/[.06] hover:border-white/[.15]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-[13px] font-semibold text-white">{inv.name}</div>
                        <Badge tone={i === 0 ? 'red' : i === 1 ? 'gold' : 'gray'}>
                          {i === 0 ? 'high' : i === 1 ? 'open' : 'closed'}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">Withdrawal question · #{1000 + i}</div>
                    </button>
                  ))}
                </div>
              </Card>
              <Card
                title="Live chat"
                subtitle={activeTicket ? investors.find(i => i.id === activeTicket)?.name : 'Conversation history'}
                className="lg:col-span-2"
              >
                <div className="p-4 space-y-3 h-80 overflow-y-auto">
                  {chatLog.map((m, idx) => (
                    <div
                      key={idx}
                      className={`max-w-[70%] px-4 py-2.5 text-[13px] rounded-2xl ${
                        m.me
                          ? 'ml-auto bg-[#f5b400]/15 border border-[#f5b400]/25 rounded-tr-sm text-[#f9d571]'
                          : 'bg-[#1b1e26] border border-white/[.06] rounded-tl-sm'
                      }`}
                    >
                      {m.text}
                      <div className={`text-[10px] mt-1 ${m.me ? 'text-[#f5b400]/60' : 'text-slate-600'}`}>
                        {m.me ? 'Support' : 'Client'} · {m.time}
                      </div>
                    </div>
                  ))}
                </div>
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    if (!chatText.trim()) return;
                    setChatLog(l => [
                      ...l,
                      {
                        me: true,
                        text: chatText.trim(),
                        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
                      },
                    ]);
                    setChatText('');
                  }}
                  className="p-4 border-t border-white/[.06] flex gap-2"
                >
                  <Input
                    className="flex-1"
                    placeholder="Type a message..."
                    value={chatText}
                    onChange={e => setChatText(e.target.value)}
                  />
                  <Btn variant="gold" type="submit" disabled={!chatText.trim()}>
                    Send
                  </Btn>
                </form>
              </Card>
            </div>
          )}

          {/* ===================== CALLS ===================== */}
          {activeTab === 'calls' && <CallsPanel investors={investors} phonesHidden={phonesHidden} />}

          {/* ===================== ANALYTICS ===================== */}
          {activeTab === 'analytics' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <Kpi icon={Wallet} label="AUM" value={`$${(totalAum / 1000).toFixed(1)}K`} hint="+14%" />
                <Kpi icon={TrendingUp} label="Total PnL" value={`+$${totalProfit.toLocaleString('en-US')}`} tone="green" />
                <Kpi icon={Users} label="FTD" value="80.8%" tone="blue" />
                <Kpi icon={PhoneCall} label="Call rate" value="8.1%" tone="gold" />
                <Kpi icon={BarChart3} label="Win rate" value="62.4%" tone="green" />
              </div>
              <Card title="AUM dynamics" subtitle="Assets under management, $M">
                <div className="p-5">
                  {(() => {
                    const max = Math.max(...CRM_AUM_MONTHS.map(m => m.aum)) * 1.15;
                    return (
                      <div className="flex items-end gap-3 h-56">
                        {CRM_AUM_MONTHS.map(m => (
                          <div key={m.month} className="flex-1 h-full flex flex-col items-center">
                            {/* bar area — fixed height so the % below resolves correctly */}
                            <div className="flex-1 w-full flex flex-col justify-end items-center gap-1.5">
                              <span className="text-[10px] text-slate-400 font-semibold">{m.aum}</span>
                              <div
                                className="w-full rounded-t-lg bg-gradient-to-t from-[#f5b400]/25 to-[#f5b400] transition-all hover:from-[#f5b400]/40"
                                style={{ height: `${(m.aum / max) * 100}%` }}
                                title={`${m.month}: $${m.aum}M · ${m.activeInvestors} active clients`}
                              />
                            </div>
                            <span className="text-[10px] text-slate-600 mt-2">{m.month}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </Card>
            </div>
          )}

          {/* ===================== SETTINGS ===================== */}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card
                title="Deposit wallet addresses"
                subtitle="Shown to clients when they choose a crypto deposit"
                className="lg:col-span-2"
              >
                <div className="p-5 space-y-3 max-w-2xl">
                  <p className="text-[12px] text-slate-500">
                    Clients see the address for the network they pick. Leave a field empty to hide
                    that option — they will be asked to contact their advisor instead.
                  </p>
                  {(['BTC', 'ETH', 'USDC'] as const).map(t => (
                    <div key={t}>
                      <label className="text-[11px] font-bold uppercase text-slate-500">
                        {t} address
                      </label>
                      <Input
                        className="w-full mt-1.5 font-mono text-[12px]"
                        placeholder={`Your ${t} receiving address`}
                        value={walletDraft[t] ?? ''}
                        onChange={e => setWalletDraft(w => ({ ...w, [t]: e.target.value }))}
                      />
                    </div>
                  ))}
                  <Btn
                    variant="gold"
                    disabled={savingWallets}
                    onClick={async () => {
                      setSavingWallets(true);
                      try {
                        await apiSaveDepositWallets(walletDraft);
                        onNotify('Deposit addresses saved — clients see them immediately.');
                      } catch (err) {
                        onNotify(err instanceof Error ? err.message : 'Could not save the addresses');
                      } finally {
                        setSavingWallets(false);
                      }
                    }}
                  >
                    {savingWallets ? 'Saving...' : 'Save addresses'}
                  </Btn>
                </div>
              </Card>

              <Card title="Privacy & access" subtitle="Personal rules for agents">
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between bg-[#1b1e26] border border-white/[.06] rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <EyeOff className="w-4 h-4 text-[#f5b400] mt-0.5" />
                      <div>
                        <div className="text-[13px] font-semibold text-white">Hide phone numbers from agents</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Admins always see full numbers, agents see the last 4 digits only
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={onToggleHidePhones}
                      className={`w-12 h-6 rounded-full relative transition-colors cursor-pointer shrink-0 ${
                        settings.hidePhonesFromAgents ? 'bg-[#f5b400]' : 'bg-white/15'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                          settings.hidePhonesFromAgents ? 'left-6.5' : 'left-0.5'
                        }`}
                        style={{ left: settings.hidePhonesFromAgents ? 26 : 2 }}
                      />
                    </button>
                  </div>
                  {([
                    { key: 'duplicateControl' as const, t: 'Duplicate control (block repeated leads)', s: 'Every new contact is checked against the base' },
                    { key: 'manualClosing' as const, t: 'Allow manual position closing by clients', s: 'When off, only admins can close positions' },
                    { key: 'callRecording' as const, t: 'Enable call recording', s: 'Store call records for quality control' },
                  ]).map(r => (
                    <div key={r.key} className="flex items-center justify-between bg-[#1b1e26] border border-white/[.06] rounded-xl p-4">
                      <div>
                        <div className="text-[13px] text-slate-200 font-semibold">{r.t}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{r.s}</div>
                      </div>
                      <button
                        onClick={() => setRules(p => ({ ...p, [r.key]: !p[r.key] }))}
                        className={`w-12 h-6 rounded-full relative transition-colors cursor-pointer shrink-0 ${
                          rules[r.key] ? 'bg-[#f5b400]' : 'bg-white/15'
                        }`}
                      >
                        <span
                          className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                          style={{ left: rules[r.key] ? 26 : 2 }}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
              <Card title="Modules" subtitle="Enable only what your project needs">
                <div className="p-5 grid grid-cols-2 gap-3">
                  {Object.keys(modules).map(m => (
                    <button
                      key={m}
                      onClick={() => setModules(p => ({ ...p, [m]: !p[m] }))}
                      className={`flex items-center gap-2 border rounded-xl px-3.5 py-2.5 cursor-pointer transition-colors text-left ${
                        modules[m]
                          ? 'bg-[#f5b400]/10 border-[#f5b400]/30'
                          : 'bg-[#1b1e26] border-white/[.06] hover:border-white/[.15]'
                      }`}
                    >
                      <Circle
                        className={`w-2.5 h-2.5 ${modules[m] ? 'text-emerald-400 fill-emerald-400' : 'text-slate-600 fill-slate-600'}`}
                      />
                      <span className={`text-[13px] ${modules[m] ? 'text-white font-semibold' : 'text-slate-400'}`}>{m}</span>
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </main>
      </div>

      {/* ===== MODAL: Lead comments ===== */}
      {commentLead && (
        <Modal onClose={() => setCommentLead(null)} title="Lead comments" subtitle={`${commentLead.name} · $${commentLead.potentialAmount.toLocaleString('en-US')} potential`}>
          <div className="space-y-2.5 max-h-56 overflow-y-auto">
            {commentLead.comments.length === 0 && (
              <div className="text-center text-[12px] text-slate-600 py-6">No comments yet</div>
            )}
            {commentLead.comments.map(c => (
              <div key={c.id} className="bg-[#1b1e26] border border-white/[.06] rounded-xl p-3">
                <div className="text-[13px] text-slate-200">{c.text}</div>
                <div className="text-[10px] text-slate-600 mt-1.5">
                  {c.author} · {c.date}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-end gap-2 pt-2">
            <textarea
              rows={2}
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 px-3.5 py-2.5 bg-[#0f1116] border border-white/[.08] rounded-xl text-[13px] text-slate-100 resize-none focus:outline-none focus:border-[#f5b400]/50"
            />
            <Btn variant="gold" onClick={handleAddComment} disabled={!commentText.trim()}>
              Send
            </Btn>
          </div>
        </Modal>
      )}

      {/* ===== MODAL: Change password ===== */}
      {pwdUser && (
        <Modal onClose={closePwdModal} title="Change password" subtitle={`${pwdUser.name} (${pwdUser.email})`}>
          {pwdDone ? (
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <CheckCircle className="w-12 h-12 text-emerald-400" />
              <div className="text-[13px] text-slate-300">Password changed. The user must sign in with the new password.</div>
              <Btn variant="gold" onClick={closePwdModal}>
                Done
              </Btn>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">New password (min 6)</label>
                <Input
                  value={newPwd}
                  onChange={e => {
                    setNewPwd(e.target.value);
                    if (pwdError) setPwdError(null);
                  }}
                  placeholder="Enter new password"
                  className="w-full font-mono"
                />
              </div>
              {pwdError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-[12px] text-rose-400">{pwdError}</div>
              )}
              <div className="flex items-center justify-end gap-2 pt-2">
                <Btn variant="ghost" onClick={closePwdModal}>
                  Cancel
                </Btn>
                <Btn variant="gold" icon={KeyRound} onClick={handleChangePassword} disabled={pwdLoading || newPwd.length < 6}>
                  {pwdLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Set new password
                </Btn>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
};

/* ============================================================
   USER DETAILS — 1:1 with the reference screenshot
   ============================================================ */
const UserDetails: React.FC<{
  user: Investor;
  trades: AdminTrade[];
  phonesHidden: boolean;
  onBack: () => void;
  onGoTrading: () => void;
  onGoCalls: () => void;
  onGoTransactions: () => void;
  onUpdateBalance: (id: string, v: number) => void;
  onNotify: (m: string) => void;
  notes: ClientNote[];
  onAddNote: (clientId: string, text: string) => void;
  status: string;
  onSetStatus: (clientId: string, status: string) => void;
  currentUserName: string;
  kycDocuments: ApiKycDoc[];
  onReviewKyc: (docId: number, status: 'approved' | 'rejected', reason?: string) => void;
  /** Real platform account behind this client card (matched by e-mail) */
  account?: ApiUser;
  onChangePassword: (user: ApiUser) => void;
  /** Admin: open the client's cabinet in a support session */
  onImpersonate?: (user: ApiUser) => void;
  onUpdateUserStatus: (userId: number, status: string) => Promise<void>;
  isAdmin: boolean;
}> = ({
  user,
  trades,
  phonesHidden,
  onBack,
  onGoTrading,
  onGoCalls,
  onGoTransactions,
  onUpdateBalance,
  onNotify,
  notes,
  onAddNote,
  status,
  onSetStatus,
  currentUserName,
  kycDocuments,
  onReviewKyc,
  account,
  onChangePassword,
  onImpersonate,
  onUpdateUserStatus,
  isAdmin,
}) => {
  const [moreOpen, setMoreOpen] = useState(false);
  // Real block state comes from the platform account, not local UI state
  const blocked = account?.status === 'blocked';
  const [withdrawBlocked, setWithdrawBlocked] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [manager, setManager] = useState(user.manager);
  const [balanceInput, setBalanceInput] = useState(String(user.balance));
  const moreRef = useRef<HTMLDivElement>(null);
  const [dialog, setDialog] = useState<null | 'topup' | 'bonus' | 'message'>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [noteText, setNoteText] = useState('');

  // KYC scans are behind auth, so fetch them with the token and show as blob URLs
  const [kycPreviews, setKycPreviews] = useState<Record<number, string>>({});
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];

    (async () => {
      const pairs = await Promise.all(
        kycDocuments
          .filter(d => d.mime.startsWith('image/'))
          .map(async d => {
            try {
              const url = await fetchKycFile(d.id);
              urls.push(url);
              return [d.id, url] as const;
            } catch {
              return null;
            }
          }),
      );
      if (!cancelled) setKycPreviews(Object.fromEntries(pairs.filter(Boolean) as (readonly [number, string])[]));
    })();

    return () => {
      cancelled = true;
      urls.forEach(u => URL.revokeObjectURL(u));
    };
  }, [kycDocuments]);
  const [dialogAmount, setDialogAmount] = useState('500');
  const [dialogText, setDialogText] = useState('');

  useEffect(() => {
    setManager(user.manager);
    setBalanceInput(String(user.balance));
  }, [user]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const [first, ...rest] = user.name.replace(' (You)', '').split(' ');
  const last = rest.join(' ') || '—';

  const shortName = user.name.replace(' (You)', '');

  // Per-client deposit addresses (admin only)
  const [clientWallets, setClientWallets] = useState<Record<string, string>>({ BTC: '', ETH: '', USDC: '' });
  const [clientWalletDefaults, setClientWalletDefaults] = useState<Record<string, string>>({});
  const [savingClientWallets, setSavingClientWallets] = useState(false);

  useEffect(() => {
    if (!account || !isAdmin) return;
    apiClientWallets(account.id)
      .then(r => {
        setClientWallets(r.wallets);
        setClientWalletDefaults(r.defaults);
      })
      .catch(() => undefined);
  }, [account, isAdmin]);
  const moreItems = [
    {
      icon: FileText,
      label: 'View user logs',
      onClick: () => onNotify('Activity log will be available in the analytics module.'),
    },
    { icon: PhoneCall, label: 'Call', onClick: onGoCalls },
    { icon: History, label: 'Call history', onClick: onGoCalls },
    {
      icon: BellRing,
      label: 'Push notification',
      onClick: () => onNotify('The client will receive this as an in-app notification.'),
    },
    {
      icon: KeyRound,
      label: 'Change password',
      onClick: () => {
        if (!account) return onNotify('This client does not have a platform account.');
        if (!isAdmin) return onNotify('Only an administrator can change passwords.');
        onChangePassword(account);
      },
    },
    {
      icon: Lock,
      label: withdrawBlocked ? 'Unblock withdrawal' : 'Block withdrawal',
      onClick: () => {
        setWithdrawBlocked(v => !v);
        onNotify(
          withdrawBlocked
            ? `Withdrawals unblocked for ${shortName} (applies once payouts run through the server).`
            : `Withdrawals blocked for ${shortName} (applies once payouts run through the server).`,
        );
      },
    },
    {
      icon: Ban,
      label: blocked ? 'Unblock account' : 'Block account',
      danger: true,
      onClick: async () => {
        if (!account) {
          onNotify('This client does not have a platform account — nothing to block.');
          return;
        }
        if (!isAdmin) {
          onNotify('Only an administrator can block accounts.');
          return;
        }
        setStatusBusy(true);
        try {
          await onUpdateUserStatus(account.id, blocked ? 'active' : 'blocked');
        } finally {
          setStatusBusy(false);
        }
      },
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <button onClick={onBack} className="text-[11px] text-slate-500 hover:text-slate-300 cursor-pointer flex items-center gap-1 mb-2">
          <ArrowLeft className="w-3 h-3" /> Back to all users
        </button>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">User details</h1>
        <p className="text-[12px] text-slate-500 mt-0.5">Detailed information about the user</p>
      </div>

      {/* Header card with actions */}
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <Avatar name={user.name} size={72} />
          <div>
            <h2 className="text-xl font-extrabold text-white">{user.name.replace(' (You)', '')}</h2>
            <div className="mt-2">
              <Badge tone={blocked ? 'red' : 'green'}>
                <CheckCircle2 className="w-3 h-3" /> {blocked ? 'Blocked' : 'Active'}
              </Badge>
              {withdrawBlocked && (
                <Badge tone="red" className="ml-2">
                  <Lock className="w-3 h-3" /> Withdrawal blocked
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons — as on reference */}
        <div className="flex flex-wrap gap-2.5 mt-6">
          <Btn variant="ghost" icon={DollarSign} onClick={() => { setDialogAmount('500'); setDialog('topup'); }}>
            Top up trading account
          </Btn>
          <Btn variant="ghost" icon={Gift} onClick={() => { setDialogAmount('100'); setDialog('bonus'); }}>
            Bonus
          </Btn>
          <Btn
            variant="ghost"
            icon={LogIn}
            onClick={() => {
              if (!account) return onNotify('This client does not have a platform account.');
              if (!isAdmin) return onNotify('Only an administrator can sign in as a client.');
              onImpersonate?.(account);
            }}
          >
            Login as user
          </Btn>
          <Btn variant="ghost" icon={MessageSquare} onClick={() => { setDialogText(''); setDialog('message'); }}>
            Message
          </Btn>
        </div>
        <div className="flex flex-wrap gap-2.5 mt-2.5">
          <Btn variant="ghost" icon={DollarSign} onClick={onGoTransactions}>
            Other deposits
          </Btn>
          <Btn variant="ghost" icon={History} onClick={onGoTransactions}>
            Transaction history
          </Btn>
          <Btn variant="ghost" icon={Search} onClick={() => setSearchOpen(v => !v)}>
            Search
          </Btn>

          <div className="relative" ref={moreRef}>
            <Btn variant="ghost" onClick={() => setMoreOpen(v => !v)}>
              More <ChevronDown className={`w-3.5 h-3.5 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
            </Btn>
            {moreOpen && (
              <div className="absolute left-0 top-full mt-2 w-60 bg-[#1b1e26] border border-white/[.08] rounded-xl shadow-2xl shadow-black/60 py-1.5 z-40">
                {moreItems.map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      onClick={() => {
                        item.onClick?.();
                        setMoreOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12.5px] text-left transition-colors cursor-pointer ${
                        item.danger ? 'text-rose-400 hover:bg-rose-500/10' : 'text-slate-300 hover:bg-white/[.06] hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Per-client deposit addresses */}
      {account && isAdmin && (
        <Card
          title="Deposit wallet addresses"
          subtitle={`Shown to ${shortName} when depositing — leave blank to use the shared address`}
        >
          <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['BTC', 'ETH', 'USDC'] as const).map(t => (
              <div key={t}>
                <label className="text-[11px] font-bold uppercase text-slate-500">{t}</label>
                <Input
                  className="w-full mt-1.5 font-mono text-[11px]"
                  placeholder={clientWalletDefaults[t] ? `Default: ${clientWalletDefaults[t]}` : `${t} address`}
                  value={clientWallets[t] ?? ''}
                  onChange={e => setClientWallets(w => ({ ...w, [t]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="px-5 pb-5">
            <Btn
              variant="gold"
              disabled={savingClientWallets}
              onClick={async () => {
                setSavingClientWallets(true);
                try {
                  await apiSaveClientWallets(account.id, clientWallets);
                  onNotify(`Deposit addresses saved for ${shortName}.`);
                } catch (err) {
                  onNotify(err instanceof Error ? err.message : 'Could not save the addresses');
                } finally {
                  setSavingClientWallets(false);
                }
              }}
            >
              {savingClientWallets ? 'Saving...' : 'Save addresses'}
            </Btn>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main information */}
        <Card title="Main information" className="lg:col-span-2">
          <div className="px-5 pb-2">
            <Field label="Name">{first}</Field>
            <Field label="Surname">{last}</Field>
            <Field label="Email">{user.email}</Field>
            {/* Passwords are stored hashed — they cannot be read back, only reset */}
            <Field label="Password">
              <span className="inline-flex items-center gap-2">
                <span className="font-mono text-slate-500">••••••••</span>
                {account && isAdmin ? (
                  <Btn size="sm" variant="ghost" icon={KeyRound} onClick={() => onChangePassword(account)}>
                    Change
                  </Btn>
                ) : (
                  <span className="text-[11px] text-slate-600">
                    {account ? 'admin only' : 'no account yet'}
                  </span>
                )}
              </span>
            </Field>
            {account && (
              <Field label="Account status">
                <span className="inline-flex items-center gap-2">
                  <Badge tone={blocked ? 'red' : account.status === 'pending' ? 'gold' : 'green'}>
                    {account.status}
                  </Badge>
                  {isAdmin && (
                    <Btn
                      size="sm"
                      variant={blocked ? 'success' : 'danger'}
                      disabled={statusBusy}
                      onClick={async () => {
                        setStatusBusy(true);
                        try {
                          await onUpdateUserStatus(account.id, blocked ? 'active' : 'blocked');
                        } finally {
                          setStatusBusy(false);
                        }
                      }}
                    >
                      {statusBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : blocked ? 'Unblock' : 'Block'}
                    </Btn>
                  )}
                </span>
              </Field>
            )}
            <Field label="Phone">
              <span className="font-mono">{phonesHidden ? maskPhone(user.phone) : user.phone}</span>
            </Field>
            <Field label="Assigned manager">
              <Select
                value={manager}
                onChange={e => {
                  setManager(e.target.value);
                  onNotify(`Manager changed to ${e.target.value}`);
                }}
              >
                <option>No manager (super-admin)</option>
                <option>Laura Bennett (Senior Advisor)</option>
                <option>Daniel Foster (Desk 2)</option>
                <option value={user.manager}>{user.manager}</option>
              </Select>
            </Field>
            <Field label="Registration date">{user.registrationDate}</Field>
            <Field label="KYC document">{user.documentName || '—'}</Field>
          </div>
        </Card>

        {/* Account info */}
        <div className="space-y-5">
          <Card title="Account information">
            <div className="px-5 pb-2">
              <Field label="Balance">
                <span className="text-emerald-400 font-extrabold">${user.balance.toLocaleString('en-US')}</span>
              </Field>
              <Field label="Invested">${user.invested.toLocaleString('en-US')}</Field>
              <Field label="Total profit">
                <span className="text-emerald-400">+${user.totalProfit.toLocaleString('en-US')}</span>
              </Field>
              <Field label="Open trades">{trades.filter(t => t.status === 'OPEN').length}</Field>
              <Field label="KYC status">
                <Badge tone={user.kycStatus === 'verified' ? 'green' : user.kycStatus === 'pending' ? 'gold' : 'red'}>
                  {user.kycStatus}
                </Badge>
              </Field>
            </div>
            <div className="p-5 pt-3 border-t border-white/[.06] space-y-2">
              <label className="text-[11px] font-bold uppercase text-slate-500">Set balance manually</label>
              <div className="flex gap-2">
                <Input value={balanceInput} onChange={e => setBalanceInput(e.target.value)} className="flex-1" />
                <Btn
                  variant="gold"
                  onClick={() => {
                    onUpdateBalance(user.id, Number(balanceInput) || 0);
                    onNotify(`Balance updated: $${Number(balanceInput || 0).toLocaleString('en-US')}`);
                  }}
                >
                  Save
                </Btn>
              </div>
            </div>
          </Card>

          <Card title="PDF statement" subtitle="Editable trading report">
            <div className="p-5 space-y-2">
              <p className="text-[12px] text-slate-500">
                Adjust fields and download a ready statement for the client in one click.
              </p>
              <Btn
                variant="ghost"
                icon={Download}
                onClick={() => onNotify('Statement export will be available shortly.')}
              >
                Download PDF
              </Btn>
            </div>
          </Card>
        </div>
      </div>

      {/* KYC review — approve or reject each uploaded document */}
      <Card
        title="Identity verification"
        subtitle="Documents uploaded by the client"
        actions={
          <Badge tone={kycDocuments.filter(d => d.status === 'approved').length === 3 ? 'green' : 'gold'}>
            {kycDocuments.filter(d => d.status === 'approved').length}/3 approved
          </Badge>
        }
      >
        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['front', 'back', 'address'] as const).map(type => {
            const doc = kycDocuments.find(d => d.type === type);
            return (
              <div key={type} className="bg-[#1b1e26] border border-white/[.06] rounded-2xl p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-bold text-white">{KYC_DOC_LABELS[type]}</span>
                  <Badge
                    tone={
                      doc?.status === 'approved'
                        ? 'green'
                        : doc?.status === 'rejected'
                        ? 'red'
                        : doc
                        ? 'gold'
                        : 'gray'
                    }
                  >
                    {doc ? doc.status : 'not uploaded'}
                  </Badge>
                </div>

                <div className="mt-3 h-32 rounded-xl bg-[#0f1116] border border-white/[.06] flex items-center justify-center overflow-hidden">
                  {doc ? (
                    kycPreviews[doc.id] ? (
                      <a href={kycPreviews[doc.id]} target="_blank" rel="noreferrer" className="w-full h-full" title="Open full size">
                        <img src={kycPreviews[doc.id]} alt={KYC_DOC_LABELS[type]} className="w-full h-full object-cover" />
                      </a>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-slate-400">
                        <FileText className="w-6 h-6" />
                        <span className="text-[10px] px-2 text-center truncate max-w-full">{doc.fileName}</span>
                      </div>
                    )
                  ) : (
                    <span className="text-[11px] text-slate-600">Waiting for the client</span>
                  )}
                </div>

                {doc && (
                  <>
                    <div className="text-[10px] text-slate-600 mt-2">
                      Uploaded {new Date(doc.uploadedAt).toLocaleString('en-US')}
                    </div>
                    {doc.reviewedBy && (
                      <div className="text-[10px] text-slate-600">
                        Reviewed by {doc.reviewedBy}
                      </div>
                    )}
                    {doc.rejectReason && (
                      <div className="mt-1.5 text-[11px] text-rose-400">{doc.rejectReason}</div>
                    )}
                    {doc.status !== 'approved' && (
                      <div className="flex gap-2 mt-3">
                        <Btn
                          size="sm"
                          variant="success"
                          className="flex-1 justify-center"
                          onClick={() => onReviewKyc(doc.id, 'approved')}
                        >
                          Approve
                        </Btn>
                        <Btn
                          size="sm"
                          variant="danger"
                          className="flex-1 justify-center"
                          onClick={() => {
                            const reason = window.prompt('Reason for rejection (shown to the client):', 'Document is blurry or cropped');
                            if (reason !== null) onReviewKyc(doc.id, 'rejected', reason || undefined);
                          }}
                        >
                          Reject
                        </Btn>
                      </div>
                    )}
                    {doc.status === 'approved' && (
                      <div className="mt-3 text-[11px] text-emerald-400 text-center py-1.5">Approved</div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Client status + append-only agent notes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card title="Client status" subtitle="Workflow stage set by the agent">
          <div className="p-5 space-y-3">
            <Select value={status} onChange={e => onSetStatus(user.id, e.target.value)} className="w-full">
              {CLIENT_STATUSES.map(st => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </Select>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">Current:</span>
              <Badge tone={statusTone(status)}>{status}</Badge>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              The full status list will be supplied by the client and plugged in here.
            </p>
          </div>
        </Card>

        <Card
          title="Agent notes"
          subtitle="Internal only — never visible to the client"
          className="lg:col-span-2"
          actions={<Badge tone="gray">{notes.length} entries</Badge>}
        >
          <div className="p-5 space-y-3">
            <div className="space-y-2.5 max-h-64 overflow-y-auto">
              {notes.length === 0 && (
                <div className="text-center text-[12px] text-slate-600 py-6">
                  No notes yet — add the first daily update below.
                </div>
              )}
              {notes.map(n => (
                <div key={n.id} className="bg-[#1b1e26] border border-white/[.06] rounded-xl p-3.5">
                  <div className="text-[13px] text-slate-200 whitespace-pre-wrap">{n.text}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] text-slate-500 font-semibold">{n.author}</span>
                    <Badge tone={n.authorRole === 'ADMIN' ? 'gold' : 'blue'}>{n.authorRole}</Badge>
                    <span className="text-[10px] text-slate-600">{new Date(n.createdAt).toLocaleString('en-US')}</span>
                    <span className="text-[10px] text-slate-700 ml-auto flex items-center gap-1">
                      <Lock className="w-3 h-3" /> locked
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                if (!noteText.trim()) return;
                onAddNote(user.id, noteText.trim());
                setNoteText('');
              }}
              className="space-y-2"
            >
              <textarea
                rows={3}
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder={`Daily note from ${currentUserName}...`}
                className="w-full px-3.5 py-2.5 bg-[#0f1116] border border-white/[.08] rounded-xl text-[13px] text-slate-100 resize-none focus:outline-none focus:border-[#f5b400]/50"
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] text-slate-600">
                  Once sent, a note cannot be edited or deleted.
                </span>
                <Btn variant="gold" type="submit" disabled={!noteText.trim()}>
                  Send
                </Btn>
              </div>
            </form>
          </div>
        </Card>
      </div>

      {/* Inline search */}
      {searchOpen && (
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-500" />
            <Input
              autoFocus
              className="flex-1"
              placeholder="Search transactions, positions, notes..."
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
            />
            <Btn variant="ghost" onClick={() => { setSearchOpen(false); setSearchQ(''); }}>
              Close
            </Btn>
          </div>
          {searchQ && (
            <div className="mt-3 text-[12px] text-slate-500">
              {trades.filter(t => t.asset.toLowerCase().includes(searchQ.toLowerCase())).length} position(s) match
              “{searchQ}”
            </div>
          )}
        </Card>
      )}

      {/* Client trades */}
      <Card
        title="Client positions"
        subtitle="Open and closed trades"
        actions={
          <Btn size="sm" variant="gold" icon={TrendingUp} onClick={onGoTrading}>
            Manage trades
          </Btn>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white/[.02] border-b border-white/[.06]">
              <tr>
                <Th>Asset</Th>
                <Th>Side</Th>
                <Th>Amount</Th>
                <Th>Entry</Th>
                <Th>Mark</Th>
                <Th>Leverage</Th>
                <Th>PnL</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[.05]">
              {trades.length === 0 && (
                <tr>
                  <Td className="text-slate-600 py-8 text-center">No positions</Td>
                </tr>
              )}
              {trades.map(t => (
                <tr key={t.id} className="hover:bg-white/[.02]">
                  <Td className="font-semibold text-white">{t.asset}</Td>
                  <Td>
                    <Badge tone={t.type === 'SHORT' ? 'red' : t.type === 'LONG' ? 'green' : 'gray'}>{t.type}</Badge>
                  </Td>
                  <Td>${t.amount.toLocaleString('en-US')}</Td>
                  <Td>{t.entryPrice.toLocaleString('en-US')}</Td>
                  <Td>{t.currentPrice.toLocaleString('en-US')}</Td>
                  <Td>{t.leverage}x</Td>
                  <Td className={t.pnl >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    {t.pnl >= 0 ? '+' : ''}${t.pnl.toLocaleString('en-US')}
                  </Td>
                  <Td>
                    <Badge tone={t.status === 'OPEN' ? 'gold' : 'gray'}>{t.status}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Action dialogs */}
      {dialog && (
        <Modal
          onClose={() => setDialog(null)}
          title={dialog === 'topup' ? 'Top up trading account' : dialog === 'bonus' ? 'Grant bonus' : 'Send message'}
          subtitle={shortName}
        >
          {dialog === 'message' ? (
            <>
              <textarea
                rows={5}
                autoFocus
                value={dialogText}
                onChange={e => setDialogText(e.target.value)}
                placeholder="Write a message to the client..."
                className="w-full px-3.5 py-2.5 bg-[#0f1116] border border-white/[.08] rounded-xl text-[13px] text-slate-100 resize-none focus:outline-none focus:border-[#f5b400]/50"
              />
              <div className="flex justify-end gap-2 pt-1">
                <Btn variant="ghost" onClick={() => setDialog(null)}>
                  Cancel
                </Btn>
                <Btn
                  variant="gold"
                  disabled={!dialogText.trim()}
                  onClick={() => {
                    onNotify(`Message sent to ${shortName}`);
                    setDialog(null);
                  }}
                >
                  Send
                </Btn>
              </div>
            </>
          ) : (
            <>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">Amount ($)</label>
              <Input
                autoFocus
                type="number"
                value={dialogAmount}
                onChange={e => setDialogAmount(e.target.value)}
                className="w-full text-lg font-extrabold"
              />
              <div className="flex gap-2 mt-2.5">
                {['100', '500', '1000', '5000'].map(v => (
                  <button
                    key={v}
                    onClick={() => setDialogAmount(v)}
                    className="px-2.5 py-1 bg-white/[.06] hover:bg-white/[.12] rounded-lg text-[11px] font-bold text-slate-300 cursor-pointer"
                  >
                    ${v}
                  </button>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <Btn variant="ghost" onClick={() => setDialog(null)}>
                  Cancel
                </Btn>
                <Btn
                  variant="gold"
                  disabled={!Number(dialogAmount)}
                  onClick={() => {
                    const add = Number(dialogAmount) || 0;
                    onUpdateBalance(user.id, user.balance + add);
                    setBalanceInput(String(user.balance + add));
                    onNotify(
                      dialog === 'topup'
                        ? `Account topped up by $${add.toLocaleString('en-US')}`
                        : `Bonus of $${add.toLocaleString('en-US')} granted`,
                    );
                    setDialog(null);
                  }}
                >
                  {dialog === 'topup' ? 'Top up' : 'Grant bonus'}
                </Btn>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
};

/* ============================================================
   CALLS PANEL — WebRTC demo: prompter, screen share, recording
   ============================================================ */
const CallsPanel: React.FC<{ investors: Investor[]; phonesHidden: boolean }> = ({ investors, phonesHidden }) => {
  const [active, setActive] = useState<Investor | null>(null);
  const [playingCall, setPlayingCall] = useState<string | null>(null);
  const [prompter, setPrompter] = useState(false);
  const [screen, setScreen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [callerName, setCallerName] = useState('Oak Haven Yield Support');

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [active]);

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={PhoneCall} label="Total calls" value="145" />
        <Kpi icon={CheckCircle} label="Answered" value="140" tone="green" />
        <Kpi icon={Ban} label="Missed" value="5" tone="red" />
        <Kpi icon={Clock} label="Avg. duration" value="1:24" tone="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Call management" subtitle="Start a call and control the conversation" className="lg:col-span-2">
          <div className="p-5 space-y-4">
            <div>
              <label className="text-[11px] font-bold uppercase text-slate-500">Caller name shown to the client</label>
              <Input value={callerName} onChange={e => setCallerName(e.target.value)} className="w-full mt-1.5" />
            </div>

            {active ? (
              <div className="bg-[#1b1e26] border border-white/[.06] rounded-2xl p-5">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                    <PhoneCall className="w-6 h-6 text-emerald-400 animate-pulse" />
                  </div>
                  <div>
                    <div className="text-[15px] font-bold text-white">{active.name}</div>
                    <div className="text-[12px] text-slate-500 font-mono">
                      {phonesHidden ? maskPhone(active.phone) : active.phone}
                    </div>
                    <div className="text-[12px] text-emerald-400 font-mono mt-0.5">{mmss} · in progress</div>
                  </div>
                  <div className="ml-auto flex gap-2">
                    <Btn variant={prompter ? 'gold' : 'ghost'} icon={Mic} onClick={() => setPrompter(v => !v)}>
                      Prompter
                    </Btn>
                    <Btn variant={screen ? 'gold' : 'ghost'} icon={MonitorPlay} onClick={() => setScreen(v => !v)}>
                      Screen
                    </Btn>
                    <Btn variant={recording ? 'danger' : 'ghost'} icon={Radio} onClick={() => setRecording(v => !v)}>
                      {recording ? 'Recording' : 'Record'}
                    </Btn>
                    <Btn
                      variant="danger"
                      onClick={() => {
                        setActive(null);
                        setSeconds(0);
                        setPrompter(false);
                        setScreen(false);
                        setRecording(false);
                      }}
                    >
                      End
                    </Btn>
                  </div>
                </div>
                {prompter && (
                  <div className="mt-4 bg-[#f5b400]/10 border border-[#f5b400]/25 rounded-xl p-3.5 text-[12px] text-[#f9d571]">
                    <strong>Prompter mode:</strong> the supervisor hears the manager and can whisper — the client does not hear it.
                  </div>
                )}
                {screen && (
                  <div className="mt-3 bg-[#0f1116] border border-white/[.08] rounded-xl h-40 flex items-center justify-center text-[12px] text-slate-600">
                    <MonitorPlay className="w-5 h-5 mr-2" /> Screen sharing is active (getDisplayMedia)
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[#1b1e26] border border-dashed border-white/[.1] rounded-2xl p-8 text-center text-[12px] text-slate-600">
                No active calls. Pick a client on the right to start.
              </div>
            )}
          </div>
        </Card>

        <Card title="Clients" subtitle="Click to call">
          <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
            {investors.map(inv => (
              <button
                key={inv.id}
                onClick={() => {
                  setActive(inv);
                  setSeconds(0);
                }}
                className="w-full flex items-center gap-3 bg-[#1b1e26] border border-white/[.06] rounded-xl p-3 hover:border-[#f5b400]/40 transition-colors cursor-pointer text-left"
              >
                <Avatar name={inv.name} size={32} />
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-white truncate">{inv.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono">{phonesHidden ? maskPhone(inv.phone) : inv.phone}</div>
                </div>
                <PhoneCall className="w-4 h-4 text-[#f5b400] ml-auto shrink-0" />
              </button>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Call history" subtitle="Records available for quality control">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white/[.02] border-b border-white/[.06]">
              <tr>
                <Th>Client</Th>
                <Th>Direction</Th>
                <Th>Date</Th>
                <Th>Duration</Th>
                <Th>Status</Th>
                <Th className="text-right">Record</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[.05]">
              {investors.slice(0, 5).map((inv, i) => (
                <tr key={inv.id} className="hover:bg-white/[.02]">
                  <Td className="font-semibold text-white">{inv.name}</Td>
                  <Td>
                    <Badge tone={i % 2 ? 'blue' : 'gold'}>{i % 2 ? 'incoming' : 'outgoing'}</Badge>
                  </Td>
                  <Td className="text-[12px]">2026-08-{10 + i} 14:2{i}</Td>
                  <Td className="font-mono text-[12px]">0{i + 1}:1{i}</Td>
                  <Td>
                    <Badge tone={i === 3 ? 'red' : 'green'}>{i === 3 ? 'missed' : 'answered'}</Badge>
                  </Td>
                  <Td className="text-right">
                    <Btn
                      size="sm"
                      variant="ghost"
                      icon={PlayCircle}
                      onClick={() => setPlayingCall(playingCall === inv.id ? null : inv.id)}
                    >
                      {playingCall === inv.id ? 'Playing…' : 'Play'}
                    </Btn>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

/* ===== Requests table (deposits / withdrawals) ===== */
function RequestsTable({
  title,
  requests,
  onApprove,
  onReject,
}: {
  title: string;
  requests: TransactionRequest[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <Card title={title} subtitle="Approve or reject client requests">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-white/[.02] border-b border-white/[.06]">
            <tr>
              <Th>ID / Date</Th>
              <Th>Client</Th>
              <Th>Amount</Th>
              <Th>Method</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[.05]">
            {requests.length === 0 && (
              <tr>
                <Td className="py-10 text-center text-slate-600">No requests</Td>
              </tr>
            )}
            {requests.map(req => (
              <tr key={req.id} className="hover:bg-white/[.02]">
                <Td className="font-mono text-[11px] text-slate-500">
                  #{req.id}
                  <div className="text-[10px] text-slate-600">{req.date}</div>
                </Td>
                <Td className="font-semibold text-white">{req.investorName}</Td>
                <Td className="font-extrabold text-white">${req.amount.toLocaleString('en-US')}</Td>
                <Td className="text-[12px]">{req.method}</Td>
                <Td>
                  <Badge tone={req.status === 'approved' ? 'green' : req.status === 'rejected' ? 'red' : 'gold'}>
                    {req.status}
                  </Badge>
                </Td>
                <Td className="text-right">
                  {req.status === 'pending' ? (
                    <div className="flex items-center justify-end gap-2">
                      <Btn size="sm" variant="success" onClick={() => onApprove(req.id)}>
                        Approve
                      </Btn>
                      <Btn size="sm" variant="danger" onClick={() => onReject(req.id)}>
                        Reject
                      </Btn>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-600">Processed</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ===== Dark modal shell ===== */
const Modal: React.FC<{ onClose: () => void; title: string; subtitle?: string; children: React.ReactNode }> = ({
  onClose,
  title,
  subtitle,
  children,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
    <div className="bg-[#14161c] border border-white/[.08] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-[16px] font-bold text-white">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-white/[.06] hover:bg-white/[.12] text-slate-400 flex items-center justify-center cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {children}
    </div>
  </div>
);
