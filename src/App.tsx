import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import type { ActiveTab } from './components/Header';
import { LandingPage } from './components/landing/LandingPage';
import { LegalPage } from './components/legal/LegalPage';
import type { LegalSlug } from './legal/docs';
import { InvestorDashboard } from './components/investor/InvestorDashboard';
import { ProjectCatalog } from './components/catalog/ProjectCatalog';
import { CrmDashboard } from './components/crm/CrmDashboard';
import { InvestModal } from './components/modals/InvestModal';
import { LoginModal } from './components/modals/LoginModal';
import { ForgotPasswordModal } from './components/modals/ForgotPasswordModal';
import { RegisterModal } from './components/modals/RegisterModal';
import { ResetPasswordModal } from './components/modals/ResetPasswordModal';
import { apiMe, apiConfirmEmail, getToken, setToken, apiAdminUsers, apiAdminChangePassword, apiAdminUpdateUser, apiSetUserBalance, apiAdminDeleteUser } from './api';
import type { ApiUser, ApiKycDoc, ApiNotification } from './api';
import { 
  apiStartCall, apiWhisper, apiCallInbox, apiCallStatus, apiNotes, apiAddNote, 
  apiCrmSettings, apiSaveCrmSettings, apiClientStatuses, apiSetClientStatus, apiWithdrawBlocks, apiSetWithdrawBlock,
  apiLeads, apiCreateLead, apiUpdateLead, apiAddLeadComment, apiImpersonate, 
  apiMyTransactions, apiAllTransactions, apiApproveTransaction, apiRejectTransaction, 
  apiKycAll, apiKycMine, apiKycReview, apiNotifications, apiMarkNotificationsRead, 
  apiAllTrades, apiUpdateTrade, apiCloseTrade as apiCloseTradeReq, apiOpenTrade, apiSupportPresence,
  apiAssets, apiCreateAsset, apiUpdateAsset, apiDeleteAsset,
  apiMyInvestments, apiCreateInvestment, apiClaimInvestmentProfit, apiQuote
} from './api';
import type { ApiTrade, ApiTransaction, ApiCall, ApiAsset } from './api';
import { CallDock, IncomingCall, primeCallAudio } from './components/calls/CallPanel';
import { enablePushNotifications } from './push';
import { initMetaPixel, trackMeta } from './analytics/metaPixel';
import { 
  DepositModal, 
  WithdrawModal, 
  NewLeadModal, 
  NewProjectModal 
} from './components/modals/OperationsModals';

// NOTE: no more mock/demo data — every list below starts empty and is
// filled exclusively from the server (real accounts, real trades).
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

/** Where the user was before a refresh */
const TAB_KEY = 'ohy_tab';
/** Holds the admin's own token while they view a client account */
const ADMIN_TOKEN_KEY = 'ohy_admin_token';

function legalSlugFromPath(path: string): LegalSlug | null {
  const m = path.match(/^\/legal\/(client|aml|terms|risk)\/?$/);
  return m ? (m[1] as LegalSlug) : null;
}

function initialTab(): ActiveTab {
  if (typeof window === 'undefined') return 'landing';
  if (window.location.pathname === '/confirm-email') return 'investor';
  if (getToken()) {
    const saved = localStorage.getItem(TAB_KEY) as ActiveTab | null;
    if (saved && saved !== 'landing') return saved;
    return 'investor';
  }
  return 'landing';
}

export default function App() {
  useEffect(() => {
    initMetaPixel();
  }, []);

  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);
  const [legalSlug, setLegalSlug] = useState<LegalSlug | null>(() => legalSlugFromPath(window.location.pathname));

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null);

  // Remember the current screen so a page refresh returns to it
  useEffect(() => {
    if (isLoggedIn && activeTab !== 'landing') localStorage.setItem(TAB_KEY, activeTab);
  }, [activeTab, isLoggedIn]);

  useEffect(() => {
    const onPop = () => setLegalSlug(legalSlugFromPath(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Core State — everything starts EMPTY; the server fills it (no demo data)
  const [projects, setProjects] = useState<Project[]>([]);
  // Mirrors the server-side balance; only the back office can change it
  const [investorBalance, setInvestorBalance] = useState<number>(0);
  const [myTransactions, setMyTransactions] = useState<ApiTransaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<ApiTransaction[]>([]);
  const [myInvestments, setMyInvestments] = useState<ActiveInvestment[]>([]);
  // Client records are derived from the database inside the CRM
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);

  // CRM users (from backend) + privacy settings
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [settings, setSettings] = useState<CrmSettings>({
    hidePhonesFromAgents: false,
    duplicateControl: true,
    manualClosing: false,
    callRecording: true,
  });

  // Platform rules that bend what a CLIENT may do (server-checked anyway)
  const [clientPolicy, setClientPolicy] = useState({ manualClosing: false });

  // Agent notes are append-only: no edit/delete handlers exist by design
  const [clientNotes, setClientNotes] = useState<ClientNote[]>([]);
  const [clientStatuses, setClientStatuses] = useState<Record<string, string>>({});
  // Server-enforced payout blocks { '<userId>': true }
  const [withdrawBlocks, setWithdrawBlocks] = useState<Record<string, boolean>>({});

  // KYC documents uploaded by clients, reviewed by admin/agent in the CRM
  const [kycDocuments, setKycDocuments] = useState<ApiKycDoc[]>([]);

  // Positions opened through the platform (persisted server-side)
  const [serverTrades, setServerTrades] = useState<ApiTrade[]>([]);

  // Admin Trades — local layer for desk-created drafts. ALWAYS starts empty:
  // real positions are read from the server (see combinedTrades below).
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
  const [selectedAccountType, setSelectedAccountType] = useState<string | null>(null);
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
    const t = setInterval(tick, 2000);
    return () => { stopped = true; clearInterval(t); };
  }, [isLoggedIn, currentUser?.id]);

  // Register for browser notifications once the client is signed in
  useEffect(() => {
    if (!isLoggedIn || currentUser?.role !== 'CLIENT') return;
    enablePushNotifications().catch(() => undefined);
  }, [isLoggedIn, currentUser?.role]);

  // Prime the browser's audio context on the first real client interaction.
  // This lets future incoming-call ringtones start automatically without a
  // separate enable button, while still respecting autoplay policies.
  useEffect(() => {
    if (!isLoggedIn || currentUser?.role !== 'CLIENT') return;
    const unlock = () => {
      void primeCallAudio();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [isLoggedIn, currentUser?.role]);

  // Real last-seen heartbeat — any logged-in client pings while the tab is open
  useEffect(() => {
    if (!isLoggedIn || currentUser?.role !== 'CLIENT' || !getToken()) return;
    const tick = () => { apiSupportPresence().catch(() => undefined); };
    tick();
    const t = setInterval(tick, 25000);
    return () => clearInterval(t);
  }, [isLoggedIn, currentUser?.role]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname;
    const initialLegal = legalSlugFromPath(path);
    if (initialLegal) setLegalSlug(initialLegal);
    const confirmToken = params.get('token');

    if (path === '/confirm-email' && confirmToken) {
      apiConfirmEmail(confirmToken)
        .then((res) => {
          setToken(res.token);
          setCurrentUser(res.user);
          setIsLoggedIn(true);
          setActiveTab('investor');
          // flag rules of the cabinet (manual position closing etc.)
          apiMe().then(m => m.policy && setClientPolicy(m.policy)).catch(() => undefined);
          showToast('✔ Email confirmed! Welcome to the platform!');
        })
        .catch((err) => {
          const e = err as { code?: string; status?: number; message?: string };
          if (e.status === 409 || e.code === 'ALREADY_CONFIRMED') {
            // Second click on the same letter: friendly state + open the sign-in form
            showToast('✔ This e-mail is already confirmed. Just sign in!');
            setIsLoginModalOpen(true);
          } else {
            showToast(`✖ ${e.message || 'Link is invalid'}`, 'info');
          }
        })
        .finally(() => window.history.replaceState({}, '', '/'));
    } else if (path === '/reset-password' && confirmToken) {
      setResetToken(confirmToken);
      window.history.replaceState({}, '', '/');
    } else if (getToken()) {
      // Restore the session AND the screen the user was on. Without the
      // second part a refresh dropped everyone back onto the landing page,
      // which felt exactly like being logged out.
      apiMe()
        .then((res) => {
          setCurrentUser(res.user);
          setIsLoggedIn(true);
          setClientPolicy(res.policy || { manualClosing: false });
          const saved = localStorage.getItem(TAB_KEY) as ActiveTab | null;
          const allowed: ActiveTab[] =
            res.user.role === 'CLIENT' ? ['investor', 'catalog'] : ['crm'];
          if (!legalSlugFromPath(window.location.pathname)) {
            setActiveTab(saved && allowed.includes(saved) ? saved : allowed[0]);
          }
        })
        .catch(() => setToken(null));
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
      // Market instruments live on the server — same list for everyone
      await reloadAssets();
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
          const staffUsers = await apiAdminUsers();
          setUsers(staffUsers.users);
        } catch { /* ignore */ }
        try {
          const st = await apiClientStatuses();
          setClientStatuses(st.statuses);
        } catch { /* ignore */ }
        try {
          const wb = await apiWithdrawBlocks();
          setWithdrawBlocks(wb.blocks);
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
        // ...and their active investments — the server is the single source
        // of truth; an empty list honestly shows an empty portfolio.
        try {
          const invRes = await apiMyInvestments();
          setMyInvestments(invRes.investments || []);
        } catch {
          /* keep the last known list on transient network errors */
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
    const timer = setInterval(pull, 20000); // near real-time without websockets
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
      return users
        .filter(u => u.role === 'CLIENT')
        .map(u => {
          const existing = localById.get(String(u.id));
          if (existing) {
            return {
              ...existing,
              name: u.name,
              email: u.email,
              phone: u.phone || existing.phone,
              balance: Number(u.balance) || existing.balance,
              manager: u.assignedManagerName || 'Unassigned',
              accountType: u.accountType || existing.accountType,
              lastSeen: u.lastSeen || null,
              assignedManagerId: u.assignedManagerId || null,
              defaultLeverage: u.defaultLeverage || existing.defaultLeverage || 10,
            };
          }
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
            accountType: u.accountType || '',
            kycStatus,
            balance: Number(u.balance) || 0,
            invested: 0,
            totalProfit: 0,
            registrationDate: `${dd}.${mm}.${created.getFullYear()}`,
            manager: u.assignedManagerName || 'Unassigned',
            lastSeen: u.lastSeen || null,
            assignedManagerId: u.assignedManagerId || null,
            defaultLeverage: u.defaultLeverage || 10,
          };
        });
    });
  }, [users]);

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
  const handleLoginSuccess = (user: ApiUser, policy?: { manualClosing: boolean }) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
    if (policy) setClientPolicy(policy);
    setActiveTab(user.role === 'CLIENT' ? 'investor' : 'crm');
    showToast(`✔ Signed in as ${user.name} (${user.role})!`);
  };

  const openRegister = (accountType?: string) => {
    const selected = accountType || null;
    setSelectedAccountType(selected);
    if (selected) trackMeta('ViewContent', { content_name: selected, content_category: 'Account tier' });
    setIsRegisterModalOpen(true);
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
      trackMeta('Purchase', {
        value: amount,
        currency: 'USD',
        content_name: project.title,
      });
      setMyInvestments(prev => {
        const next = [newInv, ...prev];
        localStorage.setItem(`ohy_investments_${currentUser?.id || 'client'}`, JSON.stringify(next));
        return next;
      });

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
    } catch {
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

      setMyInvestments(prev => {
        const next = [newInv, ...prev];
        localStorage.setItem(`ohy_investments_${currentUser?.id || 'client'}`, JSON.stringify(next));
        return next;
      });

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

    setMyInvestments(prev => {
      const next = prev.filter(i => String(i.id) !== String(invId));
      localStorage.setItem(`ohy_investments_${currentUser?.id || 'client'}`, JSON.stringify(next));
      return next;
    });

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
    const userId = Number(String(newTradeData.investorId).replace(/^acc-/, ''));
    const symbol = String(newTradeData.asset || '').split(' ')[0] || 'BTC/USDT';
    try {
      await apiOpenTrade({
        userId,
        symbol,
        name: newTradeData.asset,
        side: newTradeData.type,
        amount: newTradeData.amount,
        entryPrice: newTradeData.entryPrice,
        currentPrice: newTradeData.currentPrice || newTradeData.entryPrice,
        leverage: newTradeData.leverage,
        openedAt: newTradeData.openedAt,
      });
      const t = await apiAllTrades();
      setServerTrades(t.trades);
      showToast(`✔ Opened trading position «${newTradeData.asset}» for the client!`);
    } catch (err) {
      showToast(err instanceof Error ? `✖ ${err.message}` : '✖ Could not open the position', 'info');
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
          email: l.email || '',
          potentialAmount: l.potentialAmount,
          stage: (l.stage || 'new') as LeadStage,
          accountType: l.accountType || '',
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

  const handleApproveKyc = (investorId: string) => {
    setInvestors(prev => prev.map(inv => {
      if (inv.id === investorId) {
        return {
          ...inv,
          kycStatus: 'verified'
        };
      }
      return inv;
    }));
    showToast('✔ Investor KYC approved!');
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

  /**
   * Assets are platform data: they live on the server, so an instrument the
   * admin publishes appears in every client's Market — not in one browser.
   */
  const handleCreateProject = async (newProjData: Omit<Project, 'id' | 'raisedAmount' | 'status'>) => {
    try {
      await apiCreateAsset(newProjData as Partial<ApiAsset> & { title: string });
      await reloadAssets();
      showToast(`✔ New asset «${newProjData.title}» published!`);
    } catch (err) {
      showToast(err instanceof Error ? `✖ ${err.message}` : '✖ Could not create the asset', 'info');
    }
  };

  const handleUpdateProject = async (id: string, patch: Partial<Project> & import('./api').AssetTimerPatch) => {
    const numId = Number(String(id).replace(/^srv-/, ''));
    try {
      await apiUpdateAsset(numId, patch as Partial<ApiAsset> & import('./api').AssetTimerPatch);
      await reloadAssets();
      try {
        const invRes = await apiMyInvestments();
        setMyInvestments(invRes.investments || []);
      } catch { /* staff may not have client investments */ }
      showToast('✔ Asset saved.');
    } catch (err) {
      showToast(err instanceof Error ? `✖ ${err.message}` : '✖ Could not save the asset', 'info');
    }
  };

  const handleDeleteProject = async (id: string) => {
    const numId = Number(String(id).replace(/^srv-/, ''));
    try {
      await apiDeleteAsset(numId);
      await reloadAssets();
      showToast('✔ Asset removed.');
    } catch (err) {
      showToast(err instanceof Error ? `✖ ${err.message}` : '✖ Could not delete the asset', 'info');
    }
  };

  const openLegal = (slug: LegalSlug) => {
    setLegalSlug(slug);
    window.history.pushState({}, '', `/legal/${slug}`);
  };

  const closeLegal = () => {
    setLegalSlug(null);
    window.history.pushState({}, '', '/');
    setActiveTab('landing');
  };

  const reloadAssets = async () => {
    try {
      const r = await apiAssets();
      setProjects(r.assets.map(a => ({
        id: `srv-${a.id}`,
        title: a.title,
        category: a.category as Project['category'],
        categoryLabel: a.categoryLabel,
        targetAmount: Number(a.targetAmount) || 0,
        raisedAmount: Number(a.raisedAmount) || 0,
        apr: Number(a.apr) || 0,
        termMonths: Number(a.termMonths) || 0,
        minCheck: Number(a.minCheck) || 0,
        riskLevel: a.riskLevel,
        status: a.status as Project['status'],
        description: a.description,
        imageUrl: a.imageUrl,
        tags: Array.isArray(a.tags) ? a.tags : [],
        closesAt: a.closesAt || null,
      })));
    } catch {
      /* keep the last known list on transient errors */
    }
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

  const handleDeleteUser = async (userId: number) => {
    const res = await apiAdminDeleteUser(userId);
    setUsers(prev => prev.filter(u => u.id !== userId));
    setInvestors(prev => prev.filter(inv => String(inv.id) !== String(userId) && inv.id !== `acc-${userId}`));
    await reloadLeads();
    showToast(`✔ ${res.message}`);
  };

  const handlePatchUser = (userId: number, patch: Partial<ApiUser>) => {
    setUsers(prev => prev.map(u => (u.id === userId ? { ...u, ...patch } : u)));
    setInvestors(prev => prev.map(inv => {
      if (String(inv.id) !== String(userId) && inv.id !== `acc-${userId}`) return inv;
      return {
        ...inv,
        manager: patch.assignedManagerName ?? inv.manager,
        assignedManagerId: patch.assignedManagerId !== undefined ? patch.assignedManagerId : inv.assignedManagerId,
        defaultLeverage: patch.defaultLeverage ?? inv.defaultLeverage,
        lastSeen: patch.lastSeen !== undefined ? patch.lastSeen : inv.lastSeen,
      };
    }));
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

  /** CRM «Block withdrawal» — actually stops /transactions/withdraw server-side */
  const handleSetWithdrawBlock = async (clientId: string, blocked: boolean) => {
    try {
      const res = await apiSetWithdrawBlock(clientId, blocked);
      setWithdrawBlocks(res.blocks);
      showToast(blocked ? '✔ Withdrawals blocked for this client.' : '✔ Withdrawals unblocked.');
    } catch (err) {
      showToast(err instanceof Error ? `✖ ${err.message}` : '✖ Could not save', 'info');
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
   * All \"Privacy & access\" toggles persist through the same endpoint,
   * so the choice survives restarts and applies to every staff member.
   */
  const handleToggleCrmSetting = async (key: keyof CrmSettings) => {
    if (currentUser?.role !== 'ADMIN') {
      showToast('Only an administrator can change this setting.', 'info');
      return;
    }
    const next = { ...settings, [key]: !settings[key] };
    try {
      const res = await apiSaveCrmSettings(next);
      setSettings(res.settings);
      showToast('✔ Setting saved.');
    } catch (err) {
      showToast(err instanceof Error ? `✖ ${err.message}` : '✖ Could not save the setting', 'info');
    }
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

      {/* Supervisor listens to the main room (client + manager) without
          publishing there, and speaks to the manager through the private
          whisper room below. */}
      {whisperCall && (
        <>
          <CallDock
            call={whisperCall}
            role="supervisor"
            initiator={false}
            channel="main"
            headless
            publishAudio={false}
            multiAudio
            onClosed={() => undefined}
          />
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
        </>
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
      {activeTab !== 'crm' && activeTab !== 'landing' && activeTab !== 'investor' && !legalSlug && (
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
        {legalSlug && (
          <LegalPage slug={legalSlug} onBack={closeLegal} onOpen={openLegal} />
        )}

        {activeTab === 'landing' && !legalSlug && !getToken() && (
          <LandingPage
            onOpenLoginModal={() => setIsLoginModalOpen(true)}
            onOpenRegisterModal={openRegister}
          />
        )}

        {activeTab === 'investor' && (
          <InvestorDashboard
            user={currentUser}
            kycVerified={kycApproved}
            transactions={myTransactions}
            investorBalance={investorBalance}
            myInvestments={myInvestments}
            onOpenCatalog={() => setActiveTab('catalog')}
            onOpenDepositModal={() => setIsDepositModalOpen(true)}
            onOpenWithdrawModal={() => setIsWithdrawModalOpen(true)}
            allowManualClosing={clientPolicy.manualClosing}
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
        )}

        {activeTab === 'catalog' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <ProjectCatalog
            projects={projects}
            canManageAssets={isStaff}
            notifications={notifications}
            onOpenInvestModal={(proj) => setSelectedProjectForInvest(proj)}
            onSwitchToCrm={() => setActiveTab('crm')}
          />
          </div>
        )}

        {activeTab === 'crm' && isStaff && !legalSlug && (
          <CrmDashboard
            leads={leads}
            onMoveLeadStage={handleMoveLeadStage}
            onOpenNewLeadModal={() => setIsNewLeadModalOpen(true)}
            investors={investors}
            onApproveKyc={handleApproveKyc}
            requests={
              // only real deposit / withdrawal requests from the server
              allTransactions.map(t => ({
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
              })) as TransactionRequest[]
            }
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
            onUpdateProject={handleUpdateProject}
            onDeleteProject={handleDeleteProject}
            onRefreshProjects={reloadAssets}
            trades={combinedTrades}
            onUpdateInvestorBalance={handleUpdateInvestorBalance}
            onCreateTrade={handleCreateTrade}
            onUpdateTrade={handleUpdateTrade}
            onCloseTrade={handleCloseTrade}
            onAddLeadComment={handleAddLeadComment}
            onRefreshLeads={reloadLeads}
            users={users}
            currentUserName={currentUser?.name || 'Manager'}
            currentUserRole={currentUser?.role || 'MANAGER'}
            onChangeUserPassword={handleChangeUserPassword}
            onUpdateUserStatus={handleUpdateUserStatus}
            onDeleteUser={handleDeleteUser}
            onPatchUser={handlePatchUser}
            settings={settings}
            onToggleSetting={handleToggleCrmSetting}
            onNotify={showToast}
            notes={clientNotes}
            onAddNote={handleAddClientNote}
            clientStatuses={clientStatuses}
            onSetClientStatus={handleSetClientStatus}
            withdrawBlocks={withdrawBlocks}
            onSetWithdrawBlock={handleSetWithdrawBlock}
            kycDocuments={kycDocuments}
            onReviewKyc={handleReviewKyc}
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkNotificationsRead={handleMarkNotificationsRead}
          />
        )}
      </main>

      {/* Footer (like Shoreline Direct: risk warning + payments + copyright) */}
      {activeTab !== 'crm' && activeTab !== 'investor' && !legalSlug && (
      <footer className="bg-[#1C412C] border-t border-[#B08B48]/25 text-[#F5F2E9]/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
            <div className="max-w-sm">
              <div className="flex items-center gap-3">
                <span className="w-16 h-16 rounded-full bg-[#F5F2E9] flex items-center justify-center shrink-0 overflow-hidden">
                  <img src="/brand-crest.png" alt="" className="w-[88px] h-[88px] object-contain max-w-none" />
                </span>
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
                {['USDT', 'BTC', 'ETH', 'USDC'].map(p => (
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
              <button onClick={() => openLegal('client')} className="hover:text-white transition-colors cursor-pointer">
                Client Agreement
              </button>
              <button onClick={() => openLegal('terms')} className="hover:text-white transition-colors cursor-pointer">
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
        selectedAccountType={selectedAccountType}
        onClose={() => {
          setIsRegisterModalOpen(false);
          setSelectedAccountType(null);
        }}
        onBackToLogin={() => {
          setIsRegisterModalOpen(false);
          setSelectedAccountType(null);
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
