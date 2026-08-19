import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import type { ActiveTab } from './components/Header';
import { LandingPage } from './components/landing/LandingPage';
import { InvestorDashboard } from './components/investor/InvestorDashboard';
import { ProjectCatalog } from './components/catalog/ProjectCatalog';
import { CrmDashboard } from './components/crm/CrmDashboard';
import { InvestModal } from './components/modals/InvestModal';
import { LoginModal } from './components/modals/LoginModal';
import { ForgotPasswordModal } from './components/modals/ForgotPasswordModal';
import { RegisterModal } from './components/modals/RegisterModal';
import { ResetPasswordModal } from './components/modals/ResetPasswordModal';
import { apiMe, apiConfirmEmail, getToken, setToken, apiAdminUsers, apiAdminChangePassword, apiAdminUpdateUser } from './api';
import type { ApiUser, ApiKycDoc, ApiNotification } from './api';
import { apiStartCall, apiWhisper, apiCallInbox, apiCallStatus, apiNotes, apiAddNote, apiCrmSettings, apiSaveCrmSettings, apiClientStatuses, apiSetClientStatus, apiLeads, apiCreateLead, apiUpdateLead, apiAddLeadComment, apiImpersonate, apiMyTransactions, apiAllTransactions, apiApproveTransaction, apiRejectTransaction, apiKycAll, apiKycMine, apiKycReview, apiNotifications, apiMarkNotificationsRead, apiAllTrades, apiUpdateTrade, apiCloseTrade as apiCloseTradeReq } from './api';
import type { ApiTrade, ApiTransaction, ApiCall } from './api';
import { CallDock, IncomingCall } from './components/calls/CallPanel';
import { enablePushNotifications } from './push';
import { 
  DepositModal, 
  WithdrawModal, 
  NewLeadModal, 
  NewProjectModal 
} from './components/modals/OperationsModals';
import { 
  INITIAL_PROJECTS, 
  INITIAL_REQUESTS 
} from './data/mockData';
import type { 
  Project, 
  Investor, 
  Lead, 
  TransactionRequest, 
  ActiveInvestment, 
  LeadStage,
  CrmSettings,
  ClientNote
} from './types';
import type { AdminTrade } from './components/crm/CrmTradesManager';
import { CheckCircle2, TrendingUp } from 'lucide-react';

/** Where the user was before a refresh */
const TAB_KEY = 'ohy_tab';
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
  const [requests] = useState<TransactionRequest[]>(INITIAL_REQUESTS);

  // CRM users (from backend) + privacy settings
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [settings, setSettings] = useState<CrmSettings>({ hidePhonesFromAgents: false });

  // Agent notes are append-only: no edit/delete handlers exist by design
  const [clientNotes, setClientNotes] = useState<ClientNote[]>([]);
  const [clientStatuses, setClientStatuses] = useState<Record<string, string>>({});

  // KYC documents uploaded by clients, reviewed by admin/agent in the CRM
  const [kycDocuments, setKycDocuments] = useState<ApiKycDoc[]>([]);

  // Positions opened through the platform (persisted server-side)
  const [serverTrades, setServerTrades] = useState<ApiTrade[]>([]);

  // Admin Trades State (Priority feature for CRM!)
  const [adminTrades, setAdminTrades] = useState<AdminTrade[]>([
    {
      id: 'trade-01',
      investorId: 'inv-01',
      asset: 'BTC/USDT (Crypto Spot)',
      type: 'LONG',
      amount: 15000,
      entryPrice: 61400,
      currentPrice: 64200,
      leverage: 1,
      pnl: 1450,
      status: 'OPEN'
    },
    {
      id: 'trade-02',
      investorId: 'inv-01',
      asset: 'ETH/USDT (Futures Long 10x)',
      type: 'LONG',
      amount: 10000,
      entryPrice: 2680,
      currentPrice: 2820,
      leverage: 10,
      pnl: 2100,
      status: 'OPEN'
    },
    {
      id: 'trade-03',
      investorId: 'inv-01',
      asset: 'XAU/USD — Gold (Precious Metal Spot)',
      type: 'SPOT',
      amount: 35000,
      entryPrice: 2380,
      currentPrice: 2415,
      leverage: 1,
      pnl: 4810,
      status: 'OPEN'
    },
    {
      id: 'trade-04',
      investorId: 'inv-02',
      asset: 'BTC/USDT (Futures Short 5x)',
      type: 'SHORT',
      amount: 25000,
      entryPrice: 63500,
      currentPrice: 62100,
      leverage: 5,
      pnl: 2750,
      status: 'OPEN'
    }
  ]);

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

  const [impersonating, setImpersonating] = useState<boolean>(
    () => !!localStorage.getItem(ADMIN_TOKEN_KEY),
  );

  /* ========================================================
     AUTH: auto-login + email link handling
     - /confirm-email?token=...  (email confirmation)
     - /reset-password?token=... (password reset)
  ======================================================== */
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
      // Restore the session AND the screen the user was on. Without the
      // second part a refresh dropped everyone back onto the landing page,
      // which felt exactly like being logged out.
      apiMe()
        .then((res) => {
          setCurrentUser(res.user);
          setIsLoggedIn(true);
          const saved = localStorage.getItem(TAB_KEY) as ActiveTab | null;
          const allowed: ActiveTab[] =
            res.user.role === 'CLIENT' ? ['investor', 'catalog'] : ['crm'];
          setActiveTab(saved && allowed.includes(saved) ? saved : allowed[0]);
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
      }
      // Ringing / live calls addressed to me
      try {
        const inbox = await apiCallInbox();
        const ringing = inbox.calls.find(c => c.status === 'ringing');
        const live = inbox.calls.find(c => c.status === 'active');

        if (activeCall) {
          // Keep the whisper badge fresh while the call runs
          const same = inbox.calls.find(c => c.id === activeCall.id);
          if (same) setActiveCall(same);
          else setActiveCall(null);
        } else if (ringing && ringing.clientId === currentUser?.id) {
          setIncomingCall(ringing);
        } else if (live && live.clientId === currentUser?.id) {
          setIncomingCall(null);
        }
      } catch {
        /* ignore transient errors */
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

  // Load users list when logged in as ADMIN
  useEffect(() => {
    if (isLoggedIn && currentUser?.role === 'ADMIN' && getToken()) {
      apiAdminUsers()
        .then((res) => setUsers(res.users))
        .catch(() => setUsers([]));
    }
    if (currentUser?.role === 'ADMIN' && !getToken()) {
      // demo admin (no backend) — leave list empty
      setUsers([]);
    }
  }, [isLoggedIn, currentUser]);

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
    localStorage.removeItem(TAB_KEY);
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setImpersonating(false);
    setActiveTab('landing');
    showToast('✔ Signed out.', 'info');
  };

  /* ========================================================
     INVESTOR ACTIONS
  ======================================================== */
  const handleConfirmInvest = (project: Project, amount: number) => {
    setInvestorBalance(prev => prev - amount);

    setProjects(prev => prev.map(p => {
      if (p.id === project.id) {
        return {
          ...p,
          raisedAmount: p.raisedAmount + amount
        };
      }
      return p;
    }));

    const newInv: ActiveInvestment = {
      id: `my-${Date.now()}`,
      projectId: project.id,
      projectTitle: project.title,
      categoryLabel: project.categoryLabel,
      amount: amount,
      date: new Date().toISOString().split('T')[0],
      apr: project.apr,
      nextPayoutDate: '2026-09-01',
      accruedProfit: 0
    };
    setMyInvestments(prev => [newInv, ...prev]);

    setInvestors(prev => prev.map(inv => {
      if (inv.id === 'inv-01') {
        return {
          ...inv,
          balance: inv.balance - amount,
          invested: inv.invested + amount
        };
      }
      return inv;
    }));

    showToast(`✔ Position of $${amount.toLocaleString('en-US')} opened in «${project.title}».`);
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


  const handleClaimDividends = (invId: string, profit: number) => {
    setInvestorBalance(prev => prev + profit);
    setMyInvestments(prev => prev.map(inv => {
      if (inv.id === invId) {
        return {
          ...inv,
          accruedProfit: 0
        };
      }
      return inv;
    }));
    showToast(`✔ Profit +$${profit.toLocaleString('en-US')} moved to available balance!`);
  };

  /* ========================================================
     CRM / ADMIN TRADES & BALANCE MANAGEMENT (#1 PRIORITY)
  ======================================================== */
  const handleUpdateInvestorBalance = (investorId: string, newBalance: number) => {
    setInvestors(prev => prev.map(inv => {
      if (inv.id === investorId) {
        return {
          ...inv,
          balance: newBalance
        };
      }
      return inv;
    }));

    if (investorId === 'inv-01') {
      setInvestorBalance(newBalance);
    }

    showToast(`✔ Client balance updated to $${newBalance.toLocaleString('en-US')}!`);
  };

  const handleCreateTrade = (newTradeData: Omit<AdminTrade, 'id' | 'status'>) => {
    const newTrade: AdminTrade = {
      ...newTradeData,
      id: `trade-${Date.now()}`,
      status: 'OPEN'
    };
    setAdminTrades(prev => [newTrade, ...prev]);

    setInvestors(prev => prev.map(inv => {
      if (inv.id === newTradeData.investorId) {
        return {
          ...inv,
          invested: inv.invested + newTradeData.amount,
          totalProfit: inv.totalProfit + newTradeData.pnl
        };
      }
      return inv;
    }));

    showToast(`✔ Opened trading position «${newTradeData.asset}» for the client!`);
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

  const handleCreateProject = (newProjData: Omit<Project, 'id' | 'raisedAmount' | 'status'>) => {
    const newProject: Project = {
      ...newProjData,
      id: `p-${Date.now()}`,
      raisedAmount: 0,
      status: 'active'
    };
    setProjects(prev => [newProject, ...prev]);
    showToast(`✔ New asset «${newProject.title}» published!`);
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
      investorId: `acc-${t.userId}`,
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

  const handleToggleHidePhones = async () => {
    if (currentUser?.role !== 'ADMIN') {
      showToast('Only an administrator can change this setting.', 'info');
      return;
    }
    const next = !settings.hidePhonesFromAgents;
    try {
      const res = await apiSaveCrmSettings(next);
      setSettings(res.settings);
      showToast(next
        ? '✔ Phone numbers are now hidden from agents.'
        : '✔ Agents can see full phone numbers again.');
    } catch (err) {
      showToast(err instanceof Error ? `✖ ${err.message}` : '✖ Could not save the setting', 'info');
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col ${
        activeTab === 'landing' ? 'bg-[#F5F2E9] text-[#213532]' : 'bg-[#0e0f13] text-slate-200'
      }`}
    >
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
          <LandingPage
            onOpenLoginModal={() => setIsLoginModalOpen(true)}
            onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
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
            onClaimDividends={handleClaimDividends}
            onLogout={handleLogout}
            onBalanceChanged={refreshMyFinances}
          />
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
                setCallRole('supervisor');
                setCallInitiator(true);
                setActiveCall(res.call);
                showToast('Joined in whisper mode — the client cannot hear you');
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
        )}
      </main>

      {/* Footer (like Shoreline Direct: risk warning + payments + copyright) */}
      {activeTab !== 'crm' && activeTab !== 'investor' && (
      <footer className="bg-[#1C412C] border-t border-[#B08B48]/25 text-[#F5F2E9]/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
            <div className="max-w-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#B08B48] flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-white" />
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
            <p className="text-[11px] text-slate-500 leading-relaxed">
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
              ? 'bg-slate-900 text-white border-slate-800'
              : 'bg-white text-slate-800 border-slate-200'
          }`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
              toastMessage.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-blue-100 text-blue-600'
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
