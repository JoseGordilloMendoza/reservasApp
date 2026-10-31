import { ArrowRight, EnvelopeSimple, WhatsappLogo } from "@phosphor-icons/react";
import { Link } from "react-router-dom";

import { BRAND, contactEmail, contactWhatsapp } from "../lib/brand";
import { whatsappLink } from "../lib/whatsapp";
import { buttonClass } from "./Button";

const ASK = `Hola, quiero tener mi negocio en ${BRAND}. ¿Me ayudan a crear mi cuenta?`;

/** Where someone who wants their business on the platform can reach the team, or null when none is set up. */
export function contactHref(): string | null {
  const chat = whatsappLink(contactWhatsapp(), ASK);
  if (chat) return chat;
  const email = contactEmail();
  if (email) return `mailto:${email}?subject=${encodeURIComponent(`Quiero mi negocio en ${BRAND}`)}&body=${encodeURIComponent(ASK)}`;
  return null;
}

/**
 * For the owner who arrives at the home page: sign in if their business is already here, or ask the team to
 * open an account. Businesses do not register themselves (the team opens each one), so this is the way in.
 */
export function ForBusinesses() {
  const contact = contactHref();

  return (
    <section aria-labelledby="para-negocios" className="relative mt-20 overflow-hidden rounded-box border-[3px] border-line bg-line p-6 text-paper shadow-hard md:p-10">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-16 -right-12 size-44 rounded-full border-[3px] border-paper bg-accent sm:size-56"
      />
      <div className="relative grid max-w-[40rem] gap-4">
        <h2 id="para-negocios" className="font-display text-4xl font-extrabold leading-[0.95] tracking-[-0.03em] md:text-5xl">
          ¿Tienes un negocio con citas?
        </h2>
        <p className="text-lg font-medium leading-snug">
          Recibe reservas sin llamadas ni mensajes sueltos. Tus clientes eligen su horario y tú confirmas con un toque.
        </p>

        <div className="mt-2 flex flex-wrap gap-3">
          {contact && (
            <a
              href={contact}
              target={contact.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              className={buttonClass("primary", "w-full border-paper sm:w-auto")}
            >
              {contact.startsWith("http") ? <WhatsappLogo aria-hidden="true" /> : <EnvelopeSimple aria-hidden="true" />}
              Quiero mi negocio en {BRAND}
            </a>
          )}
          <Link to="/panel/entrar" className={buttonClass("plain", "w-full sm:w-auto")}>
            {contact ? "Ya tengo cuenta" : "Entrar a mi panel"}
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
