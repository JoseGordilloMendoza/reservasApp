import { ArrowRight, EnvelopeSimple, WhatsappLogo } from "@phosphor-icons/react";
import { Link } from "react-router-dom";

import { BRAND, contactEmail, contactWhatsapp } from "../lib/brand";
import { whatsappLink } from "../lib/whatsapp";
import { HeroArt } from "./HeroArt";
import { ShopScene } from "./IsoArt";

const ASK = `Hola, quiero tener mi negocio en ${BRAND}. ¿Me ayudan a crear mi cuenta?`;

/** A Peruvian mobile written without the country code (914 659 295) still opens the right chat. */
function withCountryCode(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 9 ? `51${digits}` : digits;
}

const SUBJECT = `Quiero mi negocio en ${BRAND}`;

/** A phone opens its own mail app (usually Gmail); a computer rarely has one set up, so it opens Gmail on the web. */
function onPhone(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
}

/** An email with the request already written. Needs no key or permission: it only opens a draft for the person to send. */
export function emailLink(address: string): string {
  if (onPhone()) return `mailto:${address}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(ASK)}`;
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(address)}&su=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(ASK)}`;
}

/** The ways to reach the team that are set up: a WhatsApp chat and an email, each with the request already written. */
export function contactLinks(): { whatsapp: string | null; email: string | null; address: string } {
  const address = contactEmail().trim();
  return {
    whatsapp: whatsappLink(withCountryCode(contactWhatsapp()), ASK),
    email: address ? emailLink(address) : null,
    address,
  };
}

/**
 * For the owner who arrives at the home page: sign in if their business is already here, or ask the team to
 * open an account. Businesses do not register themselves (the team opens each one), so this is the way in.
 */
export function ForBusinesses() {
  const { whatsapp, email, address } = contactLinks();
  const canAsk = Boolean(whatsapp || email);

  return (
    <section aria-labelledby="para-negocios" className="relative mt-20 overflow-hidden rounded-box bg-[linear-gradient(135deg,#1238c9_0%,#052ff7_100%)] p-6 text-white shadow-card md:p-10">
      <HeroArt />
      <ShopScene className="pointer-events-none relative mx-auto mb-2 w-44 md:absolute md:bottom-6 md:right-8 md:mb-0 md:w-64" />
      <div className="relative grid max-w-[40rem] gap-4">
        <h2 id="para-negocios" className="font-display text-4xl font-bold leading-[1.1] tracking-[-0.02em] md:text-5xl">
          ¿Tienes un negocio con citas?
        </h2>
        <p className="text-lg font-medium leading-snug">
          Recibe reservas sin llamadas ni mensajes sueltos. Tus clientes eligen su horario y tú confirmas con un toque.
        </p>

        <div className="mt-2 flex flex-wrap gap-3">
          {whatsapp && (
            <a href={whatsapp} target="_blank" rel="noreferrer" className="press inline-flex min-h-[48px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-transparent bg-white px-5 py-3 font-display text-base font-semibold leading-none text-[#1238c9] sm:w-auto">
              <WhatsappLogo aria-hidden="true" />
              Escríbenos por WhatsApp
            </a>
          )}
          {email && (
            <a
              href={email}
              target={email.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              className="press inline-flex min-h-[48px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-white/60 bg-transparent px-5 py-3 font-display text-base font-semibold leading-none text-white sm:w-auto"
            >
              <EnvelopeSimple aria-hidden="true" />
              Escríbenos por correo
            </a>
          )}
          <Link to="/panel/entrar" className="press inline-flex min-h-[48px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-white/60 bg-transparent px-5 py-3 font-display text-base font-semibold leading-none text-white sm:w-auto">
            {canAsk ? "Ya tengo cuenta" : "Entrar a mi panel"}
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>

        {email && (
          <p className="text-sm font-medium">
            ¿Prefieres otra app de correo? Escribe a <span className="break-all font-bold">{address}</span>.
          </p>
        )}
      </div>
    </section>
  );
}
