import { MagnifyingGlass } from "@phosphor-icons/react";
import { useDeferredValue, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "../../components/Button";
import { Skeleton } from "../../components/Skeleton";
import { relativeDay } from "../../lib/dates";
import type { CustomerFilters, CustomerSummary } from "../../lib/panelTypes";
import { useCustomerList, usePanelBusiness } from "../../lib/panelQueries";
import { displayPhone } from "../../lib/whatsapp";

type Show = "all" | "blocked";

const SHOWS: { id: Show; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "blocked", label: "Bloqueados" },
];

function CustomerRow({ customer, timeZone }: { customer: CustomerSummary; timeZone: string | undefined }) {
  const count = customer.bookings_count === 1 ? "1 reserva" : `${customer.bookings_count} reservas`;
  const last = customer.last_booking_at && timeZone ? ` · última ${relativeDay(customer.last_booking_at, timeZone).toLowerCase()}` : "";

  return (
    <li>
      <Link
        to={`/panel/clientes/${customer.id}`}
        className="press flex items-center gap-4 rounded-box border border-edge bg-surface p-3 text-text shadow-card-sm"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-lg font-bold leading-tight">{customer.name}</span>
          <span className="block truncate font-mono text-sm text-muted">{displayPhone(customer.phone)}</span>
          <span className="block truncate text-sm text-muted">
            {count}
            {last}
          </span>
        </span>
        {customer.is_blocked && (
          <span className="whitespace-nowrap rounded-xl border border-danger px-2 py-1 font-display text-sm font-bold leading-none tracking-wide text-danger">
            Bloqueado
          </span>
        )}
      </Link>
    </li>
  );
}

export function CustomersPage() {
  const business = usePanelBusiness();
  const [show, setShow] = useState<Show>("all");
  const [search, setSearch] = useState("");
  const q = useDeferredValue(search.trim());

  const filters: CustomerFilters = { q, ...(show === "blocked" ? { blocked: true } : {}) };
  const list = useCustomerList(filters);
  const customers = list.data?.pages.flatMap((page) => page.results) ?? [];
  const total = list.data?.pages[0]?.count ?? 0;

  return (
    <div className="grid grid-cols-1 gap-6">
      <h1 className="font-display text-3xl font-bold leading-[1.15] tracking-[-0.02em] sm:text-4xl">Clientes</h1>

      <div role="tablist" aria-label="Filtrar clientes" className="flex gap-3">
        {SHOWS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={show === id}
            onClick={() => setShow(id)}
            className={
              "press min-h-[48px] rounded-box border border-edge px-4 font-display text-base font-bold " +
              (show === id ? "bg-accent text-on-accent shadow-card" : "bg-surface text-text shadow-card-sm")
            }
          >
            {label}
          </button>
        ))}
      </div>

      <label className="relative block">
        <span className="sr-only">Buscar por nombre o celular</span>
        <MagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre o celular"
          className="min-h-[52px] w-full rounded-box border border-edge-strong bg-surface pl-12 pr-4 text-lg text-text placeholder:text-muted/70 focus:border-accent-deep focus:ring-4 focus:ring-accent/25 focus:outline-none"
        />
      </label>

      {list.isPending && (
        <div className="grid gap-3" aria-busy="true" aria-label="Cargando">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-[88px]" />
          ))}
        </div>
      )}

      {list.isError && (
        <div role="alert" className="grid gap-3 rounded-box border border-danger p-4">
          <p className="font-semibold text-danger">No pudimos cargar los clientes. {list.error.message}</p>
          <Button variant="plain" onClick={() => void list.refetch()}>
            Intentar otra vez
          </Button>
        </div>
      )}

      {list.isSuccess && customers.length === 0 && (
        <p className="rounded-box border border-dashed border-edge p-5 font-display text-xl font-bold leading-tight">
          {q
            ? "Nada coincide con tu búsqueda."
            : show === "blocked"
              ? "No tienes clientes bloqueados."
              : "Todavía no tienes clientes. Aparecen cuando alguien reserva."}
        </p>
      )}

      {list.isSuccess && customers.length > 0 && (
        <>
          <p className="text-sm text-muted" aria-live="polite">
            {total === 1 ? "1 cliente" : `${total} clientes`}
          </p>
          <ul className="grid gap-3">
            {customers.map((customer) => (
              <CustomerRow key={customer.id} customer={customer} timeZone={business.data?.timezone} />
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
