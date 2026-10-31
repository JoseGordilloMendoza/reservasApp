import { Link } from "react-router-dom";

import { KIND_LABEL } from "../lib/kinds";
import type { BusinessKind } from "../lib/platformTypes";
import { useDirectory } from "../lib/queries";
import { BusinessShape, TONES } from "./BusinessShape";
import { Skeleton } from "./Skeleton";

/** The businesses that chose to appear, as cards. It stays out of the way when there are none. */
export function BusinessDirectory() {
  const directory = useDirectory();

  if (directory.isPending) {
    return (
      <section aria-label="Negocios" aria-busy="true" className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((slot) => (
          <Skeleton key={slot} className="h-[260px]" />
        ))}
      </section>
    );
  }

  const businesses = directory.data?.results ?? [];
  if (businesses.length === 0) return null;

  return (
    <section aria-labelledby="directory-title" className="mt-14">
      <h2 id="directory-title" className="font-display text-4xl font-extrabold leading-none tracking-[-0.03em] md:text-5xl">
        Reserva en
        <br />
        un toque
      </h2>
      <p className="mt-3 max-w-[40ch] text-lg text-muted">Estos negocios ya reciben reservas por Separa. Elige uno.</p>

      <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {businesses.map((business, index) => {
          const tone = TONES[index % TONES.length]!;
          return (
            <li key={business.slug}>
              <Link
                to={`/${business.slug}`}
                className="press grid h-full grid-cols-1 overflow-hidden rounded-box border-[3px] border-line bg-surface text-text shadow-hard"
              >
                <span className={`grid place-items-center border-b-[3px] border-line px-6 py-4 ${tone.panel}`}>
                  <BusinessShape kind={business.business_type} tone={tone} className={`h-32 w-full max-w-[220px] ${index % 2 ? "-scale-x-100" : ""}`} />
                </span>
                <span className="grid content-start gap-1 p-4">
                  <span className="text-sm font-bold uppercase tracking-wide text-accent-deep">
                    {KIND_LABEL[business.business_type as BusinessKind] ?? "Negocio"}
                  </span>
                  <span className="font-display text-2xl font-extrabold leading-tight">{business.name}</span>
                  {business.description && <span className="line-clamp-2 text-muted">{business.description}</span>}
                  {business.address && <span className="truncate text-sm font-medium">{business.address}</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
