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
  onSessionLost,
  setBusinessSlug,
  startSession,
} from "./session";

type Status = "loading" | "anonymous" | "authenticated";

interface AuthValue {
  status: Status;
  user: SessionUser | null;
  /** The business the owner is working on. */
  membership: Membership | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
  selectBusiness: (slug: string) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

/** The stored business if the user still belongs to it, otherwise their first one. */
function chooseBusiness(user: SessionUser): string | null {
  const stored = getBusinessSlug();
  const slugs = user.memberships.map((membership) => membership.business.slug);
  return stored && slugs.includes(stored) ? stored : (slugs[0] ?? null);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(() => (getRefreshToken() ? "loading" : "anonymous"));

  const apply = useCallback((next: SessionUser) => {
    const chosen = chooseBusiness(next);
    setBusinessSlug(chosen);
    setSlug(chosen);
    setUser(next);
    setStatus("authenticated");
  }, []);

  const leave = useCallback(() => {
    setUser(null);
    setSlug(null);
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
      membership: user?.memberships.find((item) => item.business.slug === slug) ?? null,
      login: async (email, password) => open(await panelApi.login(email, password)),
      loginWithGoogle: async (credential) => open(await panelApi.loginWithGoogle(credential)),
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
    [status, user, slug, open, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
