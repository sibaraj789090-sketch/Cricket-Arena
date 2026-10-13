/**
 * Secure Client-Side Administrator Authentication & Session Management
 * Coordinates cryptographic tokens with the server to protect administrative endpoints.
 */

const ADMIN_TOKEN_KEY = 'cricket_arena_admin_session_token';
const ADMIN_EMAIL_KEY = 'cricket_arena_admin_session_email';

export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function getAdminEmail(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ADMIN_EMAIL_KEY);
}

export function setAdminSession(token: string, email: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
  localStorage.setItem(ADMIN_EMAIL_KEY, email);
}

export function clearAdminSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_EMAIL_KEY);
}

export function getAdminHeaders(): Record<string, string> {
  const token = getAdminToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['x-admin-session-token'] = token;
  }
  return headers;
}

/**
 * Authoritative fetch wrapper that automatically attaches the admin session token
 */
export async function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = getAdminToken();
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('x-admin-session-token', token);
  }
  return fetch(input, {
    ...init,
    headers,
  });
}

/**
 * Validates the current admin session with the server
 */
export async function verifyAdminSession(): Promise<{ authenticated: boolean; email?: string }> {
  const token = getAdminToken();
  if (!token) {
    return { authenticated: false };
  }

  try {
    const res = await fetch('/api/admin/auth/check', {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-admin-session-token': token,
      },
    });

    if (res.ok) {
      const data = await res.json();
      return { authenticated: Boolean(data.authenticated), email: data.email };
    }
  } catch (err) {
    console.warn('Admin session check error:', err);
  }

  clearAdminSession();
  return { authenticated: false };
}
