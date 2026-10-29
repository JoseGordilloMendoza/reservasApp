import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../../lib/auth";
import { buttonClass } from "../Button";
import { Skeleton } from "../Skeleton";

/** Lets only the platform team into /plataforma. Business owners are told it is not for them. */
export function RequirePlatform({ children }: { children: ReactNode }) {
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

  if (!auth.user?.is_platform_admin) {
    return (
      <div className="mx-auto grid min-h-dvh max-w-[28rem] content-center gap-4 px-4 py-10">
        <div className="grid gap-4 rounded-box border-[3px] border-line bg-surface p-6 text-text shadow-hard">
          <h1 className="font-display text-3xl font-extrabold leading-tight">Esta sección es solo para el equipo</h1>
          <p className="text-muted">Tu cuenta no tiene acceso a la administración de la plataforma.</p>
          <Link to="/panel" className={buttonClass("primary")}>
            Ir a mi panel
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
