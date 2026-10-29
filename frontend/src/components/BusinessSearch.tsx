import { MagnifyingGlass } from "@phosphor-icons/react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { KIND_LABEL } from "../lib/kinds";
import type { BusinessKind } from "../lib/platformTypes";
import { useBusinessSearch } from "../lib/queries";
import { isSearchable } from "../lib/search";
import { useDebounced } from "../lib/useDebounced";
import { Skeleton } from "./Skeleton";

/** Finds a business by name, among the ones that chose to appear. Everything else needs its link. */
export function BusinessSearch() {
  const [typed, setTyped] = useState("");
  const settled = useDebounced(typed, 300);
  const search = useBusinessSearch(settled);

  const ready = isSearchable(typed);
  const results = ready ? (search.data?.results ?? []) : [];
  const waiting = ready && (search.isPending || typed.trim() !== settled.trim());

  return (
    <div className="grid grid-cols-1 gap-3">
      <label className="relative block">
        <span className="font-display text-base font-bold">Busca tu negocio por su nombre</span>
        <MagnifyingGlass aria-hidden="true" className="pointer-events-none absolute bottom-[15px] left-4 text-muted" size={22} />
        <input
          type="search"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          placeholder="Canchas, consultorio..."
          className="mt-2 min-h-[52px] w-full rounded-box border-[3px] border-line bg-paper pl-12 pr-4 text-lg text-text placeholder:text-muted/70 focus:shadow-hard focus:outline-none"
        />
      </label>

      <div aria-live="polite">
        {!ready && <p className="text-sm text-muted">Escribe al menos 2 letras.</p>}

        {waiting && results.length === 0 && (
          <div aria-busy="true" aria-label="Buscando" className="grid gap-2">
            <Skeleton className="h-[64px]" />
          </div>
        )}

        {ready && !waiting && search.isError && (
          <p role="alert" className="font-semibold text-danger">
            No pudimos buscar ahora. {search.error.message}
          </p>
        )}

        {ready && !waiting && search.isSuccess && results.length === 0 && (
          <p className="rounded-box border-[3px] border-dashed border-line p-4 font-semibold">
            No encontramos ese negocio. No todos aparecen aquí: pídele su link directamente.
          </p>
        )}

        {results.length > 0 && (
          <ul className="grid gap-2">
            {results.map((business) => (
              <li key={business.slug}>
                <Link
                  to={`/${business.slug}`}
                  className="press grid gap-0.5 rounded-box border-[3px] border-line bg-surface p-3 text-text shadow-hard-sm"
                >
                  <span className="truncate font-display text-lg font-extrabold leading-tight">{business.name}</span>
                  <span className="truncate text-sm text-muted">
                    {KIND_LABEL[business.business_type as BusinessKind] ?? "Negocio"}
                    {business.address ? ` · ${business.address}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
