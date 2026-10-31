import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { ApiError } from "./http";
import { panelApi } from "./panelApi";
import type { Membership, Session, SessionUser } from "./panelTypes";
import {
  clearSession,
  getBusinessSlug,
  getRefreshToken,
  getSupport,
  onSessionLost,
  setBusinessSlug,
  setSupport,
  startSession,
} from "./session";
import type { SupportInfo } from "./session";

type Status = "loading" | "anonymous" | "authenticated";

interface AuthValue {
  status: Status;
  user: SessionUser | null;
  /** The business the owner is working on. */
  membership: Membership | null;
  /** Set while the platform team is working inside a business. */
  support: SupportInfo | null;
  startSupport: (info: SupportInfo) => void;
  leaveSupport: () => void;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  logout: () => Promise<void>;
  selectBusiness: (slug: string) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

/** The stored business if the user still belongs to it, otherwise their first one. */
function chooseBusiness(user: SessionUser): string | null {
  // The team member inside a business for support works on that one, even without belonging to it.
  const support = user.is_platform_admin ? getSupport() : null;
  if (support) return support.slug;

  const stored = getBusinessSlug();
  const slugs = user.memberships.map((membership) => membership.business.slug);
  return stored && slugs.includes(stored) ? stored : (slugs[0] ?? null);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [support, setSupportState] = useState<SupportInfo | null>(null);
  const [status, setStatus] = useState<Status>(() => (getRefreshToken() ? "loading" : "anonymous"));

  const apply = useCallback((next: SessionUser) => {
    const chosen = chooseBusiness(next);
    setBusinessSlug(chosen);
    setSlug(chosen);
    setSupportState(next.is_platform_admin ? getSupport() : null);
    setUser(next);
    setStatus("authenticated");
  }, []);

  const leave = useCallback(() => {
    setUser(null);
    setSlug(null);
    setSupportState(null);
    setStatus("anonymous");
    queryClient.clear();
  }, [queryClient]);

  // A reload keeps the refresh token, so pick the session up again.
  useEffect(() => {
    if (!getRefreshToken()) return;
    let current = true;
    panelApi
      .me()
      .then((me) => current && apply(me))
      .catch((error: unknown) => {
        // A lost connection keeps the stored session for the next try.
        if (current && !(error instanceof ApiError && error.status === 0)) leave();
        else if (current) setStatus("anonymous");
      });
    return () => {
      current = false;
    };
  }, [apply, leave]);

  // The client gives up on the session when it cannot be renewed.
  useEffect(() => onSessionLost(leave), [leave]);

  const open = useCallback(
    (session: Session) => {
      startSession(session);
      queryClient.clear();
      apply(session.user);
    },
    [apply, queryClient],
  );

  const value = useMemo<AuthValue>(
    () => ({
      status,
      user,
      membership:
        user?.memberships.find((item) => item.business.slug === slug) ??
        // Inside a business for support: the same powers as its owner, for as long as the session lasts.
        (support && support.slug === slug
          ? { business: { name: support.name, slug: support.slug, status: "active" as const }, role: "owner" as const }
          : null),
      support,
      startSupport: (info) => {
        setSupport(info);
        setBusinessSlug(info.slug);
        setSlug(info.slug);
        setSupportState(info);
        queryClient.clear();
      },
      leaveSupport: () => {
        setSupport(null);
        setBusinessSlug(null);
        setSlug(null);
        setSupportState(null);
        queryClient.clear();
      },
      login: async (email, password) => open(await panelApi.login(email, password)),
      loginWithGoogle: async (credential) => open(await panelApi.loginWithGoogle(credential)),
      changePassword: async (current, next) => open(await panelApi.changePassword(current, next)),
      logout: async () => {
        const refresh = getRefreshToken();
        if (refresh) await panelApi.logout(refresh).catch(() => undefined);
        clearSession();
      },
      selectBusiness: (next) => {
        setBusinessSlug(next);
        setSlug(next);
        queryClient.clear();
      },
    }),
    [status, user, slug, support, open, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
