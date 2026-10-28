import { CalendarX, CaretRight, Gear, Users } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { Link } from "react-router-dom";

const SECTIONS: { to: string; label: string; hint: string; icon: Icon }[] = [
  { to: "/panel/clientes", label: "Clientes", hint: "Quién reserva, su historial y bloqueos", icon: Users },
  { to: "/panel/bloqueos", label: "Bloqueos", hint: "Cierra un día o un horario", icon: CalendarX },
  { to: "/panel/ajustes", label: "Ajustes", hint: "Tu página, reglas, servicios y horarios", icon: Gear },
];

/** The sections that do not fit in the phone's tab bar. */
export function MorePage() {
  return (
    <div className="grid gap-6">
      <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.9] tracking-[-0.03em]">Más</h1>
      <ul className="grid gap-3">
        {SECTIONS.map(({ to, label, hint, icon: Glyph }) => (
          <li key={to}>
            <Link
              to={to}
              className="press flex items-center gap-4 rounded-box border-[3px] border-line bg-surface p-4 text-text shadow-hard-sm"
            >
              <Glyph aria-hidden="true" size={28} />
              <span className="min-w-0 flex-1">
                <span className="block font-display text-xl font-extrabold leading-tight">{label}</span>
                <span className="block text-sm text-muted">{hint}</span>
              </span>
              <CaretRight aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
