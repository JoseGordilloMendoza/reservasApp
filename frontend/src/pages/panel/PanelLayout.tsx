import { CalendarX, DotsThree, Gear, House, IconContext, ListChecks, Plus, SignOut, Users, WarningCircle } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../../lib/auth";
import { BRAND } from "../../lib/brand";
import { usePanelBusiness } from "../../lib/panelQueries";
import { useAccent } from "../../lib/queries";

interface Item {
  to: string;
  label: string;
  icon: Icon;
  end?: boolean;
  /** The main action of the panel gets the loudest tab. */
  highlight?: boolean;
  /** Where it shows up: the phone has room for four tabs, the sidebar for everything. */
  only?: "phone" | "desktop";
  /** Other sections that should light this tab up too. */
  covers?: string[];
}

const MORE_SECTIONS = ["/panel/clientes", "/panel/bloqueos", "/panel/ajustes"];

const ITEMS: Item[] = [
  { to: "/panel", label: "Inicio", icon: House, end: true },
  { to: "/panel/reservas/nueva", label: "Anotar", icon: Plus, highlight: true },
  { to: "/panel/reservas", label: "Reservas", icon: ListChecks, end: true },
  { to: "/panel/clientes", label: "Clientes", icon: Users, only: "desktop" },
  { to: "/panel/bloqueos", label: "Bloqueos", icon: CalendarX, only: "desktop" },
  { to: "/panel/ajustes", label: "Ajustes", icon: Gear, only: "desktop" },
  { to: "/panel/mas", label: "Más", icon: DotsThree, only: "phone", covers: MORE_SECTIONS },
];

const VISIBLE = { phone: "md:hidden", desktop: "max-md:hidden" } as const;

function tabClass({ isActive }: { isActive: boolean }, highlight?: boolean) {
  const base =
    "press flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-box border-[3px] border-line " +
    "px-2 py-1 font-display text-sm font-bold leading-none md:flex-row md:justify-start md:gap-3 md:px-4 md:text-lg ";
  if (highlight) return base + "bg-accent text-on-accent shadow-hard-sm";
  return base + (isActive ? "bg-line text-paper" : "bg-surface text-text shadow-hard-sm");
}

export function PanelLayout() {
  const auth = useAuth();
  const business = usePanelBusiness();
  useAccent(business.data?.accent);

  const path = useLocation().pathname;
  const memberships = auth.user?.memberships ?? [];
  const current = auth.membership;

  return (
    <IconContext.Provider value={{ weight: "bold", size: 22 }}>
      <div className="mx-auto min-h-dvh max-w-[1120px] md:grid md:grid-cols-[15rem_1fr] md:gap-8 md:px-6">
        <aside className="relative px-4 pt-4 md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:px-0 md:py-6">
          <p className="flex items-center gap-2 font-display text-xl font-extrabold uppercase tracking-tight">
            <span
              aria-hidden="true"
              className="grid size-8 -rotate-6 place-items-center rounded-[8px] border-[3px] border-line bg-accent text-on-accent shadow-hard-sm"
            >
              S
            </span>
            {BRAND}
          </p>

          <div className="mt-4 min-w-0">
            {memberships.length > 1 ? (
              <label className="grid gap-1 text-sm font-semibold">
                Negocio
                <select
                  value={current?.business.slug}
                  onChange={(event) => auth.selectBusiness(event.target.value)}
                  className="min-h-[44px] rounded-box border-[3px] border-line bg-surface px-3 font-display text-base font-bold text-text"
                >
                  {memberships.map((membership) => (
                    <option key={membership.business.slug} value={membership.business.slug}>
                      {membership.business.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="truncate font-display text-lg font-bold leading-tight">{current?.business.name}</p>
            )}
          </div>

          <nav aria-label="Panel" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 gap-3 border-t-[3px] border-line bg-paper px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 md:static md:mt-8 md:grid-cols-1 md:border-0 md:bg-transparent md:p-0">
            {ITEMS.map(({ to, label, icon: Glyph, end, highlight, only, covers }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `${tabClass({ isActive: isActive || !!covers?.some((prefix) => path.startsWith(prefix)) }, highlight)} ${only ? VISIBLE[only] : ""}`
                }
              >
                <Glyph aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => void auth.logout()}
            className="absolute right-4 top-4 inline-flex min-h-[44px] items-center gap-2 rounded-box px-2 font-display text-sm font-bold underline decoration-[3px] underline-offset-4 md:static md:mt-auto md:justify-start md:px-0"
          >
            <SignOut aria-hidden="true" size={18} />
            Salir
          </button>
        </aside>

        <main className="min-w-0 px-4 pb-32 pt-6 md:max-w-[46rem] md:px-0 md:pb-16 md:pt-6">
          {business.data?.status === "suspended" && (
            <p role="status" className="mb-6 flex items-start gap-3 rounded-box border-[3px] border-danger p-4 font-semibold text-danger">
              <WarningCircle aria-hidden="true" className="mt-0.5 shrink-0" />
              Tu negocio está suspendido: no recibe reservas nuevas. Puedes seguir viendo tus datos.
            </p>
          )}
          <Outlet />
        </main>
      </div>
    </IconContext.Provider>
  );
}
