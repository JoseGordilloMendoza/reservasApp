import { ArrowRight } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";

import { BusinessSearch } from "../components/BusinessSearch";
import { buttonClass } from "../components/Button";

export function HomePage() {
  return (
    <div className="grid grid-cols-1 gap-8 pt-4 md:grid-cols-12 md:items-center">
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 140, damping: 20 }}
        className="rounded-box border-[3px] border-line bg-accent p-6 text-on-accent shadow-hard md:col-span-8 md:p-12"
      >
        <h1 className="font-display text-[clamp(3rem,13vw,7.5rem)] font-extrabold uppercase leading-[0.88] tracking-[-0.035em]">
          Separa tu hora.
          <br />
          Sin llamadas.
        </h1>
        <p className="mt-6 max-w-[32ch] text-xl font-medium leading-snug">
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
  );
}
