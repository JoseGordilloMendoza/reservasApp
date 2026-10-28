import { CaretRight } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { Link } from "react-router-dom";

export interface MenuEntry {
  to: string;
  label: string;
  hint: string;
  icon: Icon;
}

/** Big tappable rows that lead to a section. */
export function MenuList({ entries }: { entries: MenuEntry[] }) {
  return (
    <ul className="grid gap-3">
      {entries.map(({ to, label, hint, icon: Glyph }) => (
        <li key={to}>
          <Link
            to={to}
            className="press flex items-center gap-4 rounded-box border-[3px] border-line bg-surface p-4 text-text shadow-hard-sm"
          >
            <Glyph aria-hidden="true" size={28} className="shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block font-display text-xl font-extrabold leading-tight">{label}</span>
              <span className="block text-sm text-muted">{hint}</span>
            </span>
            <CaretRight aria-hidden="true" className="shrink-0" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
