// ============================================================
//  API client — frontend talks to the server via /api
//  (Vite proxies /api → http://localhost:4000)
// ============================================================

export interface ApiUser {
  id: number;
  name: string;
  email: string;
  /** Credited by the back office; absent for staff accounts */
  balance?: number;
  phone?: string;
  role: 'CLIENT' | 'MANAGER' | 'ADMIN';
  status: 'pending' | 'active' | 'blocked';
  created_at?: string;
}

export const TOKEN_KEY = 'tn_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...options,
      // MERGE the headers — spreading `options` last used to wipe out
      // Content-Type whenever a call passed an Authorization header,
      // so the server received an empty body and rejected the request.
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> | undefined),
      },
    });
  } catch {
    // Network failure → the API server (npm run dev) is probably not running
    throw new Error('Cannot reach the server. Make sure you ran «npm run dev» and the terminal shows "API server running".');
  }
  // 502/503/504 come from the Vite proxy when the API server (:4000) is down.
  // The body is an HTML error page, not JSON — show a human-readable hint instead.
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    throw new Error(
      'The API server is not running. Open a terminal in the project folder and run «npm run dev» — ' +
        'wait for the line "Oak Haven Yield API server running", then try again.',
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Server error (${res.status})`);
  }
  return data as T;
}

// ---------- auth ----------

export const apiRegister = (name: string, email: string, password: string) =>
  request<{ ok: true; message: string; emailSent?: boolean }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });

export const apiResendConfirmation = (email: string) =>
  request<{ ok: true; message: string }>('/auth/resend-confirmation', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

export const apiConfirmEmail = (token: string) =>
  request<{ ok: true; token: string; user: ApiUser }>('/auth/confirm-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });

export const apiLogin = (email: string, password: string) =>
  request<{ ok: true; token: string; user: ApiUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const apiMe = () =>
  request<{ user: ApiUser }>('/auth/me', {
    headers: { Authorization: `Bearer ${getToken()}` },
  });

export const apiForgotPassword = (email: string) =>
  request<{ ok: true; message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

export const apiResetPassword = (token: string, newPassword: string) =>
  request<{ ok: true; message: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });

// ---------- admin (CRM) ----------

export const apiAdminUsers = () =>
  request<{ users: ApiUser[] }>('/admin/users', {
    headers: { Authorization: `Bearer ${getToken()}` },
  });

/** Staff creates a new client account directly (active immediately) */
export const apiAdminCreateUser = (data: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  balance?: number;
  role?: string;
  status?: string;
}) =>
  request<{ ok: true; user: ApiUser; message: string }>('/admin/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(data),
  });

/** Admin changes password of ANY user */
export const apiAdminChangePassword = (userId: number, newPassword: string) =>
  request<{ ok: true; message: string }>(`/admin/users/${userId}/password`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ newPassword }),
  });

/** Admin updates user status (active/blocked/pending) or role */
export const apiAdminUpdateUser = (userId: number, data: { status?: string; role?: string }) =>
  request<{ ok: true; message: string }>(`/admin/users/${userId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(data),
  });

/** Staff sets the exact balance of a client account (CRM → Trading tab) */
export const apiSetUserBalance = (userId: number, balance: number) =>
  request<{ ok: true; balance: number; transaction: ApiTransaction }>(`/admin/users/${userId}/balance`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ balance }),
  });

// ---------- KYC documents ----------

export interface ApiKycDoc {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  type: 'front' | 'back' | 'address';
  fileName: string;
  mime: string;
  size: number;
  status: 'pending' | 'approved' | 'rejected';
  uploadedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectReason?: string;
  /** Streamed from the server — requires an auth header, so fetch it as a blob */
  fileUrl: string;
}

const authHeader = () => ({ Authorization: `Bearer ${getToken()}` });

/** Client: own documents */
export const apiKycMine = () =>
  request<{ documents: ApiKycDoc[] }>('/kyc/mine', { headers: authHeader() });

/** Client: upload or replace a document slot */
export const apiKycUpload = (type: string, fileName: string, dataUrl: string) =>
  request<{ ok: true; document: ApiKycDoc }>('/kyc/upload', {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify({ type, fileName, dataUrl }),
  });

/** Staff: every submission */
export const apiKycAll = () =>
  request<{ documents: ApiKycDoc[] }>('/kyc/all', { headers: authHeader() });

/** Staff: approve or reject */
export const apiKycReview = (id: number, status: 'approved' | 'rejected', reason?: string) =>
  request<{ ok: true; document: ApiKycDoc }>(`/kyc/${id}/review`, {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify({ status, reason }),
  });

/**
 * Documents are protected, so an <img src> cannot load them directly —
 * fetch with the token and turn the response into a local object URL.
 */
export async function fetchKycFile(id: number): Promise<string> {
  const res = await fetch(`/api/kyc/file/${id}`, { headers: authHeader() });
  if (!res.ok) throw new Error('Could not load the document');
  return URL.createObjectURL(await res.blob());
}

// ---------- notifications ----------

export interface ApiNotification {
  id: number;
  audience: 'staff' | 'client';
  userId: number | null;
  kind: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export const apiNotifications = () =>
  request<{ notifications: ApiNotification[]; unread: number }>('/notifications', {
    headers: authHeader(),
  });

export const apiMarkNotificationsRead = (id?: number) =>
  request<{ ok: true; unread: number }>('/notifications/read', {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify(id ? { id } : {}),
  });

// ---------- instrument search (proxied TradingView) ----------

export interface ApiSymbol {
  symbol: string;
  name: string;
  exchange: string;
  kind: string;
  category: string;
  tv: string;
  logo: string | null;
}

export const apiSearchSymbols = (q: string) =>
  request<{ results: ApiSymbol[]; error?: string }>(`/symbols/search?q=${encodeURIComponent(q)}`);

// ---------- trades ----------

export interface ApiTrade {
  /** Size in units of the asset (0.1 = 0.1 BTC) */
  units?: number;
  notional?: number;
  marginRate?: number;
  category?: string;
  exitPrice?: number;
  closeReason?: string;
  orderType?: 'market' | 'limit' | 'stop';
  triggerPrice?: number | null;
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  symbol: string;
  tv: string;
  name: string;
  side: 'LONG' | 'SHORT' | 'SPOT';
  amount: number;
  entryPrice: number;
  currentPrice: number;
  leverage: number;
  stopLoss: number | null;
  takeProfit: number | null;
  pnl: number;
  status: 'OPEN' | 'CLOSED' | 'PENDING';
  openedAt: string;
  margin?: number;
  liquidationPrice?: number;
  closedAt?: string;
  editedBy?: string;
  editedAt?: string;
}

export const apiMyTrades = () =>
  request<{ trades: ApiTrade[] }>('/trades/mine', { headers: authHeader() });

export const apiAllTrades = () =>
  request<{ trades: ApiTrade[] }>('/trades/all', { headers: authHeader() });

export const apiOpenTrade = (
  data: Partial<ApiTrade> & {
    symbol: string;
    amount: number;
    orderType?: 'market' | 'limit' | 'stop';
    triggerPrice?: number | null;
  },
) =>
  request<{ ok: true; trade: ApiTrade }>('/trades', {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify(data),
  });

/** Staff edits any parameter of a position */
export const apiUpdateTrade = (id: number, patch: Partial<ApiTrade>) =>
  request<{ ok: true; trade: ApiTrade }>(`/trades/${id}`, {
    method: 'PATCH',
    headers: authHeader(),
    body: JSON.stringify(patch),
  });

export const apiCloseTrade = (id: number) =>
  request<{ ok: true; trade: ApiTrade; balance: number | null }>(`/trades/${id}/close`, {
    method: 'POST',
    headers: authHeader(),
  });

// ---------- deposits & withdrawals ----------

export interface ApiTransaction {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  method: string;
  destination?: string;
  cryptoType?: string;
  walletAddress?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectReason?: string;
  balanceAfter?: number;
  manual?: boolean;
}

/** Client: own balance + request history */
export const apiMyTransactions = () =>
  request<{ balance: number; transactions: ApiTransaction[] }>('/transactions/mine', {
    headers: authHeader(),
  });

/** Client: ask the finance desk to credit a deposit (nothing moves yet) */
export const apiRequestDeposit = (amount: number, method: string, cryptoType?: string) =>
  request<{ ok: true; transaction: ApiTransaction; message: string }>('/transactions/deposit', {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify({ amount, method, cryptoType }),
  });

/** Client: ask compliance to release a withdrawal */
export const apiRequestWithdrawal = (
  amount: number,
  method: string,
  destination?: string,
  cryptoType?: string,
) =>
  request<{ ok: true; transaction: ApiTransaction; message: string }>('/transactions/withdraw', {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify({ amount, method, destination, cryptoType }),
  });

/** Staff: the whole review queue */
export const apiAllTransactions = () =>
  request<{ transactions: ApiTransaction[] }>('/transactions/all', { headers: authHeader() });

/** Staff: credit / debit the client and close the request */
export const apiApproveTransaction = (id: number) =>
  request<{ ok: true; transaction: ApiTransaction; balance: number }>(`/transactions/${id}/approve`, {
    method: 'POST',
    headers: authHeader(),
  });

/** Staff: decline a request with an optional reason */
export const apiRejectTransaction = (id: number, reason?: string) =>
  request<{ ok: true; transaction: ApiTransaction }>(`/transactions/${id}/reject`, {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify({ reason }),
  });

/** Staff: manual balance correction (positive or negative) */
export const apiAdjustBalance = (userId: number, amount: number, note?: string) =>
  request<{ ok: true; transaction: ApiTransaction; balance: number }>('/transactions/adjust', {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify({ userId, amount, note }),
  });

// ---------- leads (CRM funnel, persisted) ----------

export interface ApiLead {
  id: number;
  name: string;
  phone: string;
  email?: string;
  potentialAmount: number;
  stage: string;
  notes: string;
  manager: string;
  comments: { id: string; author: string; text: string; date: string }[];
  createdAt: string;
}

export const apiLeads = () =>
  request<{ leads: ApiLead[] }>('/leads', { headers: authHeader() });

export const apiCreateLead = (data: Partial<ApiLead>) =>
  request<{ ok: true; lead: ApiLead }>('/leads', {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify(data),
  });

export const apiUpdateLead = (id: number, data: Partial<ApiLead>) =>
  request<{ ok: true; lead: ApiLead }>(`/leads/${id}`, {
    method: 'PATCH',
    headers: authHeader(),
    body: JSON.stringify(data),
  });

export const apiAddLeadComment = (id: number, text: string) =>
  request<{ ok: true; lead: ApiLead }>(`/leads/${id}/comment`, {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify({ text }),
  });

// ---------- deposit wallets ----------

export type CryptoType = 'BTC' | 'ETH' | 'USDC';

/** Any signed-in user may read the addresses; only an admin may change them. */
export const apiDepositWallets = () =>
  request<{ wallets: Record<CryptoType, string>; types: CryptoType[] }>('/settings/deposit-wallets', {
    headers: authHeader(),
  });

/** Admin: one client's personal addresses (blank = use the shared default). */
export const apiClientWallets = (userId: number) =>
  request<{ wallets: Record<CryptoType, string>; defaults: Record<CryptoType, string>; types: CryptoType[] }>(
    `/settings/deposit-wallets/${userId}`,
    { headers: authHeader() },
  );

export const apiSaveClientWallets = (userId: number, wallets: Record<string, string>) =>
  request<{ ok: true; wallets: Record<CryptoType, string> }>(`/settings/deposit-wallets/${userId}`, {
    method: 'PUT',
    headers: authHeader(),
    body: JSON.stringify({ wallets }),
  });

export const apiSaveDepositWallets = (wallets: Record<string, string>) =>
  request<{ ok: true; wallets: Record<CryptoType, string> }>('/settings/deposit-wallets', {
    method: 'PUT',
    headers: authHeader(),
    body: JSON.stringify({ wallets }),
  });

/** Live price for one instrument (Binance, proxied through our API). */
export const apiQuote = (symbol: string) =>
  request<{ symbol: string; price: number | null }>(
    `/symbols/quote?symbol=${encodeURIComponent(symbol)}`,
  );

// ---------- mass mailing ("Happy letter") ----------

export const apiMailAudience = () =>
  request<{ all: number; active: number; noDeposit: number }>('/mailing/audience', {
    headers: authHeader(),
  });

export const apiSendMailing = (subject: string, body: string, audience: string) =>
  request<{ ok: true; sent: number; failed: number; total: number; message: string }>(
    '/mailing/send',
    {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({ subject, body, audience }),
    },
  );

/** Admin: obtain a session for a client account ("Login as user"). */
export const apiImpersonate = (userId: number) =>
  request<{ ok: true; token: string; user: ApiUser }>(`/admin/users/${userId}/impersonate`, {
    method: 'POST',
    headers: authHeader(),
  });

// ---------- margin requirements ----------

export type MarginCategory = 'Crypto' | 'Stocks' | 'Indices' | 'Commodities' | 'Currencies' | 'Other';

export const apiMarginRates = () =>
  request<{
    rates: Record<MarginCategory, number>;
    defaults: Record<MarginCategory, number>;
    categories: MarginCategory[];
  }>('/settings/margin-rates', { headers: authHeader() });

export const apiSaveMarginRates = (rates: Record<string, number>) =>
  request<{ ok: true; rates: Record<MarginCategory, number> }>('/settings/margin-rates', {
    method: 'PUT',
    headers: authHeader(),
    body: JSON.stringify({ rates }),
  });

/** Closes any position that hit its stop loss, take profit or liquidation. */
export const apiSettleTrades = () =>
  request<{
    ok: true;
    closed: { id: number; symbol: string; reason: string; pnl: number }[];
    triggered: { id: number; symbol: string; price: number }[];
  }>(
    '/trades/settle',
    { method: 'POST', headers: authHeader() },
  );

// ---------- workspace: notes, chat, CRM settings, activity ----------

export interface ApiNote {
  id: number; clientId: string; author: string; authorRole: string;
  text: string; createdAt: string;
}
export interface ApiMessage {
  id: number; threadId: number; fromStaff: boolean; author: string;
  text: string; createdAt: string;
}
export interface ApiActivity {
  id: number; actorName: string; actorRole: string; action: string;
  target: string; details: string; createdAt: string;
}

export const apiNotes = () =>
  request<{ notes: ApiNote[] }>('/workspace/notes', { headers: authHeader() });

export const apiAddNote = (clientId: string, text: string) =>
  request<{ ok: true; note: ApiNote }>('/workspace/notes', {
    method: 'POST', headers: authHeader(), body: JSON.stringify({ clientId, text }),
  });

/** Staff pass a clientId; a client omits it and gets their own thread. */
export const apiMessages = (clientId?: number) =>
  request<{ messages?: ApiMessage[]; threads?: ApiMessage[] }>(
    `/workspace/messages${clientId ? `?clientId=${clientId}` : ''}`,
    { headers: authHeader() },
  );

export const apiSendMessage = (text: string, clientId?: number) =>
  request<{ ok: true; message: ApiMessage }>('/workspace/messages', {
    method: 'POST', headers: authHeader(), body: JSON.stringify({ text, clientId }),
  });

export const apiCrmSettings = () =>
  request<{ settings: { hidePhonesFromAgents: boolean } }>('/workspace/crm-settings', {
    headers: authHeader(),
  });

export const apiSaveCrmSettings = (hidePhonesFromAgents: boolean) =>
  request<{ ok: true; settings: { hidePhonesFromAgents: boolean } }>('/workspace/crm-settings', {
    method: 'PUT', headers: authHeader(), body: JSON.stringify({ hidePhonesFromAgents }),
  });

export const apiClientStatuses = () =>
  request<{ statuses: Record<string, string> }>('/workspace/client-status', { headers: authHeader() });

export const apiSetClientStatus = (clientId: string, status: string) =>
  request<{ ok: true; statuses: Record<string, string> }>('/workspace/client-status', {
    method: 'PUT', headers: authHeader(), body: JSON.stringify({ clientId, status }),
  });

export const apiActivity = (target?: string) =>
  request<{ activity: ApiActivity[] }>(
    `/workspace/activity${target ? `?target=${encodeURIComponent(target)}` : ''}`,
    { headers: authHeader() },
  );

/** Any signed-in user updates their own profile (name / e-mail / phone) */
export const apiUpdateProfile = (data: { name: string; email: string; phone: string }) =>
  request<{ ok: true; user: ApiUser }>('/workspace/me', {
    method: 'PUT',
    headers: authHeader(),
    body: JSON.stringify(data),
  });

/** Any signed-in user changes their own password (current one required) */
export const apiChangeMyPassword = (currentPassword: string, newPassword: string) =>
  request<{ ok: true }>('/workspace/me/password', {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify({ currentPassword, newPassword }),
  });

// ---------- portfolio investments ----------

export const apiMyInvestments = () =>
  request<{ investments: any[] }>('/workspace/investments', { headers: authHeader() });

export const apiCreateInvestment = (data: Record<string, unknown>) =>
  request<{ ok: true; investment: any; balance: number }>('/workspace/investments', {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify(data),
  });

export const apiClaimInvestmentProfit = (id: number | string, profit?: number) =>
  request<{ ok: true; closed?: boolean; profit: number; payout?: number; balance: number }>(
    `/workspace/investments/${id}/claim`,
    {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({ profit }),
    },
  );

// ---------- statements ----------

export interface ApiStatement {
  client: { id: number; name: string; email: string };
  period: { from: string | null; to: string | null };
  computed: Record<string, number>;
  figures: Record<string, number>;
  overrides: Record<string, number | string>;
  notes: string;
  trades: {
    symbol: string; side: string; units: number; notional: number;
    entryPrice: number; exitPrice: number | null; pnl: number;
    status: string; openedAt: string; closedAt: string | null;
  }[];
  transactions: { type: string; amount: number; method: string; status: string; createdAt: string }[];
  issuedAt: string;
}

export const apiStatement = (userId: number, from?: string, to?: string) => {
  const qs = new URLSearchParams();
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);
  const suffix = qs.toString() ? `?${qs}` : '';
  return request<ApiStatement>(`/statements/${userId}${suffix}`, { headers: authHeader() });
};

export const apiSaveStatementOverrides = (userId: number, overrides: Record<string, unknown>) =>
  request<{ ok: true; overrides: Record<string, number | string> }>(
    `/statements/${userId}/override`,
    { method: 'PUT', headers: authHeader(), body: JSON.stringify({ overrides }) },
  );

// ---------- calls (WebRTC) ----------

export interface ApiCall {
  id: number; managerId: number; managerName: string;
  clientId: number; clientName: string; callerName: string;
  status: 'ringing' | 'active' | 'ended';
  whisperBy: number | null; whisperName?: string | null;
  screenShare: boolean; declined?: boolean;
  startedAt: string; answeredAt: string | null; endedAt: string | null;
  durationSec: number;
}

export interface ApiSignal {
  id: number; callId: number; from: number;
  role: string; kind: string; payload: string; createdAt: string;
}

export const apiIceServers = () =>
  request<{ iceServers: RTCIceServer[] }>('/calls/ice-servers', { headers: authHeader() });

export const apiStartCall = (clientId: number, callerName: string) =>
  request<{ ok: true; call: ApiCall }>('/calls', {
    method: 'POST', headers: authHeader(), body: JSON.stringify({ clientId, callerName }),
  });

export const apiCallInbox = () =>
  request<{ calls: ApiCall[] }>('/calls/inbox', { headers: authHeader() });

export const apiPostSignal = (
  callId: number,
  kind: string,
  payload: string,
  role: string,
  channel: 'main' | 'whisper' = 'main',
) =>
  request<{ ok: true; id: number }>(`/calls/${callId}/signal`, {
    method: 'POST', headers: authHeader(), body: JSON.stringify({ kind, payload, role, channel }),
  });

export const apiReadSignals = (callId: number, after: number, channel: 'main' | 'whisper' = 'main') =>
  request<{ signals: ApiSignal[]; lastId: number }>(
    `/calls/${callId}/signals?after=${after}&channel=${channel}`,
    { headers: authHeader() },
  );

export const apiCallStatus = (
  callId: number,
  status: 'active' | 'ended' | 'declined',
  extra?: { screenShare?: boolean },
) =>
  request<{ ok: true; call: ApiCall }>(`/calls/${callId}/status`, {
    method: 'POST', headers: authHeader(), body: JSON.stringify({ status, ...extra }),
  });

export const apiWhisper = (callId: number, join: boolean) =>
  request<{ ok: true; call: ApiCall }>(`/calls/${callId}/whisper`, {
    method: 'POST', headers: authHeader(), body: JSON.stringify({ join }),
  });

export const apiUploadRecording = (callId: number, data: string) =>
  request<{ ok: true }>(`/calls/${callId}/recording`, {
    method: 'POST', headers: authHeader(), body: JSON.stringify({ data }),
  });

export const apiCallLog = () =>
  request<{
    calls: (ApiCall & { hasRecording: boolean; missed?: boolean })[];
    stats: { total: number; answered: number; missed: number; declined: number; active: number; avgSec: number };
  }>('/calls/log', { headers: authHeader() });

/** Client asks the desk to call them (client cabinet, "Call manager" tab) */
export const apiRequestCall = () =>
  request<{ ok: true }>('/calls/request', { method: 'POST', headers: authHeader() });

export const apiCallRecording = (callId: number) =>
  request<{ data: string }>(`/calls/${callId}/recording`, { headers: authHeader() });

// ---------- live market data ----------

export const apiOrderBook = (symbol: string) =>
  request<{
    symbol: string;
    bids: { price: number; size: number }[];
    asks: { price: number; size: number }[];
    supported?: boolean;
    reason?: string;
  }>(
    `/symbols/orderbook?symbol=${encodeURIComponent(symbol)}`,
  );

export const apiCandles = (symbol: string, granularity = 3600) =>
  request<{
    symbol: string;
    granularity: number;
    candles: { time: number; open: number; high: number; low: number; close: number; volume: number }[];
  }>(`/symbols/candles?symbol=${encodeURIComponent(symbol)}&granularity=${granularity}`);

// ---------- analytics (computed from the database) ----------

export interface ApiAnalytics {
  clients: { total: number; active: number; pending: number; blocked: number; funded: number; ftd: number };
  money: { aum: number; deposits: number; withdrawals: number; net: number; avgDeposit: number; pendingRequests: number };
  trading: { total: number; open: number; pending: number; closed: number; winRate: number; volume: number; netPnl: number; profitFactor: number };
  calls: { total: number; answered: number; missed: number; answerRate: number; avgSec: number; recorded: number };
  leads: { total: number; byStage: Record<string, number>; potential: number };
  months: { month: string; key: string; deposits: number; count: number }[];
}

export const apiAnalytics = () =>
  request<ApiAnalytics>('/analytics/overview', { headers: authHeader() });

export interface ApiManagerStat {
  id: number; name: string; role: string; calls: number; answered: number;
  answerRate: number; talkTimeSec: number; leads: number; converted: number;
  actions: number; lastActive: string | null;
}

export const apiManagerStats = () =>
  request<{ managers: ApiManagerStat[] }>('/analytics/managers', { headers: authHeader() });

// ---------- lead import & duplicate control ----------

export const apiImportLeads = (
  rows: { name: string; phone?: string; email?: string; potentialAmount?: number; notes?: string }[],
  assignTo?: string[],
) =>
  request<{
    ok: true; imported: number;
    duplicates: { row: number; name: string; reason: string }[];
    invalid: { row: number; reason: string }[];
    message: string;
  }>('/leads/import', {
    method: 'POST', headers: authHeader(), body: JSON.stringify({ rows, assignTo }),
  });

export const apiCheckDuplicate = (phone?: string, email?: string) =>
  request<{ duplicate: { type: string; field: string; match: string } | null }>(
    '/leads/check-duplicate',
    { method: 'POST', headers: authHeader(), body: JSON.stringify({ phone, email }) },
  );

// ---------- web push ----------

export const apiPushKey = () =>
  request<{ enabled: boolean; publicKey: string }>('/push/key');

export const apiPushSubscribe = (subscription: PushSubscriptionJSON) =>
  request<{ ok: true; enabled: boolean }>('/push/subscribe', {
    method: 'POST', headers: authHeader(), body: JSON.stringify({ subscription }),
  });

export const apiPushSend = (userId: number, title: string, body: string) =>
  request<{ ok: true; sent: number; message: string }>('/push/send', {
    method: 'POST', headers: authHeader(), body: JSON.stringify({ userId, title, body }),
  });
