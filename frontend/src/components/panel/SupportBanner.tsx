import { Lifebuoy } from "@phosphor-icons/react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../lib/auth";
import { formatTime } from "../../lib/dates";
import { useEndSupport } from "../../lib/platformQueries";
import { Button } from "../Button";

// The team works on Lima time, whatever the business it is helping.
const ZONE = "America/Lima";

/**
 * A bar that cannot be missed while the platform team is inside a business for support.
 * Whoever is in must always know it is not their own account, and when it ends.
 */
export function SupportBanner() {
  const auth = useAuth();
  const navigate = useNavigate();
  const end = useEndSupport();
  const support = auth.support;

  function leave() {
    auth.leaveSupport();
    navigate("/plataforma", { replace: true });
  }

  // The session runs out by itself: step out when it does, rather than leave a panel that no longer answers.
  const expiresAt = support?.expires_at;
  useEffect(() => {
    if (!expiresAt) return;
    const wait = Date.parse(expiresAt) - Date.now();
    const timer = window.setTimeout(leave, Math.max(wait, 0));
    return () => window.clearTimeout(timer);
  }, [expiresAt]);

  if (!support) return null;

  return (
    <div role="status" className="sticky top-0 z-40 border-b-[3px] border-line bg-line text-paper">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 md:px-6">
        <Lifebuoy aria-hidden="true" size={22} weight="bold" className="shrink-0" />
        <p className="min-w-0 flex-1 text-sm font-semibold">
          Sesión de soporte en {support.name}. Vence a las {formatTime(support.expires_at, ZONE)}. Cada cambio queda registrado.
        </p>
        <Button
          variant="primary"
          className="min-h-[44px] px-4 py-2 text-base"
          disabled={end.isPending}
          onClick={() => end.mutate(support.session, { onSettled: leave })}
        >
          Terminar soporte
        </Button>
      </div>
    </div>
  );
}
