import { HandCoins, PhoneSlash, Ticket, UserCircleDashed } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

import type { Accent } from "../lib/types";

/**
 * What MiReserva promises whoever books, each one true today. No made-up numbers, ratings or distances: those
 * come when they are real (D121).
 */
const PROMISES: { icon: Icon; accent: Accent; title: string; text: string }[] = [
  { icon: UserCircleDashed, accent: "sky", title: "Sin cuenta", text: "Reservas con tu nombre y tu celular." },
  { icon: PhoneSlash, accent: "mint", title: "Sin llamadas", text: "Ves los horarios libres y eliges." },
  { icon: Ticket, accent: "sunflower", title: "Boleto al instante", text: "Con un código para mostrar al llegar." },
  { icon: HandCoins, accent: "rose", title: "Sin cobros extra", text: "MiReserva no te cobra. Pagas directo al negocio." },
];

export function Promises() {
  return (
    <section aria-label="Lo que te prometemos" className="mt-8">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PROMISES.map(({ icon: Glyph, accent, title, text }) => (
          <li key={title} className="flex items-start gap-3 rounded-box border border-edge bg-surface p-4 shadow-card-sm">
            <span aria-hidden="true" data-accent={accent} className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-on-accent">
              <Glyph size={24} weight="bold" />
            </span>
            <span className="grid gap-0.5">
              <span className="font-display text-base font-bold leading-tight">{title}</span>
              <span className="text-sm text-muted">{text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
