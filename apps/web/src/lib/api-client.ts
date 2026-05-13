/**
 * Typed fetch client for the Pic Shift API.
 *
 * Token management:
 *   - Access token is held in memory only (XSS-resistant).
 *   - Refresh token is persisted in localStorage. On 401 we attempt a refresh
 *     once; if that fails the user is logged out.
 *
 * Why localStorage for the refresh token (and not httpOnly cookies):
 *   - We're targeting Cloudflare + nginx for the SaaS frontend, with the API
 *     on a sub-domain. CSRF-via-cookies is harder to defend in that topology
 *     than XSS-via-localStorage when paired with a strict CSP and a Content
 *     Security Policy that disallows inline scripts. Either choice is fine
 *     if you do the rest of the security hygiene; we picked localStorage so
 *     the API can stay stateless and the frontend can be a CDN-cached SPA.
 */

const API_BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");

const REFRESH_KEY = "picshift.refresh";

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
let onLogoutCb: (() => void) | null = null;

export function setOnLogout(cb: () => void): void {
  onLogoutCb = cb;
}

export function setTokens(access: string | null, refresh: string | null): void {
  accessToken = access;
  if (refresh === null) {
    localStorage.removeItem(REFRESH_KEY);
  } else {
    localStorage.setItem(REFRESH_KEY, refresh);
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function clearTokens(): void {
  accessToken = null;
  localStorage.removeItem(REFRESH_KEY);
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
  requestId?: string;
}

export class ApiClientError extends Error {
  status: number;
  code: string;
  details: unknown;
  requestId: string | undefined;
  constructor(status: number, body: ApiErrorBody) {
    super(body.error?.message ?? `HTTP ${status}`);
    this.status = status;
    this.code = body.error?.code ?? "UNKNOWN";
    this.details = body.error?.details;
    this.requestId = body.requestId;
  }
}

async function refreshAccess(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!refresh) return null;

  refreshPromise = (async () => {
    const res = await fetch(`${API_BASE}/v1/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!res.ok) {
      clearTokens();
      onLogoutCb?.();
      return null;
    }
    const data = (await res.json()) as { tokens: { accessToken: string; refreshToken: string } };
    setTokens(data.tokens.accessToken, data.tokens.refreshToken);
    return data.tokens.accessToken;
  })()
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Set to true to skip auth header (used by /auth endpoints). */
  unauthenticated?: boolean;
}

export async function apiRequest<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined) url.searchParams.append(k, String(v));
    }
  }
  const headers: Record<string, string> = { accept: "application/json" };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (!opts.unauthenticated && accessToken) headers.authorization = `Bearer ${accessToken}`;

  const doFetch = async (): Promise<Response> =>
    fetch(url.toString(), {
      method: opts.method ?? "GET",
      headers,
      ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
    });

  let res = await doFetch();

  if (res.status === 401 && !opts.unauthenticated) {
    const newToken = await refreshAccess();
    if (newToken) {
      headers.authorization = `Bearer ${newToken}`;
      res = await doFetch();
    }
  }

  if (!res.ok) {
    let body: ApiErrorBody;
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      body = { error: { code: "UNKNOWN", message: res.statusText } };
    }
    throw new ApiClientError(res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Typed endpoint helpers
// ---------------------------------------------------------------------------

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
}

export interface LoginResponse {
  status: "authenticated" | "mfa_required";
  tokens?: AuthTokens;
  mfaChallengeId?: string;
  user?: { id: string; email: string; fullName: string; orgId: string; mfaEnrolled: boolean };
}

export const api = {
  auth: {
    signup: (body: {
      email: string;
      password: string;
      fullName: string;
      organizationName: string;
      country: "GH" | "NG";
      acceptedTerms: true;
      acceptedPrivacy: true;
    }) =>
      apiRequest<{ user: { id: string; email: string }; organization: { id: string; slug: string }; tokens: AuthTokens }>(
        "/v1/auth/signup",
        { method: "POST", body, unauthenticated: true },
      ),
    login: (email: string, password: string) =>
      apiRequest<LoginResponse>("/v1/auth/login", {
        method: "POST",
        body: { email, password },
        unauthenticated: true,
      }),
    verifyMfa: (challengeId: string, totp: string) =>
      apiRequest<{ status: "authenticated"; tokens: AuthTokens }>("/v1/auth/mfa/verify", {
        method: "POST",
        body: { challengeId, totp },
        unauthenticated: true,
      }),
    enrollMfa: () =>
      apiRequest<{ otpauthUri: string; qrPngDataUrl: string }>("/v1/auth/mfa/enroll", {
        method: "POST",
      }),
    enrollMfaVerify: (totp: string) =>
      apiRequest<{ ok: true }>("/v1/auth/mfa/enroll/verify", {
        method: "POST",
        body: { totp },
      }),
    logout: () => {
      const refresh = localStorage.getItem(REFRESH_KEY);
      return apiRequest<{ ok: true }>("/v1/auth/logout", {
        method: "POST",
        body: { refreshToken: refresh ?? "" },
      });
    },
    me: () =>
      apiRequest<{ user: { id: string; org: string; roles: string[]; mfa: boolean } }>("/v1/auth/me"),
  },
  employees: {
    list: (q: { page?: number; pageSize?: number; q?: string; status?: string; department?: string } = {}) =>
      apiRequest<{ items: unknown[]; total: number; page: number; pageSize: number }>("/v1/employees", { query: q }),
    get: (id: string) => apiRequest<{ employee: unknown }>(`/v1/employees/${id}`),
    create: (body: Record<string, unknown>) =>
      apiRequest<{ employee: unknown }>("/v1/employees", { method: "POST", body }),
  },
  pto: {
    policies: () => apiRequest<{ policies: unknown[] }>("/v1/pto/policies"),
    request: (body: { employeeId: string; policyId: string; startDate: string; endDate: string; reason?: string }) =>
      apiRequest<{ request: unknown }>("/v1/pto/requests", { method: "POST", body }),
    list: (q: { employeeId?: string; status?: string } = {}) =>
      apiRequest<{ requests: unknown[] }>("/v1/pto/requests", { query: q }),
    decide: (id: string, body: { decision: "approve" | "reject"; note?: string }) =>
      apiRequest<{ request: unknown }>(`/v1/pto/requests/${id}/decision`, { method: "POST", body }),
    balances: (employeeId: string) => apiRequest<{ balances: unknown[] }>(`/v1/pto/balances/${employeeId}`),
  },
  shifts: {
    list: (q: { status?: string; from?: string; to?: string; assignedTo?: string } = {}) =>
      apiRequest<{ shifts: unknown[] }>("/v1/shifts", { query: q }),
    create: (body: { title: string; description?: string; startTime: string; endTime: string; location?: string }) =>
      apiRequest<{ shift: unknown }>("/v1/shifts", { method: "POST", body }),
    claim: (id: string) => apiRequest<{ shift: unknown }>(`/v1/shifts/${id}/claim`, { method: "POST" }),
    delete: (id: string) => apiRequest<void>(`/v1/shifts/${id}`, { method: "DELETE" }),
  },
  documents: {
    list: (q: { employeeId?: string; category?: string } = {}) =>
      apiRequest<{ documents: unknown[] }>("/v1/documents", { query: q }),
    download: (id: string) => apiRequest<{ url: string; filename: string; contentType: string }>(
      `/v1/documents/${id}/download`,
    ),
  },
  audit: {
    list: (q: Record<string, string | number | undefined> = {}) =>
      apiRequest<{ items: unknown[]; total: number; page: number; pageSize: number }>("/v1/audit", { query: q }),
  },
  ai: {
    ask: (question: string) =>
      apiRequest<{ answer: string; model: string }>("/v1/ai/ask", { method: "POST", body: { question } }),
  },
};
