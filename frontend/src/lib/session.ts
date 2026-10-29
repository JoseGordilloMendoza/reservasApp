import { ApiError, request } from "./http";
import type { Session } from "./panelTypes";

// The access token lives only in memory and lasts minutes. The refresh token is kept so a
// reload does not sign the owner out; it is rotated every time it is used.

const REFRESH_KEY = "separa.panel.refresh.v1";
const BUSINESS_KEY = "separa.panel.business.v1";
const SUPPORT_KEY = "separa.support.v1";

let accessToken: string | null = null;
let inFlight: Promise<string | null> | null = null;
const listeners = new Set<() => void>();

function storage<T>(action: () => T, fallback: T): T {
  try {
    return action();
  } catch {
    // Storage can be blocked (private mode).
    return fallback;
  }
}

export const getAccessToken = () => accessToken;
export const getRefreshToken = () => storage(() => localStorage.getItem(REFRESH_KEY), null);

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  storage(() => localStorage.setItem(REFRESH_KEY, refresh), undefined);
}

export function getBusinessSlug(): string | null {
  return storage(() => localStorage.getItem(BUSINESS_KEY), null);
}

export function setBusinessSlug(slug: string | null) {
  storage(() => (slug ? localStorage.setItem(BUSINESS_KEY, slug) : localStorage.removeItem(BUSINESS_KEY)), undefined);
}

/** A support session: the platform team working inside one business, until it expires. */
export interface SupportInfo {
  session: number;
  slug: string;
  name: string;
  reason: string;
  /** ISO instant. */
  expires_at: string;
}

/** The stored support session, or null if there is none or it already ran out. */
export function getSupport(now: number = Date.now()): SupportInfo | null {
  return storage(() => {
    const raw = localStorage.getItem(SUPPORT_KEY);
    if (!raw) return null;
    const info = JSON.parse(raw) as SupportInfo;
    return Date.parse(info.expires_at) > now ? info : null;
  }, null);
}

export function setSupport(info: SupportInfo | null) {
  storage(() => (info ? localStorage.setItem(SUPPORT_KEY, JSON.stringify(info)) : localStorage.removeItem(SUPPORT_KEY)), undefined);
}

/** Forget the session and tell everyone listening (the UI goes back to the login page). */
export function clearSession() {
  accessToken = null;
  storage(() => localStorage.removeItem(REFRESH_KEY), undefined);
  // Support is a permission of this sign-in; it must not outlive it.
  setSupport(null);
  listeners.forEach((listener) => listener());
}

export function onSessionLost(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Get a fresh access token. Rotation invalidates the refresh token on use, so concurrent
 * callers must share one request: a second one would present an already used token.
 */
export function refreshAccess(): Promise<string | null> {
  if (inFlight) return inFlight;

  const refresh = getRefreshToken();
  if (!refresh) return Promise.resolve(null);

  inFlight = request<{ access: string; refresh?: string }>("/auth/refresh/", {
    method: "POST",
    body: JSON.stringify({ refresh }),
  })
    .then((tokens) => {
      setTokens(tokens.access, tokens.refresh ?? refresh);
      return tokens.access;
    })
    .catch((error: unknown) => {
      // Only a refusal ends the session; a dropped connection must not sign anyone out.
      if (error instanceof ApiError && error.status === 0) throw error;
      clearSession();
      return null;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

export function startSession(session: Session) {
  setTokens(session.access, session.refresh);
}
