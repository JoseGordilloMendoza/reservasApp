import { IconContext, Ticket } from "@phosphor-icons/react";
import { Link, Outlet } from "react-router-dom";

import { BRAND } from "../lib/brand";

/** The small mark of the platform: a stamped S next to the name. */
function Logotype() {
  return (
    <Link to="/" className="inline-flex items-center gap-2 font-display text-xl font-extrabold uppercase tracking-tight">
      <span
        aria-hidden="true"
        className="grid size-8 -rotate-6 place-items-center rounded-[8px] border-[3px] border-line bg-accent text-on-accent shadow-hard-sm"
      >
        S
      </span>
      {BRAND}
    </Link>
  );
}

export function Layout() {
  return (
    <IconContext.Provider value={{ weight: "bold", size: 20 }}>
      <div className="mx-auto flex min-h-dvh max-w-[1120px] flex-col px-4 sm:px-6">
        <header className="flex h-16 items-center justify-between">
          <Logotype />
          <Link
            to="/mis-reservas"
            className="inline-flex items-center gap-2 rounded-box px-2 py-2 font-display text-base font-bold underline decoration-[3px] underline-offset-4 hover:decoration-accent"
          >
            <Ticket aria-hidden="true" />
            Mis reservas
          </Link>
        </header>

        <main className="flex-1 pb-28 md:pb-16">
          <Outlet />
        </main>

        <footer className="pb-24 pt-6 text-sm text-muted md:pb-8">
          Reservas hechas con <span className="font-bold text-text">{BRAND}</span>
        </footer>
      </div>
    </IconContext.Provider>
  );
}
