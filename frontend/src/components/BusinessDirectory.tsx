import { ArrowRight, Brain, MapPin, SoccerBall, SquaresFour, Storefront } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { KIND_LABEL } from "../lib/kinds";
import type { BusinessKind } from "../lib/platformTypes";
import { useDirectory } from "../lib/queries";
import type { Accent, DirectoryEntry } from "../lib/types";
import { BusinessShape, TONES } from "./BusinessShape";
import { Picture } from "./Picture";
import { Skeleton } from "./Skeleton";

/** How each kind of business looks in the category filter: an icon on one of the brand accents. */
const KIND_LOOK: Record<BusinessKind, { icon: Icon; accent: Accent; plural: string }> = {
  court: { icon: SoccerBall, accent: "mint", plural: "Canchas" },
  psychologist: { icon: Brain, accent: "sky", plural: "Psicólogos" },
  generic: { icon: Storefront, accent: "sunflower", plural: "Otros negocios" },
};

const kindOf = (entry: DirectoryEntry): BusinessKind =>
  entry.business_type in KIND_LOOK ? (entry.business_type as BusinessKind) : "generic";

/** Only the kinds that have businesses, so no button ever leads to an empty list. */
function kindsIn(entries: DirectoryEntry[]): BusinessKind[] {
  const present = new Set(entries.map(kindOf));
  return (Object.keys(KIND_LOOK) as BusinessKind[]).filter((kind) => present.has(kind));
}

function CategoryButton({
  label,
  icon: Glyph,
  accent,
  pressed,
  onPress,
}: {
  label: string;
  icon: Icon;
  accent: Accent;
  pressed: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onPress}
      data-accent={accent}
      className={
        "press flex min-h-[52px] shrink-0 items-center gap-2.5 rounded-box border py-2 pl-2 pr-4 font-display font-semibold " +
        (pressed ? "border-line bg-line text-paper shadow-card-sm" : "border-edge bg-accent-soft text-text")
      }
    >
      <span aria-hidden="true" className="grid size-9 place-items-center rounded-xl bg-accent text-on-accent">
        <Glyph size={20} weight="bold" />
      </span>
      {label}
    </button>
  );
}

function BusinessCard({ business, index }: { business: DirectoryEntry; index: number }) {
  const tone = TONES[index % TONES.length]!;
  const kind = kindOf(business);
  const initial = business.name.trim().charAt(0).toUpperCase();

  return (
    <Link
      to={`/${business.slug}`}
      data-accent={business.accent}
      className="press group grid h-full grid-rows-[auto_1fr] overflow-hidden rounded-box border border-edge bg-surface text-text shadow-card motion-safe:transition-transform motion-safe:hover:-translate-y-1"
    >
      <span className="relative block">
        <Picture
          src={business.cover_url}
          className="aspect-[16/9] w-full object-cover"
          fallback={
            <span className={`grid aspect-[16/9] w-full place-items-center ${tone.panel}`}>
              <BusinessShape kind={business.business_type} tone={tone} className={`h-28 w-full max-w-[200px] ${index % 2 ? "-scale-x-100" : ""}`} />
            </span>
          }
        />
        {/* The logo sits on the edge of the picture, like a profile; without one, the business's initial in its color. */}
        <span className="absolute -bottom-7 left-4 grid size-14 place-items-center overflow-hidden rounded-xl border-[3px] border-surface bg-surface shadow-card-sm">
          <Picture
            src={business.logo_url}
            className="size-full object-contain p-0.5"
            fallback={
              <span aria-hidden="true" className="grid size-full place-items-center bg-accent font-display text-2xl font-bold text-on-accent">
                {initial}
              </span>
            }
          />
        </span>
      </span>

      <span className="grid content-start gap-1.5 px-4 pb-4 pt-9">
        <span className="w-fit rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide">
          {KIND_LABEL[kind]}
        </span>
        <span className="font-display text-2xl font-bold leading-tight">{business.name}</span>
        {business.description && <span className="line-clamp-2 text-muted">{business.description}</span>}
        {business.address && (
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <MapPin aria-hidden="true" className="shrink-0" />
            <span className="truncate">{business.address}</span>
          </span>
        )}
        <span className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 font-display font-semibold text-on-accent">
          Reservar aquí
          <ArrowRight aria-hidden="true" className="motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" />
        </span>
      </span>
    </Link>
  );
}

/** The businesses that chose to appear, as cards, with a filter by kind. It stays out of the way when there are none. */
export function BusinessDirectory() {
  const directory = useDirectory();
  const [kind, setKind] = useState<BusinessKind | null>(null);

  if (directory.isPending) {
    return (
      <section aria-label="Negocios" aria-busy="true" className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((slot) => (
          <Skeleton key={slot} className="h-[320px]" />
        ))}
      </section>
    );
  }

  const businesses = directory.data?.results ?? [];
  if (businesses.length === 0) return null;

  const kinds = kindsIn(businesses);
  const shown = kind ? businesses.filter((entry) => kindOf(entry) === kind) : businesses;

  return (
    <section aria-labelledby="directory-title" className="mt-16">
      <h2 id="directory-title" className="font-display text-4xl font-bold leading-none tracking-[-0.02em] md:text-5xl">
        Reserva en un toque
      </h2>
      <p className="mt-3 max-w-[40ch] text-lg text-muted">Estos negocios ya reciben reservas por MiReserva. Elige uno.</p>

      {kinds.length > 1 && (
        <div role="group" aria-label="Ver por tipo de negocio" className="-mx-4 mt-6 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6">
          <CategoryButton label="Todos" icon={SquaresFour} accent="brand" pressed={kind === null} onPress={() => setKind(null)} />
          {kinds.map((each) => (
            <CategoryButton
              key={each}
              label={KIND_LOOK[each].plural}
              icon={KIND_LOOK[each].icon}
              accent={KIND_LOOK[each].accent}
              pressed={kind === each}
              onPress={() => setKind(each)}
            />
          ))}
        </div>
      )}

      <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((business, index) => (
          <li key={business.slug}>
            <BusinessCard business={business} index={index} />
          </li>
        ))}
      </ul>
    </section>
  );
}
