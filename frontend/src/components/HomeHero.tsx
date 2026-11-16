import { ArrowRight, CheckCircle, SoccerBall } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";

import { BusinessSearch } from "./BusinessSearch";
import { HeroScene } from "./IsoArt";

const OUTLINE_ON_BLUE =
  "press inline-flex min-h-[48px] items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-white/60 " +
  "px-5 py-3 font-display text-base font-semibold leading-none text-white";

/**
 * Two small cards over the illustration, built from real interface pieces so they look like the app does. They
 * are an example, not information: a screen reader skips them with the rest of the picture.
 */
function FloatingCards() {
  return (
    <>
      <span className="absolute left-0 top-2 flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-text shadow-card motion-safe:animate-[float_6s_ease-in-out_infinite] md:left-2">
        <CheckCircle weight="fill" size={26} className="text-[#2fb98f]" />
        <span className="grid leading-tight">
          <span className="text-sm font-bold">Reserva confirmada</span>
          <span className="text-xs text-muted">Hoy · 19:00</span>
        </span>
      </span>
      <span className="absolute bottom-3 right-0 flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-text shadow-card motion-safe:animate-[float_7s_ease-in-out_1s_infinite] md:right-2">
        <span data-accent="mint" className="grid size-8 place-items-center rounded-lg bg-accent text-on-accent">
          <SoccerBall size={18} weight="bold" />
        </span>
        <span className="grid leading-tight">
          <span className="text-sm font-bold">Cancha 1 · 60 min</span>
          <span className="font-mono text-xs font-bold">S/ 60</span>
        </span>
      </span>
    </>
  );
}

/** The opening of the home page: what it is, the search, and a picture of booking from a phone. */
export function HomeHero() {
  return (
    <motion.section
      aria-labelledby="hero-title"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 140, damping: 20 }}
      className="relative mt-2 overflow-hidden rounded-box bg-[linear-gradient(135deg,#1238c9_0%,#052ff7_100%)] text-white shadow-card md:grid md:grid-cols-12 md:items-center"
    >
      {/* Soft rings behind everything, from the brand's graphic elements. */}
      <svg viewBox="0 0 400 300" aria-hidden="true" focusable="false" preserveAspectRatio="xMaxYMin slice" className="pointer-events-none absolute inset-0 h-full w-full">
        <circle cx="372" cy="14" r="120" fill="none" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="1.5" />
        <circle cx="372" cy="14" r="170" fill="none" stroke="#ffffff" strokeOpacity="0.08" strokeWidth="1.5" />
      </svg>

      <div className="relative grid gap-6 p-6 md:col-span-7 md:p-12">
        <div>
          <h1 id="hero-title" className="font-display font-bold leading-[1.02] tracking-[-0.03em]">
            <span className="block text-[clamp(2.5rem,10vw,4.4rem)]">Reserva tu hora.</span>{" "}
            <span className="block text-[clamp(2.5rem,10vw,4.4rem)] text-[#bfe3ff]">Sin llamadas.</span>
          </h1>
          <p className="mt-5 max-w-[34ch] text-lg leading-snug text-white/90">
            Canchas, consultorios y más. Elige el horario, deja tu celular y listo. No necesitas cuenta.
          </p>
        </div>

        <div className="rounded-box bg-surface p-5 text-text shadow-card">
          <h2 className="font-display text-xl font-bold leading-tight">Encuentra tu negocio</h2>
          <div className="mt-3">
            <BusinessSearch />
          </div>
          <p className="mt-3 text-sm text-muted">
            ¿No aparece? Cada negocio tiene su propia página: pídele su link y reserva en menos de un minuto.
          </p>
        </div>

        <Link to="/mis-reservas" className={`${OUTLINE_ON_BLUE} w-full sm:w-fit`}>
          Mis reservas
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>

      <div aria-hidden="true" className="relative mx-auto w-full max-w-[440px] px-6 pb-8 md:col-span-5 md:px-4 md:py-10">
        <div className="relative">
          <HeroScene className="w-full" />
          <FloatingCards />
        </div>
      </div>
    </motion.section>
  );
}
