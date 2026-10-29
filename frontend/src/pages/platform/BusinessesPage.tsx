import { MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { useDeferredValue, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { Button, buttonClass } from "../../components/Button";
import { StandingStamp } from "../../components/platform/StandingStamp";
import { Skeleton } from "../../components/Skeleton";
import { formatPrice } from "../../lib/format";
import { KIND_LABEL } from "../../lib/kinds";
import { useBusinessList } from "../../lib/platformQueries";
import type { BusinessFilter, PlatformBusinessRow } from "../../lib/platformTypes";

const FILTERS: { id: BusinessFilter | "all"; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "active", label: "Activos" },
  { id: "expiring", label: "Por vencer" },
  { id: "past_due", label: "Vencidos" },
  { id: "suspended", label: "Suspendidos" },
  { id: "no_subscription", label: "Sin suscripción" },
];

const KNOWN = new Set<string>(FILTERS.map((item) => item.id));

function Row({ business }: { business: PlatformBusinessRow }) {
  const price = formatPrice(business.price);
  const users = business.users_count === 1 ? "1 usuario" : `${business.users_count} usuarios`;

  return (
    <li>
      <Link
        to={`/plataforma/negocios/${business.slug}`}
        className="press grid gap-2 rounded-box border-[3px] border-line bg-surface p-4 text-text shadow-hard-sm"
      >
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block truncate font-display text-xl font-extrabold leading-tight">{business.name}</span>
            <span className="block truncate font-mono text-sm text-muted">/{business.slug}</span>
          </span>
          <StandingStamp standing={business.standing} suspended={business.status === "suspended"} />
        </span>
        <span className="text-sm text-muted">
          {KIND_LABEL[business.business_type]}
          {business.plan_name ? ` · ${business.plan_name}` : ""}
          {price ? ` · ${price} al mes` : ""}
        </span>
        <span className="text-sm text-muted">
          {users} · {business.bookings_30d} {business.bookings_30d === 1 ? "reserva" : "reservas"} en 30 días
        </span>
      </Link>
    </li>
  );
}

export function BusinessesPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("filtro") ?? "all";
  const selected = (KNOWN.has(raw) ? raw : "all") as BusinessFilter | "all";

  const [search, setSearch] = useState("");
  const q = useDeferredValue(search.trim());

  const list = useBusinessList({ q, ...(selected === "all" ? {} : { filter: selected }) });
  const businesses = list.data?.pages.flatMap((page) => page.results) ?? [];
  const total = list.data?.pages[0]?.count ?? 0;

  function choose(id: BusinessFilter | "all") {
    setParams(id === "all" ? {} : { filtro: id }, { replace: true });
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex items-end justify-between gap-4">
        <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.9] tracking-[-0.03em]">Negocios</h1>
        <Link to="/plataforma/negocios/nuevo" className={`${buttonClass("primary")} max-md:hidden`}>
          <Plus aria-hidden="true" />
          Nuevo negocio
        </Link>
      </div>

      <div role="tablist" aria-label="Filtrar negocios" className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 pt-1 [scrollbar-width:none] md:mx-0 md:px-0">
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected === id}
            onClick={() => choose(id)}
            className={
              "press min-h-[48px] shrink-0 rounded-box border-[3px] border-line px-4 font-display text-base font-bold " +
              (selected === id ? "bg-accent text-on-accent shadow-hard" : "bg-surface text-text shadow-hard-sm")
            }
          >
            {label}
          </button>
        ))}
      </div>

      <label className="relative block">
        <span className="sr-only">Buscar por nombre o link</span>
        <MagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre o link"
          className="min-h-[52px] w-full rounded-box border-[3px] border-line bg-surface pl-12 pr-4 text-lg text-text placeholder:text-muted/70 focus:shadow-hard focus:outline-none"
        />
      </label>

      {list.isPending && (
        <div className="grid gap-3" aria-busy="true" aria-label="Cargando">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-[120px]" />
          ))}
        </div>
      )}

      {list.isError && (
        <div role="alert" className="grid gap-3 rounded-box border-[3px] border-danger p-4">
          <p className="font-semibold text-danger">No pudimos cargar los negocios. {list.error.message}</p>
          <Button variant="plain" onClick={() => void list.refetch()}>
            Intentar otra vez
          </Button>
        </div>
      )}

      {list.isSuccess && businesses.length === 0 && (
        <p className="rounded-box border-[3px] border-dashed border-line p-5 font-display text-xl font-bold leading-tight">
          {q || selected !== "all" ? "Ningún negocio coincide." : "Todavía no hay negocios. Abre el primero con Nuevo."}
        </p>
      )}

      {list.isSuccess && businesses.length > 0 && (
        <>
          <p className="text-sm text-muted" aria-live="polite">
            {total === 1 ? "1 negocio" : `${total} negocios`}
          </p>
          <ul className="grid grid-cols-1 gap-3">
            {businesses.map((business) => (
              <Row key={business.slug} business={business} />
            ))}
          </ul>
          {list.hasNextPage && (
            <Button variant="plain" onClick={() => void list.fetchNextPage()} disabled={list.isFetchingNextPage}>
              {list.isFetchingNextPage ? "Cargando" : "Ver más"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
