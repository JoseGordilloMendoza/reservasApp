import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../lib/auth";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";

/** Lets the panel through only when someone is signed in and has a business to work on. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === "loading") {
    return (
      <div className="mx-auto grid max-w-[28rem] gap-4 px-4 py-10" aria-busy="true" aria-label="Cargando">
        <Skeleton className="h-24" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (auth.status === "anonymous") {
    return <Navigate to="/panel/entrar" replace state={{ from: location.pathname }} />;
  }

  // A temporary password has to be replaced before anything else.
  if (auth.user?.must_change_password) {
    return <Navigate to="/panel/cambiar-contrasena" replace />;
  }

  // The platform team has no business of its own: its home is the team area.
  if (!auth.membership && auth.user?.is_platform_admin) {
    return <Navigate to="/plataforma" replace />;
  }

  if (!auth.membership) {
    return (
      <div className="mx-auto grid min-h-dvh max-w-[28rem] content-center gap-4 px-4 py-10">
        <div className="grid gap-4 rounded-box border-[3px] border-line bg-surface p-6 text-text shadow-hard">
          <h1 className="font-display text-3xl font-extrabold leading-tight">Esta cuenta no tiene un negocio</h1>
          <p className="text-muted">
            Entraste como {auth.user?.email}, pero no está asociada a ningún negocio. Pide que te den de alta.
          </p>
          <Button variant="ink" onClick={() => void auth.logout()}>
            Salir
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
