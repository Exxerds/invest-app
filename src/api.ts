// ============================================================
//  API client — frontend talks to the server via /api
//  (Vite proxies /api → http://localhost:4000)
// ============================================================

export interface ApiUser {
  id: number;
  name: string;
  email: string;
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
  status: 'OPEN' | 'CLOSED';
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

export const apiOpenTrade = (data: Partial<ApiTrade> & { symbol: string; amount: number }) =>
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
  request<{ ok: true; trade: ApiTrade }>(`/trades/${id}/close`, {
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
