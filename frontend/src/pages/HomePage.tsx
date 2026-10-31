import { ArrowRight } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";

import { BusinessDirectory } from "../components/BusinessDirectory";
import { BusinessSearch } from "../components/BusinessSearch";
import { buttonClass } from "../components/Button";

/** Flat shapes in the three colors of the palette, behind the headline: a ball, two leaves and a ticket. */
function HeroShapes() {
  return (
    <svg
      viewBox="0 0 320 300"
      aria-hidden="true"
      focusable="false"
      className="pointer-events-none absolute -bottom-6 -right-4 w-44 sm:-bottom-14 sm:-right-6 sm:w-[15rem]"
    >
      <g stroke="var(--paper)" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">
        <path d="M60 280 C10 240 20 160 100 120 C150 170 140 250 60 280Z" fill="var(--paper)" />
        <path d="M60 280 C70 230 84 180 100 120" fill="none" stroke="var(--line)" />
        <circle cx="210" cy="150" r="78" fill="var(--accent)" />
        <path d="M150 128 C190 158 236 158 280 124" fill="none" />
        <path d="M210 72 V128" fill="none" />
        <path d="M160 200 C190 182 200 172 210 128 C222 172 234 182 266 200" fill="none" />
        <path d="M262 250 C240 226 250 190 290 176 C308 208 296 240 262 250Z" fill="var(--paper)" stroke="var(--paper)" />
      </g>
    </svg>
  );
}

export function HomePage() {
  return (
    <>
    <div className="grid grid-cols-1 gap-8 pt-4 md:grid-cols-12 md:items-center">
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 140, damping: 20 }}
        className="relative overflow-hidden rounded-box border-[3px] border-line bg-line p-6 pb-40 text-paper shadow-hard sm:pb-6 md:col-span-8 md:p-12"
      >
        <HeroShapes />
        <h1 className="relative font-display text-[clamp(3rem,12vw,6.5rem)] font-extrabold uppercase leading-[0.88] tracking-[-0.035em]">
          Separa tu hora.
          <br />
          Sin llamadas.
        </h1>
        <p className="relative mt-6 max-w-[32ch] text-xl font-medium leading-snug">
          Canchas, consultorios y más. Elige el horario, deja tu celular y listo. No necesitas cuenta.
        </p>
      </motion.section>

      <motion.aside
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 140, damping: 20, delay: 0.1 }}
        className="rounded-box border-[3px] border-line bg-surface p-6 shadow-hard md:col-span-4"
      >
        <h2 className="font-display text-2xl font-extrabold leading-tight">Encuentra tu negocio</h2>
        <div className="mt-4">
          <BusinessSearch />
        </div>
        <p className="mt-5 text-muted">
          ¿No aparece? Cada negocio tiene su propia página: pídele su link y reserva en menos de un minuto.
        </p>
        <Link to="/mis-reservas" className={buttonClass("ink", "mt-6 w-full")}>
          Mis reservas
          <ArrowRight aria-hidden="true" />
        </Link>
      </motion.aside>
    </div>
    <BusinessDirectory />
    </>
  );
}
