import { ArrowRight } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";

import { BusinessDirectory } from "../components/BusinessDirectory";
import { BusinessSearch } from "../components/BusinessSearch";
import { buttonClass } from "../components/Button";

/**
 * Flat shapes in the palette, cut off by the edges of the block like a screen print: a red ball behind the
 * headline (butter text reads on red) and a butter leaf below, away from any text.
 */
function HeroShapes() {
  return (
    <>
      <svg
        viewBox="0 0 200 200"
        aria-hidden="true"
        focusable="false"
        className="pointer-events-none absolute -right-20 -top-20 w-52 sm:-right-24 sm:-top-24 sm:w-72"
      >
        <circle cx="100" cy="100" r="92" fill="var(--accent)" stroke="var(--paper)" strokeWidth="4" />
        {/* The seams are a darker red, so they do not cut through the letters that pass over the ball. */}
        <g fill="none" stroke="var(--accent-deep)" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">
          <path d="M22 70 C62 104 138 104 178 66" />
          <path d="M100 8 V84" />
          <path d="M38 150 C70 126 86 114 100 84 C116 114 132 126 164 150" />
        </g>
      </svg>

      <svg
        viewBox="0 0 200 240"
        aria-hidden="true"
        focusable="false"
        className="pointer-events-none absolute -bottom-12 -right-6 w-36 rotate-12 sm:-bottom-16 sm:right-8 sm:w-52"
      >
        <g strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">
          <path d="M100 236 C20 210 6 120 92 8 C176 66 196 168 100 236Z" fill="var(--paper)" stroke="var(--paper)" />
          <path d="M100 236 C96 160 94 90 92 8" fill="none" stroke="var(--line)" />
          <path d="M96 150 C120 138 136 120 150 96 M94 108 C74 98 62 84 54 64" fill="none" stroke="var(--line)" />
        </g>
      </svg>

      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-24 right-40 hidden size-6 rounded-full border-[3px] border-paper bg-accent sm:block"
      />
    </>
  );
}

const STEPS = [
  { number: "1", title: "Elige tu negocio", text: "Busca por nombre o abre el link que te dieron.", panel: "bg-surface text-text" },
  { number: "2", title: "Separa tu hora", text: "Escoge el horario y deja tu celular. Sin cuenta.", panel: "bg-accent text-on-accent" },
  { number: "3", title: "Llega y listo", text: "Muestra tu boleto en el local y confirma tu lugar.", panel: "bg-line text-paper" },
] as const;

/** Three tickets with punched sides, each one turned a little, so the page does not read as a flat grid. */
function HowItWorks() {
  const tilt = ["md:-rotate-2", "md:translate-y-3 md:rotate-1", "md:-rotate-1"];

  return (
    <section aria-labelledby="how-title" className="mt-20">
      <h2 id="how-title" className="font-display text-3xl font-extrabold leading-none tracking-[-0.03em] md:text-4xl">
        Así de fácil
      </h2>
      <ol className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <li
            key={step.number}
            className={`relative rounded-box border-[3px] border-line p-5 shadow-hard ${step.panel} ${tilt[index]} before:absolute before:-left-[14px] before:top-1/2 before:size-6 before:-translate-y-1/2 before:rounded-full before:border-[3px] before:border-line before:bg-paper after:absolute after:-right-[14px] after:top-1/2 after:size-6 after:-translate-y-1/2 after:rounded-full after:border-[3px] after:border-line after:bg-paper`}
          >
            <span className="font-display text-6xl font-extrabold leading-none opacity-90">{step.number}</span>
            <h3 className="mt-3 font-display text-2xl font-extrabold leading-tight">{step.title}</h3>
            <p className="mt-1 font-medium">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function HomePage() {
  return (
    <>
      <div className="grid grid-cols-1 gap-8 pt-4 md:grid-cols-12 md:items-start">
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 140, damping: 20 }}
          className="relative overflow-hidden rounded-box border-[3px] border-line bg-line p-6 pb-44 text-paper shadow-hard sm:pb-24 md:col-span-8 md:p-12 md:pb-28"
        >
          <HeroShapes />
          <h1 className="relative font-display font-extrabold uppercase leading-[0.86] tracking-[-0.035em]">
            <span className="block text-[clamp(3.6rem,15vw,8.5rem)]">Separa</span>{" "}
            <span className="block text-[clamp(2.2rem,9vw,4.6rem)]">tu hora.</span>{" "}
            <span className="block text-[clamp(2.2rem,9vw,4.6rem)]">Sin llamadas.</span>
          </h1>
          <p className="relative mt-6 max-w-[30ch] text-xl font-medium leading-snug">
            Canchas, consultorios y más. Elige el horario, deja tu celular y listo. No necesitas cuenta.
          </p>
        </motion.section>

        <motion.aside
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 140, damping: 20, delay: 0.1 }}
          className="rounded-box border-[3px] border-line bg-surface p-6 shadow-hard md:col-span-4 md:mt-24"
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
      <HowItWorks />
    </>
  );
}
