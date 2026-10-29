import { MapPin, Phone, Storefront, WhatsappLogo } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useParams } from "react-router-dom";

import { BookingFlow } from "../components/BookingFlow";
import { ContactLinks } from "../components/ContactLinks";
import { Skeleton } from "../components/Skeleton";
import { formatPrice } from "../lib/format";
import { ApiError } from "../lib/api";
import { useAccent, useBusiness } from "../lib/queries";
import type { PublicBusiness } from "../lib/types";
import { displayPhone, telLink, whatsappLink } from "../lib/whatsapp";
import { NotFoundPage } from "./NotFoundPage";

/** The cheapest price on offer, for the sticker. */
function lowestPrice(business: PublicBusiness): string | null {
  const prices = business.resources
    .flatMap((resource) => resource.services)
    .map((service) => Number(service.reference_price))
    .filter((price) => Number.isFinite(price) && price > 0);
  return prices.length ? formatPrice(String(Math.min(...prices))) : null;
}

const CHIP =
  "inline-flex min-h-[44px] items-center gap-2 rounded-box border-[3px] border-line bg-surface px-3 py-2 " +
  "text-sm font-semibold text-text";

/** Long words need a smaller title or they would be cut in the middle. */
function titleSize(name: string): string {
  const longest = Math.max(...name.split(/\s+/).map((word) => word.length));
  if (longest <= 8) return "text-[clamp(2.75rem,14vw,6.25rem)]";
  if (longest <= 11) return "text-[clamp(2.25rem,11vw,5.5rem)]";
  return "text-[clamp(1.9rem,9vw,4.5rem)]";
}

function Poster({ business }: { business: PublicBusiness }) {
  const price = lowestPrice(business);
  const phone = telLink(business.phone);
  const chat = whatsappLink(business.whatsapp, `Hola ${business.name}, quisiera hacer una consulta.`);

  return (
    <motion.header
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 140, damping: 20 }}
      className="relative rounded-box border-[3px] border-line bg-accent p-6 pb-14 text-on-accent shadow-hard md:p-10 md:pb-14"
    >
      <h1 className={`text-balance break-words font-display font-extrabold uppercase leading-[0.9] tracking-[-0.03em] ${titleSize(business.name)}`}>
        {business.name}
      </h1>

      {business.description && (
        <p className="mt-5 max-w-[34ch] text-lg font-medium leading-snug">{business.description}</p>
      )}

      {(business.address || phone || chat) && (
        <ul className="mt-6 flex flex-wrap gap-2">
          {business.address && (
            <li className={CHIP}>
              <MapPin aria-hidden="true" />
              {business.address}
            </li>
          )}
          {phone && (
            <li>
              <a href={phone} className={`${CHIP} press shadow-hard-sm`}>
                <Phone aria-hidden="true" />
                {displayPhone(business.phone)}
              </a>
            </li>
          )}
          {chat && (
            <li>
              <a href={chat} target="_blank" rel="noreferrer" className={`${CHIP} press shadow-hard-sm`}>
                <WhatsappLogo aria-hidden="true" />
                WhatsApp
              </a>
            </li>
          )}
        </ul>
      )}

      {price && (
        <div
          aria-label={`Desde ${price}`}
          className="absolute -bottom-5 right-5 rotate-[5deg] rounded-box border-[3px] border-line bg-surface px-3 py-2 text-center text-text shadow-hard-sm md:right-8"
        >
          <span className="block text-[11px] font-bold uppercase leading-none tracking-wider">Desde</span>
          <span className="font-mono text-2xl font-bold leading-tight">{price}</span>
        </div>
      )}
    </motion.header>
  );
}

function PageSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-12" aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-[320px] md:col-span-7" />
      <Skeleton className="h-[420px] md:col-span-5" />
    </div>
  );
}

/** Shown instead of the booking flow when the business is suspended or past due (D78). */
function NotAccepting({ business }: { business: PublicBusiness }) {
  const phone = business.whatsapp || business.phone;
  return (
    <section
      role="status"
      className="grid gap-4 rounded-box border-[3px] border-dashed border-line bg-surface p-6 text-text"
    >
      <Storefront aria-hidden="true" size={36} />
      <h2 className="font-display text-3xl font-extrabold leading-tight">No está recibiendo reservas por ahora</h2>
      <p className="text-muted">
        {business.name} no tiene horarios disponibles en este momento. Las reservas que ya hiciste se conservan: las
        encuentras en Mis reservas.
      </p>
      {phone && <ContactLinks phone={phone} message={`Hola ${business.name}, quería hacer una reserva.`} />}
    </section>
  );
}

export function BusinessPage() {
  const { slug = "" } = useParams();
  const query = useBusiness(slug);
  useAccent(query.data?.accent);

  if (query.isPending) return <PageSkeleton />;

  if (query.isError) {
    const { error } = query;
    if (error instanceof ApiError && error.status === 404) {
      return <NotFoundPage title="No encontramos ese negocio" hint="Revisa que el link esté completo." />;
    }
    return <NotFoundPage title="No pudimos cargar la página" hint={error instanceof Error ? error.message : undefined} />;
  }

  const business = query.data;

  return (
    <div className="grid grid-cols-1 gap-10 pt-4 md:grid-cols-12 md:items-start md:gap-8">
      <div className="min-w-0 md:col-span-7 md:sticky md:top-6">
        <Poster business={business} />
      </div>
      <motion.div
        className="min-w-0 md:col-span-5"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 140, damping: 20, delay: 0.08 }}
      >
        {business.accepting_bookings ? <BookingFlow business={business} /> : <NotAccepting business={business} />}
      </motion.div>
    </div>
  );
}
