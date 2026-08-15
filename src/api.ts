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
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    // Сеть недоступна → сервер (npm run dev) скорее всего не запущен
    throw new Error('Cannot reach the server. Make sure you ran «npm run dev» and the terminal shows "API server running".');
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
