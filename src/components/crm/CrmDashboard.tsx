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
import type { ApiKycDoc, ApiNotification, ApiCall, ApiAnalytics, ApiManagerStat } from '../../api';
import { apiPushSend, apiAnalytics, apiManagerStats, apiCallLog, apiCallInbox, apiCallRecording, fetchKycFile, apiMailAudience, apiSendMailing, apiDepositWallets, apiSaveDepositWallets, apiClientWallets, apiSaveClientWallets, apiMarginRates, apiSaveMarginRates, apiResetUserPortfolio, apiSupportConversations, apiSupportMessages, apiSendSupportMessage, apiSupportRead, apiUserActivity } from '../../api';
import type { ApiActivityEntry, ApiSupportConversation, ApiSupportMessage } from '../../api';
import type { ApiUser } from '../../api';
import { sanitizeDecimal } from '../../utils/number';
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  Ban,
  ArrowDownToLine,
  PhoneCall,
  Ear,
  Settings,
  LogOut,
  Kanban,
  Plus,
  CheckCircle,
  CheckCircle2,
  UserPlus,
  ArrowRight,
  ArrowLeft,
  Search,
  MessageSquare,
  KeyRound,
  EyeOff,
  Loader2,
  X,
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
import { CrmTradesManager } from './CrmTradesManager';
import type { AdminTrade } from './CrmTradesManager';
import { OakCrest, OakWordmark } from '../brand/Logo';
import { Card, Btn, Badge, Field, Input, Select, Kpi, Th, Td, Avatar } from './ui';
import { ImportLeadsModal } from '../modals/ImportLeadsModal';
import { CreateClientModal } from '../modals/CreateClientModal';
import { StatementModal } from '../modals/StatementModal';
import { Upload, Menu } from 'lucide-react';

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
  /** Start a WebRTC call with a client */
  onPlaceCall?: (client: ApiUser, callerName: string) => void;
  /** Join a live call as a supervisor (whisper mode) */
  onWhisper?: (call: ApiCall) => void;
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
  onToggleSetting: (key: keyof CrmSettings) => void;
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
  onPlaceCall,
  onWhisper,
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
  onToggleSetting,
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

  // Mobile (< lg): the sidebar becomes a slide-in drawer over the content
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => setNavOpen(false), [activeTab]);
  const [openGroup, setOpenGroup] = useState<string | null>('Users');
  const [searchInvestor, setSearchInvestor] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>(investors[0]?.id ?? '');

  // Lead import and client creation modals
  const [isCreateClientOpen, setIsCreateClientOpen] = useState(false);
  const [isImportLeadsOpen, setIsImportLeadsOpen] = useState(false);
  const [statementModalUser, setStatementModalUser] = useState<{ id: number; name: string } | null>(null);

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

  // Settings toggles live on the SERVER (crmSettings) — shared between all
  // staff members and persistent across restarts. Nothing local anymore.
  /** which client the Trading tab should open with (deep links) */
  const [tradingFocusId, setTradingFocusId] = useState<string | null>(null);
  const [modules, setModules] = useState<Record<string, boolean>>({
    Spot: true, Futures: true, P2P: true, Binary: true, Staking: true,
    'AI Trading': false, Swap: false, 'Copy trading': false,
  });
  const [providers, setProviders] = useState<Record<string, boolean>>({
    'USDT TRC-20': true, 'Visa / Mastercard': true, 'SEPA transfer': false,
    Bitcoin: true, PayPal: false, 'ACH transfer': true,
  });

  // Support — real chat (TradeNation-style)
  const [supportConvs, setSupportConvs] = useState<ApiSupportConversation[]>([]);
  const [supportSearch, setSupportSearch] = useState('');
  const [supportActiveClientId, setSupportActiveClientId] = useState<number | null>(null);
  const [supportMsgs, setSupportMsgs] = useState<ApiSupportMessage[]>([]);
  const [supportChatText, setSupportChatText] = useState('');

  // poll conversations while Support tab is open
  useEffect(() => {
    if (activeTab !== 'support') return;
    let alive = true;
    const pull = async () => {
      try {
        const r = await apiSupportConversations();
        if (!alive) return;
        setSupportConvs(r.conversations);
      } catch { /* ignore */ }
    };
    pull();
    const t = setInterval(pull, 3000);
    return () => { alive = false; clearInterval(t); };
  }, [activeTab]);

  // poll active chat messages + mark read
  useEffect(() => {
    if (activeTab !== 'support' || supportActiveClientId == null) return;
    let alive = true;
    const pull = async () => {
      try {
        const r = await apiSupportMessages(supportActiveClientId);
        if (!alive) return;
        setSupportMsgs(r.messages);
        apiSupportRead(supportActiveClientId).catch(() => undefined);
      } catch { /* ignore */ }
    };
    pull();
    const t = setInterval(pull, 3000);
    return () => { alive = false; clearInterval(t); };
  }, [activeTab, supportActiveClientId]);

  // when active chat changes, mark read immediately
  useEffect(() => {
    if (activeTab === 'support' && supportActiveClientId != null) {
      apiSupportRead(supportActiveClientId).catch(() => undefined);
    }
  }, [activeTab, supportActiveClientId]);

  // Happy letter
  const [letterSubject, setLetterSubject] = useState('Your weekly trading report is ready');
  const [letterBody, setLetterBody] = useState(
    'Dear client,\n\nYour account statement for the current period is now available in your personal cabinet.\n\nBest regards,\nOak Haven Yield',
  );
  const [letterAudience, setLetterAudience] = useState('All clients');
  const [sendingLetter, setSendingLetter] = useState(false);
  const [walletDraft, setWalletDraft] = useState<Record<string, string>>({ BTC: '', ETH: '', USDC: '' });
  const [marginDraft, setMarginDraft] = useState<Record<string, number>>({});
  const [savingMargin, setSavingMargin] = useState(false);

  useEffect(() => {
    if (activeTab !== 'settings') return;
    apiMarginRates()
      .then(r => setMarginDraft(r.rates))
      .catch(() => undefined);
  }, [activeTab]);
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
   * The client list comes from the database only — real accounts with the
   * balances the back office actually credited and the positions they hold.
   * Sample records were removed so nothing on this screen is invented.
   */
  const allClients: Investor[] = React.useMemo(() => {
    const kycByUser = new Map<number, string>();
    for (const d of kycDocuments) {
      // "verified" requires all three documents approved
      const current = kycByUser.get(d.userId);
      if (d.status === 'rejected') kycByUser.set(d.userId, 'rejected');
      else if (d.status === 'pending' && current !== 'rejected') kycByUser.set(d.userId, 'pending');
      else if (!current) kycByUser.set(d.userId, 'approved');
    }

    return users
      .filter(u => u.role === 'CLIENT')
      .map(u => {
        const mine = trades.filter(t => t.investorId === `acc-${u.id}` || t.investorId === String(u.id));
        const invested = mine
          .filter(t => t.status === 'OPEN')
          .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const profit = mine.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0);

        const approvedCount = kycDocuments.filter(
          d => d.userId === u.id && d.status === 'approved',
        ).length;

        return {
          id: `acc-${u.id}`,
          name: u.name,
          email: u.email,
          phone: (u as ApiUser & { phone?: string }).phone || '—',
          kycStatus: approvedCount >= 3
            ? 'verified'
            : kycByUser.get(u.id) === 'rejected'
            ? 'rejected'
            : kycDocuments.some(d => d.userId === u.id)
            ? 'pending'
            : 'none',
          balance: Number((u as ApiUser & { balance?: number }).balance) || 0,
          invested,
          totalProfit: profit,
          registrationDate: (u.created_at || '').slice(0, 10),
          manager: clientStatuses[`acc-${u.id}`] ? '' : 'Unassigned',
        } as Investor;
      });
  }, [users, trades, kycDocuments, clientStatuses]);

  /**
   * Two id formats circulate: `acc-<userId>` (this component's own
   * allClients list) and the plain `<userId>` used by the investors
   * coming from App. Accept both so "Manage/Open" works from anywhere.
   */
  const selectedUser =
    allClients.find(i => i.id === selectedUserId || i.id === `acc-${selectedUserId}`) || allClients[0];

  const filteredInvestors = allClients.filter(
    inv =>
      inv.name.toLowerCase().includes(searchInvestor.toLowerCase()) ||
      inv.email.toLowerCase().includes(searchInvestor.toLowerCase()) ||
      inv.phone.includes(searchInvestor),
  );

  const pendingRequestsCount = requests.filter(r => r.status === 'pending').length;
  const totalAum = investors.reduce((s, i) => s + i.balance + i.invested, 0);
  const openTrades = trades.filter(t => t.status === 'OPEN').length;

  const openUser = (id: string) => {
    setSelectedUserId(id);
    setActiveTab('user-details');
  };

  /**
   * Clicking a notification opens the screen the event belongs to —
   * a support alert opens the chat (of that client, when known),
   * a money request opens the money queue, a lead alert the pipeline, etc.
   */
  const handleNotificationNav = (n: ApiNotification) => {
    switch (n.link) {
      case 'leads':
        setActiveTab('leads');
        break;
      case 'support':
        setActiveTab('support');
        if (n.userId) setSupportActiveClientId(n.userId);
        break;
      case 'trading':
        if (n.userId) setTradingFocusId(String(n.userId));
        setActiveTab('trading');
        break;
      case 'transactions':
        setActiveTab(n.kind && n.kind.includes('deposit') ? 'deposits' : 'withdrawals');
        break;
      case 'user-details':
        if (n.userId) openUser(String(n.userId));
        else setActiveTab('users');
        break;
      default:
        break;
    }
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
    <div className="flex min-h-screen bg-[#F5F2E9] text-[#213532]">
      {/* ==================== SIDEBAR ==================== */}
      {/* mobile backdrop */}
      {navOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#1C412C]/60 backdrop-blur-sm lg:hidden"
          onClick={() => setNavOpen(false)}
        />
      )}
      <aside className={`w-[248px] shrink-0 bg-[#1C412C] border-r border-[#1C412C] flex flex-col text-[#F5F2E9]
        fixed inset-y-0 left-0 z-50 h-screen overflow-y-auto transform transition-transform duration-200 ease-out
        ${navOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto lg:sticky lg:top-0 lg:h-screen lg:overflow-visible`}>
        {/* Logo — same brand lockup as the landing page and the client
            cabinet. The crest is green, so it must sit on the cream disc
            to stay visible against the dark-green sidebar. */}
        <div className="px-4 py-4 flex items-center gap-2.5 border-b border-white/10">
          <div className="w-10 h-10 rounded-full bg-[#F5F2E9] flex items-center justify-center shadow-sm shrink-0">
            <OakCrest size={22} />
          </div>
            <div className="leading-tight">
              <OakWordmark tone="light" />
              <div className="text-[9px] font-bold text-[#B08B48] tracking-widest mt-0.5">{roleLabel}</div>
            </div>
            {/* close drawer — mobile only */}
            <button
              onClick={() => setNavOpen(false)}
              className="ml-auto lg:hidden w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
        </div>

        {/* Profile */}
        <div className="px-4 py-4 flex items-center gap-3 border-b border-white/10">
          <Avatar name={displayName} size={38} />
          <div className="leading-tight min-w-0">
            <div className="text-[13px] font-bold text-[#F5F2E9] truncate">{displayName}</div>
            <div className="text-[9px] font-bold text-[#F5F2E9]/60 tracking-widest">{roleLabel}</div>
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
                    isActive ? 'bg-[#B08B48] text-white font-bold shadow-sm' : 'text-[#F5F2E9]/75 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.id === 'withdrawals' && pendingRequestsCount > 0 && (
                    <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-bold">
                      {pendingRequestsCount}
                    </span>
                  )}
                  {item.id === 'leads' && (
                    <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-white/20 text-[#F5F2E9] font-bold">
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
                              ? 'bg-[#B08B48]/30 text-white font-semibold'
                              : 'text-[#F5F2E9]/60 hover:text-white hover:bg-white/5'
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
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-[#F5F2E9]/60 hover:text-rose-300 hover:bg-white/5 transition-colors cursor-pointer mt-2"
          >
            <LogOut className="w-4 h-4" /> Log out
          </button>
        </nav>
      </aside>

      {/* ==================== MAIN ==================== */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="h-16 shrink-0 border-b border-[#E4DECB] bg-white/90 backdrop-blur sticky top-0 z-30 flex items-center justify-between px-5 shadow-sm">
          <div className="flex items-center gap-2 text-[11px] text-[#213532]/70">
            {/* burger — opens the drawer on phones */}
            <button
              onClick={() => setNavOpen(true)}
              className="lg:hidden w-9 h-9 rounded-full bg-[#1C412C]/[.06] border border-[#E4DECB] flex items-center justify-center text-[#213532] hover:bg-[#1C412C]/[.12] cursor-pointer"
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className="hover:text-[#1C412C] font-medium cursor-pointer"
            >
              Home
            </button>
            <ChevronRight className="w-3 h-3" />
            <span className="px-2 py-1 rounded-lg bg-[#1C412C]/[.06] text-[#1C412C] font-semibold">{header.title}</span>
          </div>
          <div className="flex items-center gap-2.5">
            {/* Notifications */}
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => { setBellOpen(v => !v); setProfileOpen(false); }}
                className="w-9 h-9 rounded-full bg-[#1C412C]/[.06] border border-[#E4DECB] flex items-center justify-center text-[#213532]/70 hover:text-[#1C412C] hover:bg-[#1C412C]/[.12] cursor-pointer relative"
              >
                <Bell className="w-4 h-4" />
                {(unreadCount > 0 || pendingRequestsCount > 0) && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#B08B48] text-[9px] font-extrabold text-white flex items-center justify-center">
                    {unreadCount || pendingRequestsCount}
                  </span>
                )}
              </button>
              {bellOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-[#E4DECB] rounded-xl shadow-2xl py-2 z-50">
                  <div className="px-4 py-2 flex items-center justify-between border-b border-[#E4DECB]">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#213532]/60">
                      Notifications
                    </span>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => onMarkNotificationsRead()}
                        className="text-[10px] text-[#B08B48] font-bold hover:underline cursor-pointer"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-[#E4DECB]/60">
                    {/* live events from the server */}
                    {notifications.map(n => (
                      <button
                        key={n.id}
                        onClick={() => {
                          onMarkNotificationsRead(n.id);
                          handleNotificationNav(n);
                          setBellOpen(false);
                        }}
                        className={`w-full flex items-start gap-2.5 px-4 py-2.5 text-left cursor-pointer hover:bg-[#F2EEDF] ${
                          n.read ? 'opacity-60' : ''
                        }`}
                      >
                        <FileText className="w-4 h-4 text-[#B08B48] shrink-0 mt-0.5" />
                        <span className="min-w-0">
                          <span className="block text-[12.5px] text-[#1C412C] font-semibold">{n.title}</span>
                          <span className="block text-[11px] text-[#213532]/70">{n.message}</span>
                          <span className="block text-[10px] text-[#213532]/50 mt-0.5">
                            {new Date(n.createdAt).toLocaleString('en-US')}
                          </span>
                        </span>
                        {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-[#B08B48] shrink-0 mt-1.5" />}
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
                        className="w-full flex items-start gap-2.5 px-4 py-2.5 text-left text-[12.5px] text-[#213532] hover:bg-[#F2EEDF] cursor-pointer"
                      >
                        <n.icon className="w-4 h-4 text-[#213532]/50 shrink-0 mt-0.5" />
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
              className="w-9 h-9 rounded-full bg-[#1C412C]/[.06] border border-[#E4DECB] flex items-center justify-center text-[#213532]/70 hover:text-[#1C412C] hover:bg-[#1C412C]/[.12] cursor-pointer"
            >
              <Phone className="w-4 h-4" />
            </button>

            {/* Profile menu */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => { setProfileOpen(v => !v); setBellOpen(false); }}
                className="flex items-center gap-2.5 pl-2.5 pr-3 py-1.5 rounded-full bg-[#1C412C]/[.06] border border-[#E4DECB] hover:bg-[#1C412C]/[.12] cursor-pointer transition-colors"
              >
                <Avatar name={displayName} size={28} />
                <div className="leading-tight hidden sm:block text-left">
                  <div className="text-[12px] font-bold text-[#1C412C]">{displayName}</div>
                  <div className="text-[9px] font-bold text-[#B08B48] tracking-wider">{roleLabel}</div>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-[#213532]/60 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-[#E4DECB] rounded-xl shadow-2xl py-1.5 z-50">
                  <div className="px-4 py-2 border-b border-[#E4DECB]">
                    <div className="text-[13px] font-bold text-[#1C412C]">{displayName}</div>
                    <div className="text-[11px] text-[#213532]/70">{roleLabel}</div>
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
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-[12.5px] text-[#213532] hover:bg-[#F2EEDF] cursor-pointer"
                    >
                      <i.icon className="w-4 h-4 text-[#B08B48]" /> {i.label}
                    </button>
                  ))}
                  <button
                    onClick={() => { setProfileOpen(false); onLogout(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-[12.5px] text-rose-600 hover:bg-rose-50 cursor-pointer border-t border-[#E4DECB] mt-1"
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
                <h1 className="text-2xl font-extrabold text-[#1C412C] font-serif tracking-tight">{header.title}</h1>
                <p className="text-[12px] text-[#213532]/70 mt-0.5">{header.sub}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Btn variant="gold" icon={UserPlus} onClick={() => setIsCreateClientOpen(true)}>
                  Create client
                </Btn>
                <Btn variant="ghost" icon={Upload} onClick={() => setIsImportLeadsOpen(true)}>
                  Import leads
                </Btn>
                <Btn variant="ghost" icon={Plus} onClick={onOpenNewLeadModal}>
                  Add lead
                </Btn>
                <Btn variant="ghost" icon={Plus} onClick={onOpenNewProjectModal}>
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
                    <div className="text-3xl font-extrabold text-[#B08B48]">0</div>
                    <p className="text-[11px] text-[#213532]/70 mt-1">No unanswered messages</p>
                  </div>
                </Card>
                <Card title="Withdrawals" subtitle="Pending processing">
                  <div className="p-5">
                    <div className="text-3xl font-extrabold text-[#1C412C]">{pendingRequestsCount}</div>
                    <p className="text-[11px] text-[#213532]/70 mt-1">requests in queue</p>
                    <Btn size="sm" variant="ghost" className="mt-3" onClick={() => setActiveTab('withdrawals')}>
                      Open
                    </Btn>
                  </div>
                </Card>
                <Card title="Deposits" subtitle="Total volume">
                  <div className="p-5">
                    <div className="text-2xl font-extrabold text-emerald-700">${totalAum.toLocaleString('en-US')}</div>
                    <p className="text-[11px] text-[#213532]/70 mt-1">{requests.filter(r => r.type === 'deposit').length} deposits</p>
                  </div>
                </Card>
                <Card title="Quick registration" subtitle="Create a client account">
                  <div className="p-5 space-y-2">
                    <Btn variant="gold" size="sm" icon={UserPlus} onClick={() => setIsCreateClientOpen(true)}>
                      Create client
                    </Btn>
                    <p className="text-[11px] text-[#213532]/70">Automatic account creation with active access</p>
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
                    <div className="text-[11px] text-[#213532]/70 font-semibold uppercase tracking-wide">{m.t}</div>
                    <div className="text-2xl font-extrabold text-[#1C412C] mt-1.5">{m.v}</div>
                    <div className="text-[11px] text-[#213532]/60">{m.s}</div>
                  </Card>
                ))}
              </div>

              {/* Users quick list */}
              <Card title="Detailed user info" subtitle="Client base · CRM">
                <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {investors.slice(0, 4).map(inv => (
                    <div key={inv.id} className="bg-[#F5F2E9] border border-[#E4DECB] rounded-2xl p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar name={inv.name} size={42} />
                          <div className="min-w-0">
                            <div className="font-bold text-[#1C412C] text-[14px] truncate">{inv.name}</div>
                            <div className="text-[11px] text-[#213532]/70 truncate">{inv.email}</div>
                            <div className="text-[11px] text-[#213532]/60 font-mono">{phonesHidden ? maskPhone(inv.phone) : inv.phone}</div>
                          </div>
                        </div>
                        <Badge tone={inv.kycStatus === 'verified' ? 'green' : inv.kycStatus === 'pending' ? 'gold' : 'red'}>
                          {inv.kycStatus}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-4">
                        <div className="bg-white rounded-xl p-2.5 border border-[#E4DECB]">
                          <div className="text-[10px] text-[#213532]/60 font-medium">Balance</div>
                          <div className="text-[13px] font-extrabold text-[#1C412C]">${inv.balance.toLocaleString('en-US')}</div>
                        </div>
                        <div className="bg-white rounded-xl p-2.5 border border-[#E4DECB]">
                          <div className="text-[10px] text-[#213532]/60 font-medium">Invested</div>
                          <div className="text-[13px] font-extrabold text-[#1C412C]">${inv.invested.toLocaleString('en-US')}</div>
                        </div>
                        <div className="bg-white rounded-xl p-2.5 border border-[#E4DECB]">
                          <div className="text-[10px] text-[#213532]/60 font-medium">Profit</div>
                          <div className="text-[13px] font-extrabold text-emerald-700">+${inv.totalProfit.toLocaleString('en-US')}</div>
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
              focusInvestorId={tradingFocusId}
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
                <div className="flex flex-wrap items-center gap-3">
                  <Btn variant="gold" size="sm" icon={UserPlus} onClick={() => setIsCreateClientOpen(true)}>
                    Create client
                  </Btn>
                  <div className="relative w-64">
                    <Search className="w-4 h-4 text-[#213532]/40 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      placeholder="Search by name, e-mail, phone..."
                      value={searchInvestor}
                      onChange={e => setSearchInvestor(e.target.value)}
                      className="w-full pl-9"
                    />
                  </div>
                </div>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#F5F2E9] border-b border-[#E4DECB]">
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
                  <tbody className="divide-y divide-[#E4DECB]">
                    {filteredInvestors.map(inv => (
                      <tr key={inv.id} className="hover:bg-[#F2EEDF]/50 transition-colors">
                        <Td>
                          <button onClick={() => openUser(inv.id)} className="flex items-center gap-3 cursor-pointer text-left">
                            <Avatar name={inv.name} size={34} />
                            <div>
                              <div className="font-semibold text-[#1C412C]">{inv.name}</div>
                              <div className="text-[11px] text-[#213532]/60">{inv.email}</div>
                            </div>
                          </button>
                        </Td>
                        <Td className="font-mono text-[12px] text-[#213532]">{phonesHidden ? maskPhone(inv.phone) : inv.phone}</Td>
                        <Td className="font-bold text-[#1C412C]">${inv.balance.toLocaleString('en-US')}</Td>
                        <Td className="text-[#213532]">${inv.invested.toLocaleString('en-US')}</Td>
                        <Td className="text-[12px] text-[#213532]/70">{inv.manager}</Td>
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
              <div className="border-t border-[#E4DECB] p-5">
                <h4 className="text-[13px] font-semibold text-[#1C412C] mb-3">Platform accounts ({users.length})</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[#F5F2E9]">
                      <tr>
                        <Th>Name</Th>
                        <Th>E-mail</Th>
                        <Th>Role</Th>
                        <Th>Status</Th>
                        <Th className="text-right">Actions</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4DECB]">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-[#F2EEDF]/50">
                          <Td className="font-semibold text-[#1C412C]">{u.name}</Td>
                          <Td className="text-[12px] text-[#213532]">{u.email}</Td>
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
                                  <Loader2 className="w-4 h-4 animate-spin text-[#213532]/50" />
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
              trades={trades.filter(
                t =>
                  t.investorId === selectedUser.id ||
                  t.investorId === selectedUser.id.replace(/^acc-/, ''),
              )}
              phonesHidden={phonesHidden}
              onBack={() => setActiveTab('users')}
              onGoTrading={() => { setTradingFocusId(selectedUser.id); setActiveTab('trading'); }}
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
              onOpenStatementModal={(id, name) => setStatementModalUser({ id, name })}
            />
          )}

          {/* ===================== BLOCKED ===================== */}
          {activeTab === 'blocked' && (
            <Card title="Blocked users" subtitle="Accounts that cannot sign in">
              <div className="p-5 space-y-2">
                {users.filter(u => u.status === 'blocked').length === 0 && (
                  <div className="text-center text-[12px] text-[#213532]/60 py-10">No blocked users</div>
                )}
                {users
                  .filter(u => u.status === 'blocked')
                  .map(u => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between bg-[#F5F2E9] border border-[#E4DECB] rounded-xl px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} size={34} />
                        <div>
                          <div className="text-[13px] font-semibold text-[#1C412C]">{u.name}</div>
                          <div className="text-[11px] text-[#213532]/70">{u.email}</div>
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
                  <label className="text-[11px] font-bold uppercase text-[#213532]/70">Recipients</label>
                  <Select className="w-full mt-1.5" value={letterAudience} onChange={e => setLetterAudience(e.target.value)}>
                    <option>All clients</option>
                    <option>Active only</option>
                    <option>No deposit</option>
                  </Select>
                  <div className="text-[11px] text-[#213532]/60 mt-1">
                    {letterAudience === 'Active only'
                      ? mailAudience.active
                      : letterAudience === 'No deposit'
                      ? mailAudience.noDeposit
                      : mailAudience.all}{' '}
                    recipient(s) selected
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-[#213532]/70">Subject</label>
                  <Input className="w-full mt-1.5" value={letterSubject} onChange={e => setLetterSubject(e.target.value)} />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-[#213532]/70">Message</label>
                  <textarea
                    rows={7}
                    value={letterBody}
                    onChange={e => setLetterBody(e.target.value)}
                    className="w-full mt-1.5 px-3.5 py-2.5 bg-white border border-[#E4DECB] rounded-xl text-[13px] text-[#213532] focus:outline-none focus:border-[#B08B48] focus:ring-2 focus:ring-[#B08B48]/20 resize-none"
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
                <p className="text-[11px] text-[#213532]/60">
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
                        ? 'bg-[#B08B48]/10 border-[#B08B48]/40 shadow-sm'
                        : 'bg-[#F5F2E9] border-[#E4DECB] hover:bg-[#F2EEDF]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-[#1C412C] text-[13px]">{b.n}</div>
                      <Badge tone={providers[b.n] ? 'green' : 'gray'}>{providers[b.n] ? 'active' : 'off'}</Badge>
                    </div>
                    <div className="text-[11px] text-[#213532]/70 mt-1">{b.s}</div>
                    <div className="text-[10px] text-[#213532]/60 mt-2">Click to {providers[b.n] ? 'disable' : 'enable'}</div>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* ===================== LEADS ===================== */}
          {activeTab === 'leads' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E4DECB] shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#1C412C]">Sales Pipeline</span>
                  <Badge tone="gray">{leads.length} active leads</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Btn variant="ghost" size="sm" icon={Upload} onClick={() => setIsImportLeadsOpen(true)}>
                    Import CSV
                  </Btn>
                  <Btn variant="gold" size="sm" icon={Plus} onClick={onOpenNewLeadModal}>
                    Add Lead
                  </Btn>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {(
                  [
                    { id: 'new', title: 'NEW', tone: 'blue' },
                    { id: 'contact', title: 'CALLBACK', tone: 'gold' },
                    { id: 'kyc', title: 'DEP', tone: 'violet' },
                    { id: 'active', title: 'ACTIVE', tone: 'green' },
                  ] as { id: LeadStage; title: string; tone: 'blue' | 'gold' | 'violet' | 'green' }[]
                ).map(col => (
                  <div key={col.id} className="bg-[#F5F2E9] border border-[#E4DECB] rounded-2xl p-3 shadow-sm">
                    <div className="flex items-center justify-between px-1 pb-3">
                      <Badge tone={col.tone}>{col.title}</Badge>
                      <span className="text-[11px] text-[#213532]/60 font-semibold">{leads.filter(l => l.stage === col.id).length}</span>
                    </div>
                    <div className="space-y-2">
                      {leads
                        .filter(l => l.stage === col.id)
                        .map(lead => (
                          <div key={lead.id} className="bg-white border border-[#E4DECB] rounded-xl p-3 shadow-xs hover:border-[#B08B48]/50 transition-colors">
                            <div className="font-semibold text-[#1C412C] text-[13px]">{lead.name}</div>
                            <div className="text-[11px] text-[#213532]/70 font-mono">
                              {phonesHidden ? maskPhone(lead.phone) : lead.phone}
                            </div>
                            <div className="text-[12px] text-[#B08B48] font-bold mt-1">
                              ${lead.potentialAmount.toLocaleString('en-US')}
                            </div>
                            <div className="text-[10px] text-[#213532]/60 mt-1">{lead.manager}</div>
                            <div className="flex items-center gap-1.5 mt-2.5">
                              <button
                                onClick={() => onMoveLeadStage(lead.id, 'prev')}
                                className="p-1.5 rounded-lg bg-[#1C412C]/[.06] text-[#213532] hover:bg-[#1C412C]/[.12] cursor-pointer"
                              >
                                <ArrowLeft className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setCommentLead(lead)}
                                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-[#1C412C]/[.06] text-[#213532] text-[10px] font-bold hover:bg-[#1C412C]/[.12] cursor-pointer"
                              >
                                <MessageSquare className="w-3 h-3" /> {lead.comments.length}
                              </button>
                              <button
                                onClick={() => onMoveLeadStage(lead.id, 'next')}
                                className="p-1.5 rounded-lg bg-[#B08B48] text-white hover:bg-[#C59D55] cursor-pointer shadow-sm"
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
            </div>
          )}

          {/* ===================== SUPPORT — REAL CHAT (TradeNation reference) ===================== */}
          {activeTab === 'support' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card title="Support chats" className="lg:col-span-1">
                <div className="p-4 space-y-3">
                  <Input placeholder="Search by name, email, phone..." value={supportSearch} onChange={e => setSupportSearch(e.target.value)} className="w-full" />
                  {(() => {
                    const q = supportSearch.trim().toLowerCase();
                    const filtered = supportConvs.filter(c => {
                      if (!q) return true;
                      const u = users.find(x => x.id === c.clientId) as any;
                      const phone = u?.phone || '';
                      return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || String(phone).toLowerCase().includes(q);
                    });
                    if (filtered.length === 0) {
                      return <div className="text-center text-[12px] text-[#213532]/60 py-8">No conversations yet — chats appear when clients write to you.</div>;
                    }
                    return (
                      <div className="space-y-2">
                        {filtered.map(c => {
                          const isActive = supportActiveClientId === c.clientId;
                          const created = c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-US') : '—';
                          const lastRead = c.unreadForStaff > 0 ? 'Never' : (c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleDateString('en-US') : '—');
                          return (
                            <div key={c.clientId} className={`border rounded-xl p-3 ${isActive ? 'bg-[#B08B48]/15 border-[#B08B48]/40' : 'bg-[#F5F2E9] border-[#E4DECB]'}`}>
                              <div className="flex items-start gap-3">
                                <Avatar name={c.name} size={36} />
                                <div className="flex-1 min-w-0">
                                  <div className="text-[13px] font-bold text-[#1C412C] truncate">{c.name}</div>
                                  <div className={`text-[11px] font-bold ${c.online ? 'text-emerald-600' : 'text-rose-600'}`}>{c.online ? 'ONLINE' : 'OFFLINE'}</div>
                                  <div className="text-[11px] text-[#213532]/60 truncate">{c.email}</div>
                                  {c.lastPreview && <div className="text-[11px] text-[#213532]/50 truncate mt-0.5">{c.lastPreview}</div>}
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0 text-[10px] text-[#213532]/60">
                                  {c.unreadForStaff > 0 && <Badge tone="gold">{c.unreadForStaff}</Badge>}
                                  <span>Created: {created}</span>
                                  <span className={c.unreadForStaff > 0 ? 'text-rose-600 font-bold' : ''}>Last read: {lastRead}</span>
                                </div>
                              </div>
                              <Btn size="sm" variant="ghost" className="mt-2 w-full justify-center border border-[#B08B48] text-[#B08B48] hover:bg-[#B08B48]/10" onClick={() => setSupportActiveClientId(c.clientId)}>Open chat</Btn>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </Card>
              <Card title={supportActiveClientId != null ? (supportConvs.find(c => c.clientId === supportActiveClientId)?.name || `Chat #${supportActiveClientId}`) : 'Select a chat'} subtitle={supportActiveClientId != null ? 'Real conversation' : 'Choose a client on the left'} className="lg:col-span-2">
                {!supportActiveClientId ? (
                  <div className="p-10 text-center text-[12px] text-[#213532]/60">Select a chat on the left to view messages.</div>
                ) : (
                  <>
                    <div className="p-4 space-y-3 h-80 overflow-y-auto bg-white">
                      {supportMsgs.length === 0 && <div className="text-center text-[12px] text-[#213532]/60 py-8">No messages yet.</div>}
                      {supportMsgs.map(m => {
                        const isClient = m.from === 'client';
                        const time = new Date(m.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                        return (
                          <div key={m.id} className={`max-w-[70%] px-4 py-2.5 text-[13px] rounded-2xl ${isClient ? 'bg-[#F5F2E9] border border-[#E4DECB] text-[#213532] rounded-tl-sm' : 'ml-auto bg-[#1C412C] text-[#F5F2E9] rounded-tr-sm'}`}>
                            {m.text}
                            <div className={`text-[10px] mt-1 ${isClient ? 'text-[#213532]/60' : 'text-[#F5F2E9]/70'}`}>{m.senderName} · {time}</div>
                          </div>
                        );
                      })}
                    </div>
                    <form
                      onSubmit={async e => {
                        e.preventDefault();
                        if (!supportChatText.trim() || supportActiveClientId == null) return;
                        const text = supportChatText.trim();
                        setSupportChatText('');
                        try {
                          await apiSendSupportMessage({ clientId: supportActiveClientId, text });
                          const r = await apiSupportMessages(supportActiveClientId);
                          setSupportMsgs(r.messages);
                        } catch (err) {
                          onNotify(err instanceof Error ? err.message : 'Could not send message');
                          setSupportChatText(text);
                        }
                      }}
                      className="p-4 border-t border-[#E4DECB] flex gap-2 bg-[#F5F2E9]"
                    >
                      <Input className="flex-1" placeholder="Type a message..." value={supportChatText} onChange={e => setSupportChatText(e.target.value)} />
                      <Btn variant="gold" type="submit" disabled={!supportChatText.trim()}>Send</Btn>
                    </form>
                  </>
                )}
              </Card>
            </div>
          )}

          {/* ===================== CALLS ===================== */}
          {activeTab === 'calls' && (
            <CallsPanel
              investors={investors}
              phonesHidden={phonesHidden}
              users={users}
              onPlaceCall={(c, name) => onPlaceCall?.(c, name)}
              onWhisper={(c) => onWhisper?.(c)}
            />
          )}

          {/* ===================== ANALYTICS ===================== */}
          {activeTab === 'analytics' && <AnalyticsPanel onNotify={onNotify} />}

          {/* ===================== SETTINGS ===================== */}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card
                title="Deposit wallet addresses"
                subtitle="Shown to clients when they choose a crypto deposit"
                className="lg:col-span-2"
              >
                <div className="p-5 space-y-3 max-w-2xl">
                  <p className="text-[12px] text-[#213532]/70">
                    Clients see the address for the network they pick. Leave a field empty to hide
                    that option — they will be asked to contact their advisor instead.
                  </p>
                  {(['BTC', 'ETH', 'USDC'] as const).map(t => (
                    <div key={t}>
                      <label className="text-[11px] font-bold uppercase text-[#213532]/70">
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

              <Card
                title="Margin requirements"
                subtitle="Share of a position's value the client must post as margin"
                className="lg:col-span-2"
              >
                <div className="p-5 space-y-4">
                  <p className="text-[12px] text-[#213532]/70 max-w-2xl">
                    Lower percentage means higher leverage. 30% is roughly 3:1, 0.2% is 500:1.
                    Changes apply to positions opened from now on.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.keys(marginDraft).map(cat => (
                      <div key={cat}>
                        <label className="text-[11px] font-bold uppercase text-[#213532]/70">{cat}</label>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Input
                            type="text"
                            inputMode="decimal"
                            className="w-full"
                            value={marginDraft[cat]}
                            onChange={e => {
                              const val = sanitizeDecimal(e.target.value);
                              setMarginDraft(m => ({ ...m, [cat]: val === '' ? 0 : Number(val) }));
                            }}
                          />
                          <span className="text-[12px] text-[#213532]/70 shrink-0">
                            % · {marginDraft[cat] > 0 ? Math.round(100 / marginDraft[cat]) : '—'}:1
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Btn
                    variant="gold"
                    disabled={savingMargin}
                    onClick={async () => {
                      setSavingMargin(true);
                      try {
                        await apiSaveMarginRates(marginDraft);
                        onNotify('Margin requirements updated.');
                      } catch (err) {
                        onNotify(err instanceof Error ? err.message : 'Could not save the rates');
                      } finally {
                        setSavingMargin(false);
                      }
                    }}
                  >
                    {savingMargin ? 'Saving...' : 'Save margin rates'}
                  </Btn>
                </div>
              </Card>

              <Card title="Privacy & access" subtitle="Personal rules for agents">
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between bg-[#F5F2E9] border border-[#E4DECB] rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <EyeOff className="w-4 h-4 text-[#B08B48] mt-0.5" />
                      <div>
                        <div className="text-[13px] font-semibold text-[#1C412C]">Hide phone numbers from agents</div>
                        <div className="text-[11px] text-[#213532]/70 mt-0.5">
                          Admins always see full numbers, agents see the last 4 digits only
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => onToggleSetting('hidePhonesFromAgents')}
                      className={`w-12 h-6 rounded-full relative transition-colors cursor-pointer shrink-0 ${
                        settings.hidePhonesFromAgents ? 'bg-[#B08B48]' : 'bg-[#213532]/20'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all`}
                        style={{ left: settings.hidePhonesFromAgents ? 26 : 2 }}
                      />
                    </button>
                  </div>
                  {([
                    { key: 'duplicateControl' as const, t: 'Duplicate control (block repeated leads)', s: 'Every new contact is checked against the base' },
                    { key: 'manualClosing' as const, t: 'Allow manual position closing by clients', s: 'When off, only staff can close positions' },
                    { key: 'callRecording' as const, t: 'Enable call recording', s: 'Store call records for quality control' },
                  ]).map(r => (
                    <div key={r.key} className="flex items-center justify-between bg-[#F5F2E9] border border-[#E4DECB] rounded-xl p-4">
                      <div>
                        <div className="text-[13px] text-[#1C412C] font-semibold">{r.t}</div>
                        <div className="text-[11px] text-[#213532]/70 mt-0.5">{r.s}</div>
                      </div>
                      <button
                        onClick={() => onToggleSetting(r.key)}
                        className={`w-12 h-6 rounded-full relative transition-colors cursor-pointer shrink-0 ${
                          settings[r.key] ? 'bg-[#B08B48]' : 'bg-[#213532]/20'
                        }`}
                      >
                        <span
                          className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                          style={{ left: settings[r.key] ? 26 : 2 }}
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
                          ? 'bg-[#B08B48]/15 border-[#B08B48]/40'
                          : 'bg-[#F5F2E9] border-[#E4DECB] hover:bg-[#F2EEDF]'
                      }`}
                    >
                      <Circle
                        className={`w-2.5 h-2.5 ${modules[m] ? 'text-emerald-600 fill-emerald-600' : 'text-[#213532]/40 fill-[#213532]/40'}`}
                      />
                      <span className={`text-[13px] ${modules[m] ? 'text-[#1C412C] font-semibold' : 'text-[#213532]/70'}`}>{m}</span>
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
              <div className="text-center text-[12px] text-[#213532]/60 py-6">No comments yet</div>
            )}
            {commentLead.comments.map(c => (
              <div key={c.id} className="bg-[#F5F2E9] border border-[#E4DECB] rounded-xl p-3">
                <div className="text-[13px] text-[#213532]">{c.text}</div>
                <div className="text-[10px] text-[#213532]/60 mt-1.5">
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
              className="flex-1 px-3.5 py-2.5 bg-white border border-[#E4DECB] rounded-xl text-[13px] text-[#213532] resize-none focus:outline-none focus:border-[#B08B48] focus:ring-2 focus:ring-[#B08B48]/20"
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
              <CheckCircle className="w-12 h-12 text-emerald-600" />
              <div className="text-[13px] text-[#213532]">Password changed. The user must sign in with the new password.</div>
              <Btn variant="gold" onClick={closePwdModal}>
                Done
              </Btn>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[11px] font-bold text-[#213532]/70 uppercase mb-1.5">New password (min 6)</label>
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
                <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-[12px] text-rose-700">{pwdError}</div>
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

      {/* ===== MODAL: Import Leads ===== */}
      <ImportLeadsModal
        isOpen={isImportLeadsOpen}
        onClose={() => setIsImportLeadsOpen(false)}
        managers={users.filter(u => u.role === 'MANAGER' || u.role === 'ADMIN').map(u => u.name).length ? users.filter(u => u.role === 'MANAGER' || u.role === 'ADMIN').map(u => u.name) : ['Laura Bennett (Senior Advisor)', 'Daniel Foster (Desk 2)', 'Oleg Vasilyev (Desk 3)']}
        onImportSuccess={(count) => {
          onNotify(`✔ Successfully imported ${count} leads into the pipeline.`);
        }}
      />

      {/* ===== MODAL: Create Client ===== */}
      <CreateClientModal
        isOpen={isCreateClientOpen}
        onClose={() => setIsCreateClientOpen(false)}
        managers={users.filter(u => u.role === 'MANAGER' || u.role === 'ADMIN').map(u => u.name).length ? users.filter(u => u.role === 'MANAGER' || u.role === 'ADMIN').map(u => u.name) : ['Laura Bennett (Senior Advisor)', 'Daniel Foster (Desk 2)', 'Oleg Vasilyev (Desk 3)']}
        onClientCreated={(newUser) => {
          onNotify(`✔ Client ${newUser.name} created successfully.`);
          setActiveTab('users');
        }}
      />

      {/* ===== MODAL: Statement Generator & Overrides ===== */}
      {statementModalUser && (
        <StatementModal
          isOpen={!!statementModalUser}
          userId={statementModalUser.id}
          userName={statementModalUser.name}
          onClose={() => setStatementModalUser(null)}
          onNotify={onNotify}
        />
      )}
    </div>
  );
};

/* ============================================================
   USER DETAILS
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
  onOpenStatementModal?: (userId: number, userName: string) => void;
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
  onOpenStatementModal,
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
  const [sendingMessage, setSendingMessage] = useState(false);

  // "View user logs" — the real audit trail, fetched from the server
  const [logsOpen, setLogsOpen] = useState(false);
  const [logEntries, setLogEntries] = useState<ApiActivityEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const openLogs = async () => {
    if (!account) return onNotify('This client does not have a platform account.');
    setLogsOpen(true);
    setLogsLoading(true);
    try {
      const r = await apiUserActivity(account.id);
      setLogEntries(r.entries);
    } catch {
      setLogEntries([]);
      onNotify('Could not load the activity log.');
    } finally {
      setLogsLoading(false);
    }
  };

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
      label: 'Statement (PDF / Edit)',
      onClick: () => {
        const id = account?.id || Number(user.id.replace(/\D/g, '')) || 1;
        onOpenStatementModal?.(id, shortName);
      },
    },
    {
      icon: FileText,
      label: 'View user logs',
      onClick: openLogs,
    },
    { icon: PhoneCall, label: 'Call', onClick: onGoCalls },
    { icon: History, label: 'Call history', onClick: onGoCalls },
    {
      icon: BellRing,
      label: 'Push notification',
      onClick: async () => {
        if (!account) return onNotify('This client does not have a platform account.');
        const text = window.prompt(`Push notification for ${shortName}:`);
        if (!text?.trim()) return;
        try {
          const r = await apiPushSend(account.id, 'Oak Haven Yield', text.trim());
          onNotify(r.message);
        } catch (err) {
          onNotify(err instanceof Error ? err.message : 'Could not send the notification');
        }
      },
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
        <button onClick={onBack} className="text-[11px] text-[#213532]/70 hover:text-[#1C412C] font-semibold cursor-pointer flex items-center gap-1 mb-2">
          <ArrowLeft className="w-3 h-3" /> Back to all users
        </button>
        <h1 className="text-2xl font-extrabold text-[#1C412C] font-serif tracking-tight">User details</h1>
        <p className="text-[12px] text-[#213532]/70 mt-0.5">Detailed information about the user</p>
      </div>

      {/* Header card with actions */}
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <Avatar name={user.name} size={72} />
          <div>
            <h2 className="text-xl font-extrabold text-[#1C412C]">{user.name.replace(' (You)', '')}</h2>
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

        {/* Action buttons */}
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
              <div className="absolute left-0 top-full mt-2 w-60 bg-white border border-[#E4DECB] rounded-xl shadow-2xl py-1.5 z-40">
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
                        item.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-[#213532] hover:bg-[#F2EEDF]'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0 text-[#B08B48]" />
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
                <label className="text-[11px] font-bold uppercase text-[#213532]/70">{t}</label>
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
                <span className="font-mono text-[#213532]/70">••••••••</span>
                {account && isAdmin ? (
                  <Btn size="sm" variant="ghost" icon={KeyRound} onClick={() => onChangePassword(account)}>
                    Change
                  </Btn>
                ) : (
                  <span className="text-[11px] text-[#213532]/60">
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
                <span className="text-emerald-700 font-extrabold">${user.balance.toLocaleString('en-US')}</span>
              </Field>
              <Field label="Invested">${user.invested.toLocaleString('en-US')}</Field>
              <Field label="Total profit">
                <span className="text-emerald-700">+${user.totalProfit.toLocaleString('en-US')}</span>
              </Field>
              <Field label="Open trades">{trades.filter(t => t.status === 'OPEN').length}</Field>
              <Field label="KYC status">
                <Badge tone={user.kycStatus === 'verified' ? 'green' : user.kycStatus === 'pending' ? 'gold' : 'red'}>
                  {user.kycStatus}
                </Badge>
              </Field>
            </div>
            <div className="p-5 pt-3 border-t border-[#E4DECB] space-y-2">
              <label className="text-[11px] font-bold uppercase text-[#213532]/70">Set balance manually</label>
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
              {isAdmin && account && (
                <Btn
                  variant="danger"
                  className="w-full justify-center"
                  onClick={async () => {
                    if (!confirm(`Reset portfolio for ${shortName}? This will delete all trades and investments and zero the balance.`)) return;
                    try {
                      const r = await apiResetUserPortfolio(account.id);
                      onNotify(`Portfolio reset: ${r.deletedTrades} trade(s), ${r.deletedInvestments} investment(s) removed. Balance is now $0.`);
                    } catch (err) {
                      onNotify(err instanceof Error ? err.message : 'Could not reset portfolio');
                    }
                  }}
                >
                  Reset portfolio (test data)
                </Btn>
              )}
            </div>
          </Card>

          <Card title="PDF statement" subtitle="Editable trading report">
            <div className="p-5 space-y-2">
              <p className="text-[12px] text-[#213532]/70">
                Adjust fields and download a ready statement for the client in one click.
              </p>
              <Btn
                variant="gold"
                size="sm"
                icon={Download}
                onClick={() => {
                  const id = account?.id || Number(user.id.replace(/\D/g, '')) || 1;
                  onOpenStatementModal?.(id, shortName);
                }}
              >
                Statement Editor & PDF
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
              <div key={type} className="bg-[#F5F2E9] border border-[#E4DECB] rounded-2xl p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-bold text-[#1C412C]">{KYC_DOC_LABELS[type]}</span>
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

                <div className="mt-3 h-32 rounded-xl bg-white border border-[#E4DECB] flex items-center justify-center overflow-hidden">
                  {doc ? (
                    kycPreviews[doc.id] ? (
                      <a href={kycPreviews[doc.id]} target="_blank" rel="noreferrer" className="w-full h-full" title="Open full size">
                        <img src={kycPreviews[doc.id]} alt={KYC_DOC_LABELS[type]} className="w-full h-full object-cover" />
                      </a>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-[#213532]/60">
                        <FileText className="w-6 h-6" />
                        <span className="text-[10px] px-2 text-center truncate max-w-full">{doc.fileName}</span>
                      </div>
                    )
                  ) : (
                    <span className="text-[11px] text-[#213532]/50">Waiting for the client</span>
                  )}
                </div>

                {doc && (
                  <>
                    <div className="text-[10px] text-[#213532]/60 mt-2">
                      Uploaded {new Date(doc.uploadedAt).toLocaleString('en-US')}
                    </div>
                    {doc.reviewedBy && (
                      <div className="text-[10px] text-[#213532]/60">
                        Reviewed by {doc.reviewedBy}
                      </div>
                    )}
                    {doc.rejectReason && (
                      <div className="mt-1.5 text-[11px] text-rose-700">{doc.rejectReason}</div>
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
                      <div className="mt-3 text-[11px] text-emerald-700 text-center py-1.5">Approved</div>
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
              <span className="text-[11px] text-[#213532]/70">Current:</span>
              <Badge tone={statusTone(status)}>{status}</Badge>
            </div>
            <p className="text-[11px] text-[#213532]/60 leading-relaxed">
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
                <div className="text-center text-[12px] text-[#213532]/60 py-6">
                  No notes yet — add the first daily update below.
                </div>
              )}
              {notes.map(n => (
                <div key={n.id} className="bg-[#F5F2E9] border border-[#E4DECB] rounded-xl p-3.5">
                  <div className="text-[13px] text-[#213532] whitespace-pre-wrap">{n.text}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] text-[#213532]/70 font-semibold">{n.author}</span>
                    <Badge tone={n.authorRole === 'ADMIN' ? 'gold' : 'blue'}>{n.authorRole}</Badge>
                    <span className="text-[10px] text-[#213532]/60">{new Date(n.createdAt).toLocaleString('en-US')}</span>
                    <span className="text-[10px] text-[#213532]/60 ml-auto flex items-center gap-1">
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
                className="w-full px-3.5 py-2.5 bg-white border border-[#E4DECB] rounded-xl text-[13px] text-[#213532] resize-none focus:outline-none focus:border-[#B08B48] focus:ring-2 focus:ring-[#B08B48]/20"
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] text-[#213532]/60">
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
            <Search className="w-4 h-4 text-[#213532]/70" />
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
            <div className="mt-3 text-[12px] text-[#213532]/70">
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
            <thead className="bg-[#F5F2E9] border-b border-[#E4DECB]">
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
            <tbody className="divide-y divide-[#E4DECB]">
              {trades.length === 0 && (
                <tr>
                  <Td className="text-[#213532]/60 py-8 text-center">No positions</Td>
                </tr>
              )}
              {trades.map(t => (
                <tr key={t.id} className="hover:bg-[#F2EEDF]/50">
                  <Td className="font-semibold text-[#1C412C]">{t.asset}</Td>
                  <Td>
                    <Badge tone={t.type === 'SHORT' ? 'red' : t.type === 'LONG' ? 'green' : 'gray'}>{t.type}</Badge>
                  </Td>
                  <Td className="font-bold text-[#1C412C]">${t.amount.toLocaleString('en-US')}</Td>
                  <Td className="text-[#213532]">{t.entryPrice.toLocaleString('en-US')}</Td>
                  <Td className="text-[#213532]">{t.currentPrice.toLocaleString('en-US')}</Td>
                  <Td className="text-[#213532]">{t.leverage}x</Td>
                  <Td className={t.pnl >= 0 ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
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
                className="w-full px-3.5 py-2.5 bg-white border border-[#E4DECB] rounded-xl text-[13px] text-[#213532] resize-none focus:outline-none focus:border-[#B08B48] focus:ring-2 focus:ring-[#B08B48]/20"
              />
              <div className="flex justify-end gap-2 pt-1">
                <Btn variant="ghost" onClick={() => setDialog(null)}>
                  Cancel
                </Btn>
                <Btn
                  variant="gold"
                  disabled={!dialogText.trim() || sendingMessage}
                  onClick={async () => {
                    if (!account) {
                      onNotify('This client does not have a platform account — create it first via «Create client».');
                      return;
                    }
                    setSendingMessage(true);
                    try {
                      // the message becomes part of the real support chat with this client
                      await apiSendSupportMessage({ clientId: account.id, text: dialogText.trim() });
                      onNotify(`Message sent to ${shortName}. It's in the support chat now.`);
                      setDialog(null);
                      setDialogText('');
                    } catch (err) {
                      onNotify(err instanceof Error ? err.message : 'Could not send the message');
                    } finally {
                      setSendingMessage(false);
                    }
                  }}
                >
                  {sendingMessage ? 'Sending…' : 'Send'}
                </Btn>
              </div>
            </>
          ) : (
            <>
              <label className="block text-[11px] font-bold uppercase text-[#213532]/70 mb-1.5">Amount ($)</label>
              <Input
                autoFocus
                type="text"
                inputMode="decimal"
                value={dialogAmount}
                onChange={e => setDialogAmount(sanitizeDecimal(e.target.value))}
                className="w-full text-lg font-extrabold"
              />
              <div className="flex gap-2 mt-2.5">
                {['100', '500', '1000', '5000'].map(v => (
                  <button
                    key={v}
                    onClick={() => setDialogAmount(v)}
                    className="px-2.5 py-1 bg-[#1C412C]/[.06] hover:bg-[#1C412C]/[.12] rounded-lg text-[11px] font-bold text-[#213532] cursor-pointer border border-[#E4DECB]"
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

      {/* ===== MODAL: audit trail ("View user logs") ===== */}
      {logsOpen && (
        <Modal
          onClose={() => setLogsOpen(false)}
          title="User activity log"
          subtitle={shortName}
        >
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {logsLoading && (
              <div className="text-center text-[12px] text-[#213532]/60 py-8">Loading…</div>
            )}
            {!logsLoading && logEntries.length === 0 && (
              <div className="text-center text-[12px] text-[#213532]/60 py-8">
                No activity recorded yet. Logins, balance and status changes will appear here.
              </div>
            )}
            {logEntries.map(e => (
              <div key={e.id} className="bg-[#F5F2E9] border border-[#E4DECB] rounded-xl p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12.5px] font-bold text-[#1C412C]">{e.action}</span>
                  <span className="text-[10px] text-[#213532]/50 shrink-0">
                    {new Date(e.createdAt).toLocaleString('en-US')}
                  </span>
                </div>
                <div className="text-[11px] text-[#213532]/70 mt-1">
                  {e.actorName} ({e.actorRole}){e.details ? ` · ${e.details}` : ''}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
};

/* ============================================================
   ANALYTICS — every figure is computed from the database
   ============================================================ */
const AnalyticsPanel: React.FC<{ onNotify: (m: string) => void }> = ({ onNotify }) => {
  const [data, setData] = useState<ApiAnalytics | null>(null);
  const [managers, setManagers] = useState<ApiManagerStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stop = false;
    const pull = async () => {
      try {
        const [a, m] = await Promise.all([apiAnalytics(), apiManagerStats()]);
        if (stop) return;
        setData(a);
        setManagers(m.managers);
      } catch (err) {
        if (!stop) onNotify(err instanceof Error ? err.message : 'Could not load analytics');
      } finally {
        if (!stop) setLoading(false);
      }
    };
    pull();
    const t = setInterval(pull, 20000);
    return () => { stop = true; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !data) {
    return (
      <Card title="Analytics">
        <div className="p-10 text-center text-[13px] text-[#213532]/60">Loading figures…</div>
      </Card>
    );
  }

  const money = (n: number) =>
    `$${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  const mins = (sec: number) =>
    `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  const maxDeposit = Math.max(...data.months.map(m => m.deposits), 1);

  const stageLabels: Record<string, string> = {
    new: 'New', contact: 'Contacted', kyc: 'KYC', active: 'Active',
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Kpi icon={Wallet} label="AUM" value={money(data.money.aum)} />
        <Kpi
          icon={TrendingUp}
          label="Net P/L"
          value={money(data.trading.netPnl)}
          tone={data.trading.netPnl >= 0 ? 'green' : 'red'}
        />
        <Kpi icon={Users} label="FTD" value={`${data.clients.ftd}%`} tone="blue"
             hint={`${data.clients.funded} of ${data.clients.total} funded`} />
        <Kpi icon={PhoneCall} label="Answer rate" value={`${data.calls.answerRate}%`} tone="gold"
             hint={`${data.calls.answered}/${data.calls.total} calls`} />
        <Kpi icon={BarChart3} label="Win rate" value={`${data.trading.winRate}%`}
             tone={data.trading.winRate >= 50 ? 'green' : 'red'}
             hint={`${data.trading.closed} closed`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Deposits" subtitle="Last six months" className="lg:col-span-2">
          <div className="p-5">
            {data.months.every(m => m.deposits === 0) ? (
              <div className="py-16 text-center text-[13px] text-[#213532]/60">
                No deposits recorded yet.
              </div>
            ) : (
              <div className="flex items-end gap-3 h-56">
                {data.months.map(m => (
                  <div key={m.key} className="flex-1 h-full flex flex-col items-center">
                    <div className="flex-1 w-full flex flex-col justify-end items-center gap-1.5">
                      <span className="text-[10px] text-[#213532]/70 font-semibold">
                        {m.deposits > 0 ? money(m.deposits) : ''}
                      </span>
                      <div
                        className="w-full rounded-t-lg bg-gradient-to-t from-[#B08B48]/30 to-[#B08B48]"
                        style={{ height: `${(m.deposits / maxDeposit) * 100}%` }}
                        title={`${m.month}: ${money(m.deposits)} · ${m.count} payment(s)`}
                      />
                    </div>
                    <span className="text-[10px] text-[#213532]/60 mt-2 font-medium">{m.month}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card title="Money flow">
          <div className="p-5 space-y-3">
            {[
              ['Deposits', money(data.money.deposits), 'text-emerald-700'],
              ['Withdrawals', money(data.money.withdrawals), 'text-rose-700'],
              ['Net', money(data.money.net), data.money.net >= 0 ? 'text-emerald-700' : 'text-rose-700'],
              ['Average deposit', money(data.money.avgDeposit), 'text-[#213532]'],
              ['Pending requests', String(data.money.pendingRequests), 'text-[#B08B48]'],
            ].map(([label, value, cls]) => (
              <div key={label} className="flex justify-between text-[12px]">
                <span className="text-[#213532]/70">{label}</span>
                <span className={`font-bold ${cls}`}>{value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Clients">
          <div className="p-5 space-y-3">
            {[
              ['Total', data.clients.total],
              ['Active', data.clients.active],
              ['Awaiting confirmation', data.clients.pending],
              ['Blocked', data.clients.blocked],
              ['Funded at least once', data.clients.funded],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex justify-between text-[12px]">
                <span className="text-[#213532]/70">{label}</span>
                <span className="font-bold text-[#1C412C]">{value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Trading">
          <div className="p-5 space-y-3">
            {[
              ['Positions total', data.trading.total],
              ['Open', data.trading.open],
              ['Pending orders', data.trading.pending],
              ['Volume', money(data.trading.volume)],
              ['Profit factor', data.trading.profitFactor || '—'],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex justify-between text-[12px]">
                <span className="text-[#213532]/70">{label}</span>
                <span className="font-bold text-[#1C412C]">{value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Lead funnel" subtitle={`Potential ${money(data.leads.potential)}`}>
          <div className="p-5 space-y-3">
            {['new', 'contact', 'kyc', 'active'].map(stage => {
              const count = data.leads.byStage[stage] || 0;
              const share = data.leads.total ? (count / data.leads.total) * 100 : 0;
              return (
                <div key={stage}>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#213532]/70">{stageLabels[stage]}</span>
                    <span className="text-[#1C412C] font-semibold">{count}</span>
                  </div>
                  <div className="h-1.5 bg-[#EFEAD9] rounded-full overflow-hidden">
                    <div className="h-full bg-[#B08B48]" style={{ width: `${share}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Staff monitoring */}
      <Card title="Manager performance" subtitle="Calls, leads and activity per person">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#F5F2E9] border-b border-[#E4DECB]">
              <tr>
                <Th>Manager</Th><Th>Calls</Th><Th>Answered</Th><Th>Talk time</Th>
                <Th>Leads</Th><Th>Converted</Th><Th>Actions</Th><Th>Last active</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4DECB]">
              {managers.length === 0 && (
                <tr><Td className="py-8 text-center text-[#213532]/60">No staff activity yet</Td></tr>
              )}
              {managers.map(m => (
                <tr key={m.id} className="hover:bg-[#F2EEDF]/50">
                  <Td className="font-semibold text-[#1C412C]">
                    {m.name}
                    <div className="text-[10px] text-[#213532]/60">{m.role}</div>
                  </Td>
                  <Td className="text-[#213532]">{m.calls}</Td>
                  <Td className="text-[#213532]">
                    {m.answered}
                    {m.calls > 0 && <span className="text-[#213532]/60 text-[11px]"> · {m.answerRate}%</span>}
                  </Td>
                  <Td className="text-[#213532]">{mins(m.talkTimeSec)}</Td>
                  <Td className="text-[#213532]">{m.leads}</Td>
                  <Td className="text-[#213532]">{m.converted}</Td>
                  <Td className="text-[#213532]">{m.actions}</Td>
                  <Td className="text-[11px] text-[#213532]/60">
                    {m.lastActive
                      ? new Date(m.lastActive).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })
                      : '—'}
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

/* ============================================================
   CALLS PANEL
   ============================================================ */
const CallsPanel: React.FC<{
  investors: Investor[];
  phonesHidden: boolean;
  users: ApiUser[];
  onPlaceCall: (client: ApiUser, callerName: string) => void;
  onWhisper: (call: ApiCall) => void;
}> = ({ phonesHidden, users, onPlaceCall, onWhisper }) => {
  const [callerName, setCallerName] = useState('Oak Haven Yield Support');
  const [log, setLog] = useState<(ApiCall & { hasRecording: boolean; missed?: boolean })[]>([]);
  const [stats, setStats] = useState({ total: 0, answered: 0, missed: 0, declined: 0, avgSec: 0 });
  const [live, setLive] = useState<ApiCall[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const clients = users.filter(u => u.role === 'CLIENT');

  const refresh = async () => {
    try {
      const r = await apiCallLog();
      setLog(r.calls);
      setStats(r.stats);
    } catch { /* ignore */ }
    try {
      const inbox = await apiCallInbox();
      setLive(inbox.calls.filter(c => c.status === 'active' || c.status === 'ringing'));
    } catch { /* ignore */ }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, []);

  const shown = clients.filter(c =>
    !query.trim() ||
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    c.email.toLowerCase().includes(query.toLowerCase()),
  );

  const fmtDur = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={CheckCircle2} label="Answered" value={String(stats.answered)} tone="green" />
        <Kpi icon={X} label="Missed" value={String(stats.missed)} tone="red" />
        <Kpi icon={X} label="Declined" value={String(stats.declined)} tone="red" />
        <Kpi icon={History} label="Avg duration" value={fmtDur(stats.avgSec)} tone="gold" />
      </div>

      <Card title="Live calls" subtitle="Whisper (supervisor) mode: only the manager hears you — the client never does. Pick a live call below.">
        <div className="p-5 space-y-2">
          {live.length === 0 && (
            <div className="text-[12px] text-[#213532]/60 py-3 text-center">
              No live calls right now — place one with the "Call" button on the right,
              and it will appear here within a couple of seconds.
            </div>
          )}
          {live.map(c => (
              <div
                key={c.id}
                className="flex items-center justify-between bg-[#F5F2E9] border border-[#E4DECB] rounded-xl px-4 py-3"
              >
                <div>
                  <div className="text-[13px] font-semibold text-[#1C412C]">
                    {c.managerName} → {c.clientName}
                  </div>
                  <div className="text-[11px] text-[#213532]/70">
                    {c.status === 'ringing' ? 'Ringing…' : 'In progress'}
                    {c.whisperName ? ` · ${c.whisperName} is coaching` : ''}
                  </div>
                </div>
                <Btn size="sm" variant="ghost" icon={Ear} onClick={() => onWhisper(c)}>
                  {c.whisperBy ? 'Coaching' : 'Whisper'}
                </Btn>
              </div>
            ))}
          </div>
        </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Place a call" subtitle="The client sees the caller name you choose">
          <div className="p-5 space-y-3">
            <div>
              <label className="text-[11px] font-bold uppercase text-[#213532]/70">Caller name</label>
              <Input
                className="w-full mt-1.5"
                value={callerName}
                onChange={e => setCallerName(e.target.value)}
              />
            </div>
            <Input
              className="w-full"
              placeholder="Search a client…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <div className="max-h-[280px] overflow-y-auto space-y-2">
              {shown.length === 0 && (
                <div className="text-[12px] text-[#213532]/60 py-6 text-center">No clients yet</div>
              )}
              {shown.map(c => (
                <div
                  key={c.id}
                  className="flex items-center justify-between bg-[#F5F2E9] border border-[#E4DECB] rounded-xl px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-[#1C412C] truncate">{c.name}</div>
                    <div className="text-[11px] text-[#213532]/70 truncate">
                      {phonesHidden ? '•••• hidden' : c.email}
                    </div>
                  </div>
                  <Btn size="sm" variant="gold" icon={PhoneCall} onClick={() => onPlaceCall(c, callerName)}>
                    Call
                  </Btn>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Call history" subtitle="Recordings are kept with the call">
          <div className="overflow-x-auto max-h-[420px]">
            <table className="w-full text-left">
              <thead className="bg-[#F5F2E9] border-b border-[#E4DECB] sticky top-0">
                <tr>
                  <Th>When</Th>
                  <Th>Client</Th>
                  <Th>Manager</Th>
                  <Th>Duration</Th>
                  <Th className="text-right">Recording</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4DECB]">
                {log.length === 0 && (
                  <tr>
                    <Td className="py-10 text-center text-[#213532]/60">No calls yet</Td>
                  </tr>
                )}
                {log.map(c => (
                  <tr key={c.id} className="hover:bg-[#F2EEDF]/50">
                    <Td className="text-[12px] text-[#213532]">
                      {new Date(c.startedAt).toLocaleString('en-US', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </Td>
                    <Td className="font-semibold text-[#1C412C] text-[12px]">{c.clientName}</Td>
                    <Td className="text-[12px] text-[#213532]">{c.managerName}</Td>
                    <Td className="text-[12px]">
                      {c.answeredAt ? (
                        fmtDur(c.durationSec)
                      ) : c.declined ? (
                        <Badge tone="red">declined</Badge>
                      ) : (
                        <Badge tone="red">missed</Badge>
                      )}
                    </Td>
                    <Td className="text-right">
                      {c.hasRecording ? (
                        <Btn
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            try {
                              const r = await apiCallRecording(c.id);
                              setPlaying(r.data);
                            } catch { /* ignore */ }
                          }}
                        >
                          Play
                        </Btn>
                      ) : (
                        <span className="text-[11px] text-[#213532]/50">—</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {playing && (
            <div className="p-4 border-t border-[#E4DECB] bg-[#F5F2E9]">
              <audio src={playing} controls autoPlay className="w-full" />
            </div>
          )}
        </Card>
      </div>
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
          <thead className="bg-[#F5F2E9] border-b border-[#E4DECB]">
            <tr>
              <Th>ID / Date</Th>
              <Th>Client</Th>
              <Th>Amount</Th>
              <Th>Method</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4DECB]">
            {requests.length === 0 && (
              <tr>
                <Td className="py-10 text-center text-[#213532]/60">No requests</Td>
              </tr>
            )}
            {requests.map(req => (
              <tr key={req.id} className="hover:bg-[#F2EEDF]/50">
                <Td className="font-mono text-[11px] text-[#213532]/70">
                  #{req.id}
                  <div className="text-[10px] text-[#213532]/60">{req.date}</div>
                </Td>
                <Td className="font-semibold text-[#1C412C]">{req.investorName}</Td>
                <Td className="font-extrabold text-[#1C412C]">${req.amount.toLocaleString('en-US')}</Td>
                <Td className="text-[12px] text-[#213532]">{req.method}</Td>
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
                    <span className="text-[11px] text-[#213532]/60">Processed</span>
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

/* ===== Modal shell ===== */
const Modal: React.FC<{ onClose: () => void; title: string; subtitle?: string; children: React.ReactNode }> = ({
  onClose,
  title,
  subtitle,
  children,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
    <div className="bg-white border border-[#E4DECB] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-[16px] font-bold text-[#1C412C]">{title}</h3>
          {subtitle && <p className="text-[11px] text-[#213532]/70 mt-0.5">{subtitle}</p>}
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-[#1C412C]/[.06] hover:bg-[#1C412C]/[.12] text-[#213532]/70 flex items-center justify-center cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {children}
    </div>
  </div>
);
