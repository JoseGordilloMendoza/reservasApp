import { CalendarCheck, MagnifyingGlass, Ticket } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

import { BusinessDirectory } from "../components/BusinessDirectory";
import { Favorites } from "../components/Favorites";
import { ForBusinesses } from "../components/ForBusinesses";
import { HomeHero } from "../components/HomeHero";
import { Promises } from "../components/Promises";
import type { Accent } from "../lib/types";

const STEPS: { number: string; icon: Icon; accent: Accent; title: string; text: string }[] = [
  { number: "1", icon: MagnifyingGlass, accent: "sky", title: "Elige tu negocio", text: "Busca por nombre o abre el link que te dieron." },
  { number: "2", icon: CalendarCheck, accent: "mint", title: "Reserva tu hora", text: "Escoge el horario y deja tu celular. Sin cuenta." },
  { number: "3", icon: Ticket, accent: "sunflower", title: "Llega y listo", text: "Muestra tu boleto en el local y confirma tu lugar." },
];

/** Three plain steps, each in its own card with its own color, so a first visit reads at a glance. */
function HowItWorks() {
  return (
    <section aria-labelledby="how-title" className="mt-20">
      <h2 id="how-title" className="font-display text-3xl font-bold leading-tight tracking-[-0.02em] md:text-4xl">
        Así de fácil
      </h2>
      <ol className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
        {STEPS.map(({ number, icon: Glyph, accent, title, text }) => (
          <li key={number} data-accent={accent} className="relative overflow-hidden rounded-box border border-edge bg-surface p-6 shadow-card-sm">
            <span aria-hidden="true" className="absolute -right-6 -top-6 size-28 rounded-full bg-accent-soft" />
            <span className="relative flex items-center gap-3">
              <span aria-hidden="true" className="grid size-12 place-items-center rounded-2xl bg-accent text-on-accent shadow-card-sm">
                <Glyph size={26} weight="bold" />
              </span>
              <span className="font-mono text-sm font-bold text-muted">Paso {number}</span>
            </span>
            <h3 className="relative mt-4 font-display text-xl font-bold leading-tight">{title}</h3>
            <p className="relative mt-1 text-muted">{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function HomePage() {
  return (
    <>
      <HomeHero />
      <Promises />
      <Favorites />
      <BusinessDirectory />
      <HowItWorks />
      <ForBusinesses />
    </>
  );
}
