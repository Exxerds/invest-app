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
        'wait for the line "TradeNation API server running", then try again.',
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
  request<{ ok: true; message: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
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
