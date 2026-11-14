import { ArrowRight } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";

import { BusinessDirectory } from "../components/BusinessDirectory";
import { BusinessSearch } from "../components/BusinessSearch";
import { buttonClass } from "../components/Button";
import { ForBusinesses } from "../components/ForBusinesses";
import { HeroArt } from "../components/HeroArt";

const STEPS = [
  { number: "1", title: "Elige tu negocio", text: "Busca por nombre o abre el link que te dieron." },
  { number: "2", title: "Reserva tu hora", text: "Escoge el horario y deja tu celular. Sin cuenta." },
  { number: "3", title: "Llega y listo", text: "Muestra tu boleto en el local y confirma tu lugar." },
] as const;

/** Three plain steps, each in its own card, so a first visit reads at a glance. */
function HowItWorks() {
  return (
    <section aria-labelledby="how-title" className="mt-20">
      <h2 id="how-title" className="font-display text-3xl font-bold leading-tight tracking-[-0.02em] md:text-4xl">
        Así de fácil
      </h2>
      <ol className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
        {STEPS.map((step) => (
          <li key={step.number} className="rounded-box border border-edge bg-surface p-6 shadow-card-sm">
            <span
              aria-hidden="true"
              className="grid size-11 place-items-center rounded-full bg-accent font-display text-xl font-bold text-on-accent"
            >
              {step.number}
            </span>
            <h3 className="mt-4 font-display text-xl font-bold leading-tight">{step.title}</h3>
            <p className="mt-1 text-muted">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function HomePage() {
  return (
    <>
      <div className="grid grid-cols-1 gap-6 pt-2 md:grid-cols-12 md:items-start md:gap-8">
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 140, damping: 20 }}
          className="relative overflow-hidden rounded-box bg-[linear-gradient(135deg,#1238c9_0%,#052ff7_100%)] p-6 pb-24 text-white shadow-card sm:pb-14 md:col-span-8 md:p-12 md:pb-20"
        >
          <HeroArt />
          <h1 className="relative font-display font-bold leading-[1.02] tracking-[-0.03em]">
            <span className="block text-[clamp(2.6rem,10vw,4.6rem)]">Reserva tu hora.</span>{" "}
            <span className="block text-[clamp(2.6rem,10vw,4.6rem)] text-[#bfe3ff]">Sin llamadas.</span>
          </h1>
          <p className="relative mt-6 max-w-[34ch] text-lg leading-snug text-white/90">
            Canchas, consultorios y más. Elige el horario, deja tu celular y listo. No necesitas cuenta.
          </p>
        </motion.section>

        <motion.aside
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 140, damping: 20, delay: 0.1 }}
          className="rounded-box border border-edge bg-surface p-6 shadow-card md:col-span-4 md:mt-16"
        >
          <h2 className="font-display text-2xl font-bold leading-tight">Encuentra tu negocio</h2>
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
      <ForBusinesses />
    </>
  );
}
