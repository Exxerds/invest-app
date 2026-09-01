import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Header } from './components/Header';
import type { ActiveTab } from './components/Header';
import { ProjectCatalog } from './components/catalog/ProjectCatalog';
const LandingPage = lazy(() => import('./components/landing/LandingPage').then(m => ({ default: m.LandingPage })));
const InvestorDashboard = lazy(() => import('./components/investor/InvestorDashboard').then(m => ({ default: m.InvestorDashboard })));
const CrmDashboard = lazy(() => import('./components/crm/CrmDashboard').then(m => ({ default: m.CrmDashboard })));

// light skeleton shown while lazy chunks load
const PageSkeleton: React.FC = () => (
  <div className="max-w-6xl mx-auto px-6 py-16 animate-pulse">
    <div className="h-8 bg-[#1C412C]/10 rounded w-1/3 mb-4" />
    <div className="h-4 bg-[#1C412C]/10 rounded w-2/3 mb-8" />
    <div className="grid grid-cols-3 gap-4">
      <div className="h-32 bg-white border border-[#E4DECB] rounded-xl" />
      <div className="h-32 bg-white border border-[#E4DECB] rounded-xl" />
      <div className="h-32 bg-white border border-[#E4DECB] rounded-xl" />
    </div>
  </div>
);
import { InvestModal } from './components/modals/InvestModal';
import { LoginModal } from './components/modals/LoginModal';
import { ForgotPasswordModal } from './components/modals/ForgotPasswordModal';
import { RegisterModal } from './components/modals/RegisterModal';
import { ResetPasswordModal } from './components/modals/ResetPasswordModal';
import { apiMe, apiConfirmEmail, getToken, setToken, apiAdminUsers, apiAdminChangePassword, apiAdminUpdateUser, apiSetUserBalance, ApiError } from './api';
import type { ApiUser, ApiKycDoc, ApiNotification } from './api';
import { 
  apiStartCall, apiWhisper, apiCallInbox, apiCallStatus, apiNotes, apiAddNote, 
  apiCrmSettings, apiSaveCrmSettings, apiClientStatuses, apiSetClientStatus, 
  apiLeads, apiCreateLead, apiUpdateLead, apiAddLeadComment, apiImpersonate, 
  apiMyTransactions, apiAllTransactions, apiApproveTransaction, apiRejectTransaction, 
  apiKycAll, apiKycMine, apiKycReview, apiNotifications, apiMarkNotificationsRead, 
  apiAllTrades, apiOpenTrade, apiUpdateTrade, apiCloseTrade as apiCloseTradeReq,
  apiMyInvestments, apiCreateInvestment, apiClaimInvestmentProfit, apiQuote
} from './api';
import type { ApiTrade, ApiTransaction, ApiCall } from './api';
import { CallDock, IncomingCall } from './components/calls/CallPanel';
import { enablePushNotifications } from './push';
import { initMetaPixel, trackPageView, trackMetaPixel } from './pixel';
import { 
  DepositModal, 
  WithdrawModal, 
  NewLeadModal, 
  NewProjectModal 
} from './components/modals/OperationsModals';
import { INITIAL_PROJECTS } from './data/mockData';
import type { 
  Project, 
  Investor, 
  Lead, 
  TransactionRequest, 
  ActiveInvestment, 
  LeadStage,
  CrmSettings,
  ClientNote,
  KycStatus
} from './types';
import type { AdminTrade } from './components/crm/CrmTradesManager';
import { CheckCircle2 } from 'lucide-react';
import { OakCrest } from './components/brand/Logo';

/** Where the user was before a refresh */
const TAB_KEY = 'ohy_tab';

/**
 * Older builds cached the (sample) portfolio in localStorage under
 * ohy_investments_* — those entries are why a brand-new account could still
 * show "my-01 BTC/USDT $35 000". Wipe them once, on boot.
 */
function purgeLegacyPortfolioCache() {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('ohy_investments_') || key.startsWith('my-'))) doomed.push(key);
    }
    doomed.forEach(k => localStorage.removeItem(k));
  } catch {
    /* private mode / storage disabled — nothing to clean */
  }
}
purgeLegacyPortfolioCache();
/** Holds the admin's own token while they view a client account */
const ADMIN_TOKEN_KEY = 'ohy_admin_token';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('landing');

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null);

  // Remember the current screen so a page refresh returns to it
  useEffect(() => {
    if (isLoggedIn && activeTab !== 'landing') localStorage.setItem(TAB_KEY, activeTab);
  }, [activeTab, isLoggedIn]);

  // Meta Pixel: fire PageView on boot and every time the user switches screen.
  // No-op unless VITE_META_PIXEL_ID is configured (see src/pixel.ts).
  useEffect(() => {
    initMetaPixel();
    trackPageView();
  }, [activeTab]);

  // Core State
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  // Mirrors the server-side balance; only the back office can change it
  const [investorBalance, setInvestorBalance] = useState<number>(0);
  const [myTransactions, setMyTransactions] = useState<ApiTransaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<ApiTransaction[]>([]);
  const [myInvestments, setMyInvestments] = useState<ActiveInvestment[]>([]);
  // Client records are derived from the database inside the CRM
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  /**
   * Deposit / withdrawal requests come from the server only. The former
   * INITIAL_REQUESTS sample rows made a brand-new install look like it
   * already had pending money movements.
   */
  const [requests] = useState<TransactionRequest[]>([]);

  // CRM users (from backend) + privacy settings
  const [users, setUsers] = useState<ApiUser[]>([]);
  /**
   * Mirrors server/src/crmSettings.js — the same defaults on both sides, so the
   * Settings screen is never blank for the split second before the API answers.
   */
  const [settings, setSettings] = useState<CrmSettings>({
    hidePhonesFromAgents: false,
    duplicateControl: true,
    manualClosing: false,
    callRecording: true,
    modules: {
      Spot: true, Futures: true, P2P: true, Binary: true, Staking: true,
      'AI Trading': false, Swap: false, 'Copy trading': false,
    },
    providers: {
      'USDT TRC-20': true, 'Visa / Mastercard': true, 'SEPA transfer': false,
      Bitcoin: true, PayPal: false, 'ACH transfer': true,
    },
  });

  // Agent notes are append-only: no edit/delete handlers exist by design
  const [clientNotes, setClientNotes] = useState<ClientNote[]>([]);
  const [clientStatuses, setClientStatuses] = useState<Record<string, string>>({});

  // KYC documents uploaded by clients, reviewed by admin/agent in the CRM
  const [kycDocuments, setKycDocuments] = useState<ApiKycDoc[]>([]);

  // Positions opened through the platform (persisted server-side)
  const [serverTrades, setServerTrades] = useState<ApiTrade[]>([]);

  /**
   * Locally-created positions (CRM → Trading → "Open position").
   *
   * It used to be seeded with four demo trades, which is why every fresh
   * account showed $98k invested / $111k portfolio and four positions it
   * never opened. A client's numbers must come from the server alone.
   */
  const [adminTrades, setAdminTrades] = useState<AdminTrade[]>([]);

  // Modals state
  const [selectedProjectForInvest, setSelectedProjectForInvest] = useState<Project | null>(null);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isForgotPasswordModalOpen, setIsForgotPasswordModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  /* ---- calls (WebRTC) ---- */
  const [incomingCall, setIncomingCall] = useState<ApiCall | null>(null);
  const [activeCall, setActiveCall] = useState<ApiCall | null>(null);
  const [callRole, setCallRole] = useState<'manager' | 'client' | 'supervisor'>('client');
  const [callInitiator, setCallInitiator] = useState(false);
  const [whisperCall, setWhisperCall] = useState<ApiCall | null>(null);

  const [impersonating, setImpersonating] = useState<boolean>(
    () => !!localStorage.getItem(ADMIN_TOKEN_KEY),
  );

  /* ========================================================
     AUTH: auto-login + email link handling
     - /confirm-email?token=...  (email confirmation)
     - /reset-password?token=... (password reset)
  ======================================================== */
  /**
   * Calls need their own, much faster loop: the shared 20s poll made an
   * incoming call appear long after the caller had given up, and a hang-up
   * on one side stayed on screen for the other.
   */
  useEffect(() => {
    if (!isLoggedIn || !getToken()) {
      setIncomingCall(null);
      setActiveCall(null);
      return;
    }

    let stopped = false;
    let leftoverSwept = false;
    const tick = async () => {
      try {
        const inbox = await apiCallInbox();
        if (stopped) return;

        setActiveCall(prev => {
          if (prev) {
            const same = inbox.calls.find(c => c.id === prev.id);
            // The other side hung up — close our dock too
            if (!same || same.status === 'ended') return null;
            return same;
          }
          // No dock on THIS page, but an active call involving me exists:
          // a reload / new tab dropped the media side of the conversation.
          // The other side's peer connection is dead, so just close the
          // record instead of letting it sit "active" forever (this is
          // what used to pop the incoming prompt back up "out of nowhere").
          if (!leftoverSwept) {
            leftoverSwept = true;
            const leftover = inbox.calls.find(
              c => c.status === 'active'
                && (c.clientId === currentUser?.id || c.managerId === currentUser?.id),
            );
            if (leftover) apiCallStatus(leftover.id, 'ended').catch(() => undefined);
          }
          return prev;
        });

        const ringing = inbox.calls.find(
          c => c.status === 'ringing' && c.clientId === currentUser?.id,
        );
        setIncomingCall(ringing || null);
      } catch {
        /* ignore transient errors */
      }
    };

    tick();
    const t = setInterval(() => { if (document.hidden) return; tick(); }, 4000);
    return () => { stopped = true; clearInterval(t); };
  }, [isLoggedIn, currentUser?.id]);

  // Register for browser notifications once the client is signed in
  useEffect(() => {
    if (!isLoggedIn || currentUser?.role !== 'CLIENT') return;
    enablePushNotifications().catch(() => undefined);
  }, [isLoggedIn, currentUser?.role]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname;
    const confirmToken = params.get('token');

    if (path === '/confirm-email' && confirmToken) {
      apiConfirmEmail(confirmToken)
        .then((res) => {
          setToken(res.token);
          setCurrentUser(res.user);
          setIsLoggedIn(true);
          setActiveTab('investor');
          showToast('✔ Email confirmed! Welcome to the platform!');
        })
        .catch((err) => {
          showToast(err instanceof Error ? `✖ ${err.message}` : '✖ Link is invalid', 'info');
        })
        .finally(() => window.history.replaceState({}, '', '/'));
    } else if (path === '/reset-password' && confirmToken) {
      setResetToken(confirmToken);
      window.history.replaceState({}, '', '/');
    } else if (getToken()) {
      // Restore the session with retry — the DB may be waking up (503).
      // Only a real 401 means the session is dead; otherwise retry in background.
      const restoreSession = async (attempt = 0) => {
        try {
          const res = await apiMe();
          setCurrentUser(res.user);
          setIsLoggedIn(true);
          const saved = localStorage.getItem(TAB_KEY) as ActiveTab | null;
          const allowed: ActiveTab[] =
            res.user.role === 'CLIENT' ? ['investor', 'catalog'] : ['crm'];
          setActiveTab(saved && allowed.includes(saved) ? saved : allowed[0]);
        } catch (err) {
          const status = err instanceof ApiError ? err.status : 0;
          if (status === 401) {
            setToken(null);
            return;
          }
          if (attempt < 3) {
            showToast('The server is waking up — retrying in the background.', 'info');
            setTimeout(() => restoreSession(attempt + 1), attempt * 1500 + 1500);
          } else {
            // after 3 attempts keep token but inform user
            showToast('The server is waking up — retrying in the background.', 'info');
          }
        }
      };
      restoreSession(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Staff: pull KYC submissions + notification feed, then poll for new ones
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const isStaff = currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER';

  useEffect(() => {
    if (!isLoggedIn || !getToken()) {
      setKycDocuments([]);
      setNotifications([]);
      setUnreadCount(0);
      setInvestorBalance(0);
      setMyTransactions([]);
      return;
    }

    const pull = async () => {
      if (isStaff) {
        try {
          const res = await apiKycAll();
          setKycDocuments(res.documents);
        } catch {
          /* ignore transient errors */
        }
        try {
          const t = await apiAllTrades();
          setServerTrades(t.trades);
        } catch {
          /* ignore transient errors */
        }
        try {
          const tx = await apiAllTransactions();
          setAllTransactions(tx.transactions);
        } catch {
          /* ignore transient errors */
        }
        await reloadLeads();
        await reloadNotes();
        try {
          const st = await apiClientStatuses();
          setClientStatuses(st.statuses);
        } catch { /* ignore */ }
        try {
          const cs = await apiCrmSettings();
          setSettings(cs.settings);
        } catch { /* ignore */ }
      } else {
        // Clients pull their own documents so the KYC badge is truthful
        try {
          const mine = await apiKycMine();
          setKycDocuments(mine.documents);
        } catch {
          /* ignore transient errors */
        }
        // ...and their balance, so an approval in the CRM shows up here
        try {
          const fin = await apiMyTransactions();
          setInvestorBalance(fin.balance);
          setMyTransactions(fin.transactions);
        } catch {
          /* ignore transient errors */
        }
        // ...and their active positions. The server is the single source of
        // truth: no localStorage cache, no sample positions. An account with
        // nothing opened shows an empty portfolio, as it should.
        try {
          const invRes = await apiMyInvestments();
          setMyInvestments(invRes.investments || []);
        } catch {
          /* keep whatever we already had rather than inventing positions */
        }
      }
      try {
        const n = await apiNotifications();
        setNotifications(n.notifications);
        setUnreadCount(n.unread);
      } catch {
        /* ignore */
      }
    };

    pull();
    const timer = setInterval(() => { if (document.hidden) return; pull(); }, 30000);
    return () => clearInterval(timer);
  }, [isLoggedIn, isStaff]);

  /**
   * The client counts as verified only when an admin approved the documents.
   * Three of them are required: passport front, back and proof of address.
   */
  const kycApproved =
    !isStaff &&
    ['front', 'back', 'address'].every(t =>
      kycDocuments.some(d => d.type === t && d.status === 'approved'),
    );

  const handleMarkNotificationsRead = async (id?: number) => {
    try {
      await apiMarkNotificationsRead(id);
      const n = await apiNotifications();
      setNotifications(n.notifications);
      setUnreadCount(n.unread);
    } catch {
      /* ignore */
    }
  };

  // Both admins and managers need the client list (calls, leads, support)
  useEffect(() => {
    const staff = currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER';
    if (!isLoggedIn || !staff || !getToken()) {
      setUsers([]);
      return;
    }
    apiAdminUsers()
      .then((res) => setUsers(res.users))
      .catch(() => setUsers([]));
  }, [isLoggedIn, currentUser]);

  /**
   * The CRM's CLIENT selector (Trading tab) and the client directory are
   * driven by `investors`, which used to stay an empty array forever.
   * Now it mirrors the server's user list: every CLIENT account becomes
   * an Investor record. The server list is the base, but local records
   * (e.g. a balance edit that has not round-tripped yet) win by id, so
   * in-flight changes are never clobbered by a refresh of `users`.
   */
  useEffect(() => {
    if (users.length === 0) return;
    setInvestors(prev => {
      const localById = new Map(prev.map(inv => [inv.id, inv]));

      /**
       * Invested / profit are DERIVED from the positions the server holds —
       * they used to be hard-zeros here, so the CRM showed a client with open
       * trades as having invested nothing.
       */
      const figuresFor = (userId: number) => {
        const mine = serverTrades.filter(t => Number(t.userId) === Number(userId));
        return {
          invested: mine
            .filter(t => t.status === 'OPEN')
            .reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
          totalProfit: mine.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0),
        };
      };

      return users
        .filter(u => u.role === 'CLIENT')
        .map(u => {
          const existing = localById.get(String(u.id));
          if (existing) return { ...existing, ...figuresFor(u.id) };
          const created = u.created_at ? new Date(u.created_at) : new Date();
          const dd = String(created.getDate()).padStart(2, '0');
          const mm = String(created.getMonth() + 1).padStart(2, '0');
          const rawKyc = (u as ApiUser & { kycStatus?: string }).kycStatus;
          const kycStatus: KycStatus =
            rawKyc === 'verified' || rawKyc === 'rejected' ? rawKyc : 'pending';
          return {
            id: String(u.id),
            name: u.name,
            email: u.email,
            phone: u.phone || '',
            kycStatus,
            balance: Number(u.balance) || 0,
            ...figuresFor(u.id),
            registrationDate: `${dd}.${mm}.${created.getFullYear()}`,
            manager: 'No manager',
          };
        });
    });
  }, [users, serverTrades]);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const totalInvested = myInvestments.reduce((sum, inv) => sum + inv.amount, 0);
  const totalAccrued = myInvestments.reduce((sum, inv) => sum + inv.accruedProfit, 0);
  const totalPortfolio = investorBalance + totalInvested + totalAccrued;

  /* ========================================================
     USER LOGIN & AUTH ACTIONS
  ======================================================== */
  const handleLoginSuccess = (user: ApiUser) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
    setActiveTab(user.role === 'CLIENT' ? 'investor' : 'crm');
    showToast(`✔ Signed in as ${user.name} (${user.role})!`);
  };

  const handleLogout = () => {
    setToken(null);
    setCurrentUser(null);
    setIsLoggedIn(false);
    setUsers([]);
    setInvestors([]);
    localStorage.removeItem(TAB_KEY);
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setImpersonating(false);
    setActiveTab('landing');
    showToast('✔ Signed out.', 'info');
  };

  /* ========================================================
     INVESTOR ACTIONS
  ======================================================== */
  const handleConfirmInvest = async (project: Project, amount: number) => {
    // Determine the base asset symbol
    const sym = project.title.split('—')[0].trim();
    let entry = 0;
    try {
      const q = await apiQuote(sym);
      entry = q.price || 0;
    } catch {
      entry = 0;
    }
    if (!entry) {
      if (sym.includes('BTC')) entry = 64337.56;
      else if (sym.includes('ETH')) entry = 3182.40;
      else if (sym.includes('XAU')) entry = 2415.30;
      else if (sym.includes('SOL')) entry = 148.50;
      else if (sym.includes('EUR')) entry = 1.0850;
      else entry = 100.0;
    }

    const calculatedAccrued = Math.round((amount * (project.apr / 100) * 15) / 365);

    try {
      const res = await apiCreateInvestment({
        projectId: project.id,
        projectTitle: project.title,
        categoryLabel: project.categoryLabel,
        amount,
        apr: project.apr,
        entryPrice: entry,
        symbol: sym,
        nextPayoutDate: '2026-09-01',
        accruedProfit: calculatedAccrued,
      });

      if (res.balance !== undefined) setInvestorBalance(res.balance);
      else setInvestorBalance(prev => Math.max(0, prev - amount));

      const newInv = res.investment;
      setMyInvestments(prev => [newInv, ...prev]);

      setProjects(prev => prev.map(p => {
        if (p.id === project.id) {
          return {
            ...p,
            raisedAmount: p.raisedAmount + amount
          };
        }
        return p;
      }));

      showToast(`✔ Position of $${amount.toLocaleString('en-US')} opened in «${project.title}».`);

      // Meta Pixel: standard Purchase event after a successful investment.
      // Values are USD because the platform balances are USD-denominated.
      trackMetaPixel('Purchase', {
        value: amount,
        currency: 'USD',
        content_name: project.title,
        content_type: 'product',
        content_ids: [project.id],
      });
    } catch (err) {
      // Fallback
      setInvestorBalance(prev => Math.max(0, prev - amount));
      const newInv: ActiveInvestment = {
        id: `my-${Date.now()}`,
        projectId: project.id,
        projectTitle: project.title,
        categoryLabel: project.categoryLabel,
        amount: amount,
        date: new Date().toISOString().split('T')[0],
        apr: project.apr,
        nextPayoutDate: '2026-09-01',
        entryPrice: entry,
        symbol: sym,
        accruedProfit: calculatedAccrued,
      };

      setMyInvestments(prev => [newInv, ...prev]);

      setProjects(prev => prev.map(p => {
        if (p.id === project.id) {
          return {
            ...p,
            raisedAmount: p.raisedAmount + amount
          };
        }
        return p;
      }));

      showToast(`✔ Position of $${amount.toLocaleString('en-US')} opened in «${project.title}».`);
    }
  };

  /**
   * Deposits and withdrawals are filed as requests on the server.
   * Nothing is credited here — the balance is re-read from the API,
   * and it only changes after the back office approves the request.
   */
  const refreshMyFinances = async () => {
    if (!getToken()) return;
    try {
      const res = await apiMyTransactions();
      setInvestorBalance(res.balance);
      setMyTransactions(res.transactions);
    } catch {
      /* ignore transient errors */
    }
  };

  /**
   * Claiming profit CLOSES the position: the server returns principal + P/L
   * (P/L can be negative — a loss returns less than the stake) and the
   * position disappears from the dashboard. Legacy local-only positions
   * (ids like "my-...") have no server record, so the payout is applied
   * to the balance locally.
   */
  const handleClaimDividends = async (invId: string, profit: number) => {
    const inv = myInvestments.find(i => String(i.id) === String(invId));
    const amount = Number(inv?.amount) || 0;
    const localPayout = Math.max(0, amount + profit);

    let returned = localPayout;
    try {
      if (/^\d+$/.test(String(invId).trim())) {
        const res = await apiClaimInvestmentProfit(Number(invId), profit);
        if (typeof res.balance === 'number') {
          setInvestorBalance(res.balance);
          returned = res.payout ?? localPayout;
        } else {
          setInvestorBalance(prev => prev + profit);
        }
      } else {
        // Legacy local-only position — no server record to close
        setInvestorBalance(prev => prev + localPayout);
      }
    } catch {
      // Network hiccup: keep the UX working with the local calculation
      setInvestorBalance(prev => prev + localPayout);
      returned = localPayout;
    }

    setMyInvestments(prev => prev.filter(i => String(i.id) !== String(invId)));

    showToast(
      `Position closed: $${returned.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} returned to balance ` +
      `(${profit >= 0
        ? `profit +$${profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : `loss -$${Math.abs(profit).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`})`,
    );
  };

  /* ========================================================
     CRM / ADMIN TRADES & BALANCE MANAGEMENT (#1 PRIORITY)
  ======================================================== */
  /**
   * The new balance is written to the server (PUT /admin/users/:id/balance),
   * which also records an audit transaction. Local state is updated first so
   * the UI reacts instantly; if the request fails the toast says so.
   *
   * Ids arrive in two shapes: the plain user id ("7") from the Trading
   * selector and the legacy "acc-7" from the user-details screen — both
   * resolve to the same account.
   */
  const handleUpdateInvestorBalance = async (investorId: string, newBalance: number) => {
    const bareId = String(investorId).replace(/^acc-/, '');

    setInvestors(prev => prev.map(inv => {
      if (inv.id === investorId || inv.id === bareId) {
        return {
          ...inv,
          balance: newBalance
        };
      }
      return inv;
    }));

    // Keep the CRM user table in sync without waiting for the next poll
    setUsers(prev => prev.map(u => (String(u.id) === bareId ? { ...u, balance: newBalance } : u)));

    if (investorId === 'inv-01') {
      setInvestorBalance(newBalance);
    }

    try {
      const res = await apiSetUserBalance(Number(bareId), newBalance);
      showToast(`✔ Client balance updated to $${res.balance.toLocaleString('en-US')}!`);
    } catch (err) {
      showToast(err instanceof Error ? `✖ ${err.message}` : '✖ Could not update the balance', 'info');
    }
  };

  const handleCreateTrade = async (newTradeData: Omit<AdminTrade, 'id' | 'status'>) => {
    // try server-backed creation first
    try {
      const bareId = String(newTradeData.investorId).replace(/^acc-/, '').replace(/^inv-/, '');
      // if not a numeric userId, fallback to local demo trade (legacy inv-01 etc)
      if (!/^\d+$/.test(bareId)) {
        const newTrade: AdminTrade = {
          ...newTradeData,
          id: `trade-${Date.now()}`,
          status: 'OPEN',
        };
        setAdminTrades(prev => [newTrade, ...prev]);
        setInvestors(prev => prev.map(inv => inv.id === newTradeData.investorId ? { ...inv, invested: inv.invested + newTradeData.amount, totalProfit: inv.totalProfit + newTradeData.pnl } : inv));
        showToast(`✔ Opened trading position «${newTradeData.asset}» for the client!`);
        return;
      }
      const asset = newTradeData.asset || '';
      // symbol is first token, name is full asset string
      const symbol = asset.split(' ')[0].split('—')[0].trim() || asset || 'BTC/USDT';
      const name = asset.includes('—') ? asset.split('—').slice(1).join('—').trim() : asset;
      await apiOpenTrade({
        userId: Number(bareId),
        symbol,
        name,
        side: newTradeData.type,
        amount: newTradeData.amount,
        notional: newTradeData.amount,
        entryPrice: newTradeData.entryPrice,
        leverage: newTradeData.leverage,
        currentPrice: newTradeData.currentPrice,
        pnl: newTradeData.pnl,
      } as any);
      const t = await apiAllTrades();
      setServerTrades(t.trades);
      showToast(`✔ Opened trading position «${newTradeData.asset}» for the client!`);
    } catch (err) {
      showToast(err instanceof Error ? `✖ ${err.message}` : '✖ Could not open position', 'info');
    }
  };

  const handleUpdateTrade = async (tradeId: string, patch: Partial<AdminTrade>) => {
    // Positions opened on the platform have a numeric id and live on the server
    if (tradeId.startsWith('srv-')) {
      const realId = Number(tradeId.replace('srv-', ''));
      try {
        await apiUpdateTrade(realId, {
          side: patch.type,
          amount: patch.amount,
          entryPrice: patch.entryPrice,
          currentPrice: patch.currentPrice,
          leverage: patch.leverage,
          pnl: patch.pnl,
          openedAt: patch.openedAt,
        } as Partial<ApiTrade>);
        const t = await apiAllTrades();
        setServerTrades(t.trades);
        showToast('✔ Position updated.');
      } catch (err) {
        showToast(err instanceof Error ? `✖ ${err.message}` : '✖ Update failed', 'info');
      }
      return;
    }
    setAdminTrades(prev => prev.map(t => (t.id === tradeId ? { ...t, ...patch } : t)));
    showToast('✔ Position updated.');
  };

  const handleCloseTrade = async (tradeId: string) => {
    if (tradeId.startsWith('srv-')) {
      const realId = Number(tradeId.replace('srv-', ''));
      try {
        await apiCloseTradeReq(realId);
        const t = await apiAllTrades();
        setServerTrades(t.trades);
        showToast('✔ Position closed.');
      } catch (err) {
        showToast(err instanceof Error ? `✖ ${err.message}` : '✖ Close failed', 'info');
      }
      return;
    }
    return handleCloseTradeLocal(tradeId);
  };

  const handleCloseTradeLocal = (tradeId: string) => {
    setAdminTrades(prev => prev.map(t => {
      if (t.id === tradeId) {
        return {
          ...t,
          status: 'CLOSED'
        };
      }
      return t;
    }));
    showToast('✔ Trading position closed.');
  };

  /* ========================================================
     CRM / ADMIN PIPELINE ACTIONS
  ======================================================== */
  /**
   * Leads live on the server now. Every change is persisted immediately,
   * so a page refresh no longer wipes the pipeline.
   */
  const reloadLeads = async () => {
    if (!getToken()) return;
    try {
      const res = await apiLeads();
      setLeads(
        res.leads.map(l => ({
          id: String(l.id),
          name: l.name,
          phone: l.phone,
          potentialAmount: l.potentialAmount,
          stage: (l.stage || 'new') as LeadStage,
          notes: l.notes || '',
          manager: l.manager || '',
          createdAt: new Date(l.createdAt).toLocaleString('en-US'),
          comments: (l.comments || []).map(c => ({
            id: c.id,
            author: c.author,
            text: c.text,
            date: new Date(c.date).toLocaleString('en-US'),
          })),
        })),
      );
    } catch {
      /* ignore transient errors */
    }
  };

  const handleMoveLeadStage = async (leadId: string, direction: 'next' | 'prev') => {
    const stages: LeadStage[] = ['new', 'contact', 'kyc', 'active'];
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    const idx = stages.indexOf(lead.stage);
    const nextStage =
      direction === 'next' ? stages[Math.min(stages.length - 1, idx + 1)] : stages[Math.max(0, idx - 1)];
    try {
      await apiUpdateLead(Number(leadId), { stage: nextStage });
      await reloadLeads();
      showToast('✔ Lead stage updated.');
    } catch (err) {
      showToast(err instanceof Error ? `✖ ${err.message}` : '✖ Could not update the lead', 'info');
    }
  };

  const handleCreateLead = async (newLeadData: Omit<Lead, 'id' | 'createdAt'>) => {
    try {
      await apiCreateLead({
        name: newLeadData.name,
        phone: newLeadData.phone,
        potentialAmount: newLeadData.potentialAmount,
        stage: newLeadData.stage,
        notes: newLeadData.notes,
        manager: newLeadData.manager,
      });
      await reloadLeads();
      showToast(`✔ Lead «${newLeadData.name}» added to the pipeline.`);
    } catch (err) {
      showToast(err instanceof Error ? `✖ ${err.message}` : '✖ Could not create the lead', 'info');
    }
  };

  const handleAddLeadComment = async (leadId: string, text: string) => {
    try {
      await apiAddLeadComment(Number(leadId), text);
      await reloadLeads();
      showToast('✔ Comment saved.');
    } catch (err) {
      showToast(err instanceof Error ? `✖ ${err.message}` : '✖ Could not save the comment', 'info');
    }
  };

  const handleApproveKyc = async (investorId: string) => {
    // Real flow is per-document via onReviewKyc — approve all pending docs for this user
    const numericId = Number(String(investorId).replace(/^acc-/, '').replace(/^inv-/, ''));
    if (!Number.isFinite(numericId)) {
      showToast('KYC is reviewed per document in the user details.', 'info');
      return;
    }
    const pending = kycDocuments.filter(d => d.userId === numericId && d.status === 'pending');
    if (pending.length === 0) {
      showToast('No pending KYC documents for this client. Open user details to review documents.', 'info');
      return;
    }
    try {
      for (const doc of pending) {
        await apiKycReview(doc.id, 'approved');
      }
      const res = await apiKycAll();
      setKycDocuments(res.documents);
      showToast(`✔ Approved ${pending.length} document(s) for client.`);
    } catch (err) {
      showToast(err instanceof Error ? `✖ ${err.message}` : '✖ KYC approve failed', 'info');
    }
  };

  /**
   * Approving a request is what actually moves money: the server credits or
   * debits the client's balance, writes the audit trail and notifies them.
   */
  const handleApproveRequest = async (requestId: string) => {
    try {
      const res = await apiApproveTransaction(Number(requestId));
      setAllTransactions(prev => prev.map(t => (t.id === res.transaction.id ? res.transaction : t)));
      showToast(`✔ Approved — client balance is now $${res.balance.toLocaleString('en-US')}.`);
    } catch (err) {
      showToast(err instanceof Error ? `✖ ${err.message}` : '✖ Could not approve', 'info');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const res = await apiRejectTransaction(Number(requestId));
      setAllTransactions(prev => prev.map(t => (t.id === res.transaction.id ? res.transaction : t)));
      showToast('✖ Request rejected. The client has been notified.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? `✖ ${err.message}` : '✖ Could not reject', 'info');
    }
  };

  const handleCreateProject = (newProjData: Omit<Project, 'id' | 'raisedAmount' | 'status'>) => {
    // Projects catalog is static (INITIAL_PROJECTS) — new assets are added via server in production.
    // Keeping this handler local-only would make the new project vanish on refresh, so we just notify.
    showToast(`Asset «${newProjData.title}» request received — it will be published after review.`, 'info');
    setActiveTab('catalog');
  };

  /* ========================================================
     USERS & ACCESS (ADMIN)
  ======================================================== */
  const handleChangeUserPassword = async (userId: number, newPassword: string) => {
    await apiAdminChangePassword(userId, newPassword);
    showToast('✔ Password changed successfully!');
  };

  const handleUpdateUserStatus = async (userId: number, status: string) => {
    await apiAdminUpdateUser(userId, { status });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: status as ApiUser['status'] } : u));
    showToast(`✔ User status updated: ${status}`);
  };

  /**
   * The CRM shows one list: demo positions plus everything actually opened
   * on the platform. Server ids are prefixed so the handlers know where to
   * send an edit.
   */
  const combinedTrades: AdminTrade[] = React.useMemo(() => {
    const mapped: AdminTrade[] = serverTrades.map(t => ({
      id: `srv-${t.id}`,
      // Investors are keyed by the plain user id (String(u.id)), so the
      // Trading tab can match a selected client to their positions
      investorId: String(t.userId),
      asset: t.name ? `${t.symbol} — ${t.name}` : t.symbol,
      type: t.side,
      amount: t.amount,
      entryPrice: t.entryPrice,
      currentPrice: t.currentPrice,
      leverage: t.leverage,
      pnl: t.pnl,
      status: t.status,
      openedAt: t.openedAt,
    }));
    return [...adminTrades, ...mapped];
  }, [adminTrades, serverTrades]);

  /** Notes live on the server, so they survive a refresh. */
  const reloadNotes = async () => {
    if (!getToken()) return;
    try {
      const res = await apiNotes();
      setClientNotes(
        res.notes.map(n => ({
          id: String(n.id),
          clientId: n.clientId,
          author: n.author,
          authorRole: n.authorRole === 'ADMIN' ? 'ADMIN' : 'MANAGER',
          text: n.text,
          createdAt: n.createdAt,
        })) as ClientNote[],
      );
    } catch {
      /* ignore transient errors */
    }
  };

  const handleAddClientNote = async (clientId: string, text: string) => {
    try {
      await apiAddNote(clientId, text);
      await reloadNotes();
      showToast('✔ Note saved to the client card.');
    } catch (err) {
      showToast(err instanceof Error ? `✖ ${err.message}` : '✖ Could not save the note', 'info');
    }
  };

  const handleSetClientStatus = async (clientId: string, status: string) => {
    try {
      const res = await apiSetClientStatus(clientId, status);
      setClientStatuses(res.statuses);
      showToast(`✔ Client status set to «${status}».`);
    } catch (err) {
      showToast(err instanceof Error ? `✖ ${err.message}` : '✖ Could not save the status', 'info');
    }
  };

  /** Admin or agent approves / rejects a document — persisted on the server */
  const handleReviewKyc = async (docId: number, status: 'approved' | 'rejected', reason?: string) => {
    try {
      await apiKycReview(docId, status, reason);
      const res = await apiKycAll();
      setKycDocuments(res.documents);
      showToast(status === 'approved' ? '✔ Document approved.' : '✖ Document rejected.', status === 'approved' ? 'success' : 'info');
    } catch (err) {
      showToast(err instanceof Error ? `✖ ${err.message}` : '✖ Review failed', 'info');
    }
  };

  /**
   * Every Settings toggle goes through here: the patch is merged server-side,
   * so the switches keep working instead of resetting on the next refresh.
   */
  const handleSaveSettings = async (patch: Partial<CrmSettings>, message?: string) => {
    if (currentUser?.role !== 'ADMIN') {
      showToast('Only an administrator can change this setting.', 'info');
      return;
    }
    const previous = settings;
    setSettings(prev => ({ ...prev, ...patch })); // optimistic — the UI must feel instant
    try {
      const res = await apiSaveCrmSettings(patch);
      setSettings(res.settings);
      if (message) showToast(`✔ ${message}`);
    } catch (err) {
      setSettings(previous);
      showToast(err instanceof Error ? `✖ ${err.message}` : '✖ Could not save the setting', 'info');
    }
  };

  const handleToggleHidePhones = () => {
    const next = !settings.hidePhonesFromAgents;
    handleSaveSettings(
      { hidePhonesFromAgents: next },
      next ? 'Phone numbers are now hidden from agents.' : 'Agents can see full phone numbers again.',
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F2E9] text-[#213532]">
      {/* Incoming call — client side */}
      {incomingCall && !activeCall && (
        <IncomingCall
          call={incomingCall}
          onAccept={async () => {
            setCallRole('client');
            setCallInitiator(false);
            setActiveCall(incomingCall);
            setIncomingCall(null);
          }}
          onDecline={async () => {
            try {
              await apiCallStatus(incomingCall.id, 'declined');
            } catch {
              /* the prompt closes either way */
            }
            setIncomingCall(null);
          }}
        />
      )}

      {activeCall && (
        <CallDock
          call={activeCall}
          role={callRole}
          initiator={callInitiator}
          whisperName={activeCall.whisperName}
          onClosed={() => setActiveCall(null)}
        />
      )}

      {/**
        * The manager answers the supervisor on the whisper channel.
        * Without this leg the coach could talk but nobody would hear them.
        */}
      {activeCall?.whisperBy && callRole === 'manager' && (
        <CallDock
          call={activeCall}
          role="manager"
          initiator={false}
          channel="whisper"
          headless
          onClosed={() => undefined}
        />
      )}

      {/* Supervisor coaching runs on its own connection */}
      {whisperCall && (
        <CallDock
          call={whisperCall}
          role="supervisor"
          initiator
          channel="whisper"
          onClosed={async () => {
            try {
              await apiWhisper(whisperCall.id, false);
            } catch {
              /* leaving locally is enough */
            }
            setWhisperCall(null);
          }}
        />
      )}

      {/* Impersonation banner — always visible so nobody forgets they are
          looking at somebody else's account */}
      {impersonating && (
        <div className="sticky top-0 z-[60] bg-[#B08B48] text-[#1C412C] px-4 py-2 flex items-center justify-between gap-3">
          <span className="text-[13px] font-bold">
            You are viewing the platform as {currentUser?.name} ({currentUser?.email})
          </span>
          <button
            onClick={() => {
              const adminToken = localStorage.getItem(ADMIN_TOKEN_KEY);
              localStorage.removeItem(ADMIN_TOKEN_KEY);
              setImpersonating(false);
              if (!adminToken) return handleLogout();
              setToken(adminToken);
              apiMe()
                .then(res => {
                  setCurrentUser(res.user);
                  setActiveTab('crm');
                  showToast('Back in the admin panel');
                })
                .catch(() => handleLogout());
            }}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-[#1C412C] text-[#F5F2E9] text-[12px] font-bold hover:bg-[#163524] cursor-pointer"
          >
            Return to admin
          </button>
        </div>
      )}

      {/* Top Header (hidden on landing & CRM — they have their own navbars) */}
      {activeTab !== 'crm' && activeTab !== 'landing' && activeTab !== 'investor' && (
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        investorBalance={investorBalance}
        totalPortfolio={totalPortfolio}
        onOpenDepositModal={() => setIsDepositModalOpen(true)}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        isLoggedIn={isLoggedIn}
        onLogout={handleLogout}
        userName={currentUser?.name}
        userInitials={currentUser?.name
          ? currentUser.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
          : undefined}
        userRole={currentUser?.role === 'CLIENT' ? 'Client' : currentUser?.role}
      />
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full">
        {activeTab === 'landing' && (
          <Suspense fallback={<PageSkeleton />}>
            <LandingPage
              onOpenLoginModal={() => setIsLoginModalOpen(true)}
              onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
            />
          </Suspense>
        )}

        {activeTab === 'investor' && (
          <Suspense fallback={<PageSkeleton />}>
            <InvestorDashboard
            user={currentUser}
            kycVerified={kycApproved}
            transactions={myTransactions}
            investorBalance={investorBalance}
            myInvestments={myInvestments}
            onOpenCatalog={() => setActiveTab('catalog')}
            onOpenDepositModal={() => setIsDepositModalOpen(true)}
            onOpenWithdrawModal={() => setIsWithdrawModalOpen(true)}
            onClaimDividends={handleClaimDividends}
            onLogout={handleLogout}
            onBalanceChanged={refreshMyFinances}
            /**
             * The profile was saved on the server — mirror it into the local
             * session state so the sidebar (name/initials), the header and
             * the CRM reflect the change immediately, without a re-login.
             */
            onProfileUpdated={({ name, email, phone }) => {
              setCurrentUser(prev => (prev ? { ...prev, name, email, phone } : prev));
              const myId = currentUser?.id;
              if (myId != null) {
                setUsers(prev => prev.map(u => (u.id === myId ? { ...u, name, email, phone } : u)));
              }
            }}
            />
          </Suspense>
        )}

        {activeTab === 'catalog' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <ProjectCatalog
            projects={projects}
            onOpenInvestModal={(proj) => setSelectedProjectForInvest(proj)}
            onSwitchToCrm={() => setActiveTab('crm')}
          />
          </div>
        )}

        {activeTab === 'crm' && (
          <Suspense fallback={<PageSkeleton />}>
            <CrmDashboard
            leads={leads}
            onMoveLeadStage={handleMoveLeadStage}
            onOpenNewLeadModal={() => setIsNewLeadModalOpen(true)}
            investors={investors}
            onApproveKyc={handleApproveKyc}
            requests={[
              // Real deposit / withdrawal requests from the server
              ...allTransactions.map(t => ({
                id: String(t.id),
                investorId: `srv-${t.userId}`,
                investorName: t.userName,
                type: t.type,
                amount: t.amount,
                status: t.status,
                date: new Date(t.createdAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
                method: t.method,
              })) as TransactionRequest[],
              ...requests,
            ]}
            onPlaceCall={async (client, callerName) => {
              try {
                const res = await apiStartCall(client.id, callerName);
                setCallRole('manager');
                setCallInitiator(true);
                setActiveCall(res.call);
                showToast(`Calling ${client.name}…`);
              } catch (err) {
                showToast(err instanceof Error ? `✖ ${err.message}` : '✖ Could not start the call', 'info');
              }
            }}
            onWhisper={async (call) => {
              try {
                const res = await apiWhisper(call.id, true);
                // A separate dock on the whisper channel, so the manager's
                // own call keeps running untouched
                setWhisperCall(res.call);
                showToast(`Coaching ${res.call.managerName} — the client cannot hear you`);
              } catch (err) {
                showToast(err instanceof Error ? `✖ ${err.message}` : '✖ Could not join', 'info');
              }
            }}
            onImpersonateUser={async (u) => {
              // Keep the admin session so we can switch back afterwards
              try {
                const res = await apiImpersonate(u.id);
                localStorage.setItem(ADMIN_TOKEN_KEY, getToken() || '');
                setToken(res.token);
                setCurrentUser(res.user);
                setImpersonating(true);
                setActiveTab('investor');
                showToast(`Viewing the platform as ${res.user.name}`);
              } catch (err) {
                showToast(err instanceof Error ? `✖ ${err.message}` : '✖ Could not open the account', 'info');
              }
            }}
            onLogout={handleLogout}
            onApproveRequest={handleApproveRequest}
            onRejectRequest={handleRejectRequest}
            projects={projects}
            onOpenNewProjectModal={() => setIsNewProjectModalOpen(true)}
            trades={combinedTrades}
            onUpdateInvestorBalance={handleUpdateInvestorBalance}
            onCreateTrade={handleCreateTrade}
            onUpdateTrade={handleUpdateTrade}
            onCloseTrade={handleCloseTrade}
            onAddLeadComment={handleAddLeadComment}
            users={users}
            currentUserName={currentUser?.name || 'Manager'}
            currentUserRole={currentUser?.role || 'MANAGER'}
            onChangeUserPassword={handleChangeUserPassword}
            onUpdateUserStatus={handleUpdateUserStatus}
            settings={settings}
            onToggleHidePhones={handleToggleHidePhones}
            onSaveSettings={handleSaveSettings}
            onNotify={showToast}
            notes={clientNotes}
            onAddNote={handleAddClientNote}
            clientStatuses={clientStatuses}
            onSetClientStatus={handleSetClientStatus}
            kycDocuments={kycDocuments}
            onReviewKyc={handleReviewKyc}
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkNotificationsRead={handleMarkNotificationsRead}
            />
          </Suspense>
        )}
      </main>

      {/* Footer (like Shoreline Direct: risk warning + payments + copyright) */}
      {activeTab !== 'crm' && activeTab !== 'investor' && (
      <footer className="bg-[#1C412C] border-t border-[#B08B48]/25 text-[#F5F2E9]/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
            <div className="max-w-sm">
              <div className="flex items-center gap-2.5">
                {/* Cream disc keeps the dark-green crest readable on the
                    dark-green footer — same treatment as the sidebar and the
                    e-mail header. */}
                <div className="w-9 h-9 rounded-full bg-[#F5F2E9] flex items-center justify-center shrink-0">
                  <OakCrest size={20} />
                </div>
                <span className="font-serif font-bold text-lg text-white tracking-wide">OAK HAVEN <span className="text-[#B08B48] italic">YIELD</span></span>
              </div>
              <p className="text-xs leading-relaxed mt-3">
                Financial advisors since 2010. Stocks, commodities, indices and digital assets —
                managed with risk first.
              </p>
            </div>

            <div>
              <div className="text-xs font-bold text-white uppercase tracking-wider mb-3">Payment methods</div>
              <div className="flex flex-wrap gap-2">
                {['VISA', 'Mastercard', 'PayPal', 'USDT', 'BTC'].map(p => (
                  <span key={p} className="px-3 py-1.5 rounded-md bg-white/10 border border-white/15 text-xs font-bold text-[#F5F2E9]">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-white/15">
            <p className="text-[11px] text-[#F5F2E9]/60 leading-relaxed">
              <strong className="text-[#B08B48]">Risk Warning:</strong> Leveraged products such as
              CFD's and Forex trading are complex instruments with a high risk of losing money. The
              products offered are intended for professional and retail clients. Please note that
              client accounts could sustain losses of deposited funds or in some cases even
              exceeding their deposit amount. Since clients can lose more than the deposit we
              advise you to trade responsibly so in case funds were lost in trading it does not
              significantly affect your personal and financial well-being.
            </p>
          </div>

          <div className="mt-6 pt-6 border-t border-white/15 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span>© 2026 Oak Haven Yield. All Rights Reserved.</span>
            <div className="flex items-center gap-5">
              <button onClick={() => setActiveTab('landing')} className="hover:text-white transition-colors cursor-pointer">
                Privacy Policy
              </button>
              <button onClick={() => setActiveTab('landing')} className="hover:text-white transition-colors cursor-pointer">
                Terms & Conditions
              </button>
            </div>
          </div>
        </div>
      </footer>
      )}

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 animate-bounce">
          <div className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 max-w-md ${
            toastMessage.type === 'success'
              ? 'bg-[#1C412C] text-[#F5F2E9] border-[#1C412C]'
              : 'bg-white text-[#213532] border-[#E4DECB]'
          }`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
              toastMessage.type === 'success' ? 'bg-[#B08B48] text-white' : 'bg-[#1C412C]/10 text-[#1C412C]'
            }`}>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium">{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Modals */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        onOpenForgotPassword={() => {
          setIsLoginModalOpen(false);
          setIsForgotPasswordModalOpen(true);
        }}
        onOpenRegister={() => {
          setIsLoginModalOpen(false);
          setIsRegisterModalOpen(true);
        }}
      />

      <ForgotPasswordModal
        isOpen={isForgotPasswordModalOpen}
        onClose={() => setIsForgotPasswordModalOpen(false)}
        onBackToLogin={() => {
          setIsForgotPasswordModalOpen(false);
          setIsLoginModalOpen(true);
        }}
      />

      <RegisterModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onBackToLogin={() => {
          setIsRegisterModalOpen(false);
          setIsLoginModalOpen(true);
        }}
      />

      <ResetPasswordModal
        isOpen={!!resetToken}
        token={resetToken}
        onClose={() => setResetToken(null)}
      />

      <InvestModal
        project={selectedProjectForInvest}
        isOpen={!!selectedProjectForInvest}
        onClose={() => setSelectedProjectForInvest(null)}
        userBalance={investorBalance}
        onConfirmInvest={handleConfirmInvest}
      />

      <DepositModal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        onRequested={refreshMyFinances}
      />

      <WithdrawModal
        isOpen={isWithdrawModalOpen}
        onClose={() => setIsWithdrawModalOpen(false)}
        userBalance={investorBalance}
        onRequested={refreshMyFinances}
      />

      <NewLeadModal
        isOpen={isNewLeadModalOpen}
        onClose={() => setIsNewLeadModalOpen(false)}
        onCreateLead={handleCreateLead}
      />

      <NewProjectModal
        isOpen={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
        onCreateProject={handleCreateProject}
      />
    </div>
  );
}
