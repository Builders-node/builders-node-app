// Normalize the base URL: strip trailing slashes and dots so a mistyped
// VITE_API_BASE_URL like "https://api.example.com/" or "...example.com."
// doesn't produce a broken request URL.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/[/.]+$/, '');

/** Error carrying the HTTP status so callers can react to 401/404 (e.g. stale session). */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const SESSION_KEYS = ['terminus_access_token', 'terminus_user_id', 'terminus_user_role', 'terminus_user_label'];

function clearSession() {
  SESSION_KEYS.forEach((key) => localStorage.removeItem(key));
}

/**
 * True if a JWT is expired (or unparseable). Used on boot to drop a dead session
 * before it triggers a broken authenticated request.
 */
export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? ''));
    if (typeof payload.exp !== 'number') return false;
    return payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

/**
 * `options.signal` is honoured, which is what lets React Query cancel a request
 * that's been superseded — a slow earlier response can no longer overwrite a
 * newer one (the directory search used to do exactly that).
 */
export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('terminus_access_token');
  // `headers` after the spread, not before it: an options object carrying its
  // own headers used to replace this merged one wholesale, silently dropping
  // the Authorization header the line above just built.
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    // A 401 on a request we *authenticated* means the session is dead/expired —
    // clear it and let the app react globally. (A 401 with no token is an
    // ordinary auth failure, e.g. wrong password, and must NOT force a logout.)
    if (response.status === 401 && token) {
      clearSession();
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    throw new ApiError(body.message ?? 'Request failed. Please try again.', response.status);
  }

  return response.json() as Promise<T>;
}
