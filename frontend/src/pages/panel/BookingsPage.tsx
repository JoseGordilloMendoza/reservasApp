import { MagnifyingGlass } from "@phosphor-icons/react";
import { useState } from "react";
import { useDeferredValue } from "react";

import { Button } from "../../components/Button";
import { BookingRow } from "../../components/panel/BookingCards";
import { Skeleton } from "../../components/Skeleton";
import { addDays, dateKey, relativeDay, todayKey } from "../../lib/dates";
import type { BookingFilters, PanelBooking } from "../../lib/panelTypes";
import { useBookingList, usePanelBusiness } from "../../lib/panelQueries";

type TabId = "upcoming" | "pending" | "past" | "cancelled";

const TABS: { id: TabId; label: string }[] = [
  { id: "upcoming", label: "Próximas" },
  { id: "pending", label: "Por confirmar" },
  { id: "past", label: "Pasadas" },
  { id: "cancelled", label: "Canceladas" },
];

function filtersFor(tab: TabId, q: string, today: string): BookingFilters {
  switch (tab) {
    case "upcoming":
      return { status: ["pending", "confirmed"], dateFrom: today, ordering: "starts_at", q };
    case "pending":
      return { status: ["pending"], ordering: "starts_at", q };
    case "past":
      return { status: ["confirmed", "completed", "no_show"], dateTo: addDays(today, -1), ordering: "-starts_at", q };
    case "cancelled":
      return { status: ["cancelled", "expired"], ordering: "-starts_at", q };
  }
}

/** Bookings grouped under the day they happen, in the order they came. */
function byDay(bookings: PanelBooking[], timeZone: string) {
  const groups: { day: string; label: string; items: PanelBooking[] }[] = [];
  for (const booking of bookings) {
    const day = dateKey(booking.starts_at, timeZone);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(booking);
    else groups.push({ day, label: relativeDay(booking.starts_at, timeZone), items: [booking] });
  }
  return groups;
}

const EMPTY: Record<TabId, string> = {
  upcoming: "No hay reservas próximas.",
  pending: "No hay reservas por confirmar.",
  past: "Todavía no hay reservas pasadas.",
  cancelled: "No hay reservas canceladas.",
};

export function BookingsPage() {
  const business = usePanelBusiness();
  const timeZone = business.data?.timezone;

  const [tab, setTab] = useState<TabId>("upcoming");
  const [search, setSearch] = useState("");
  const q = useDeferredValue(search.trim());

  // The date filters need the business calendar, so wait until its timezone is known.
  const list = useBookingList(filtersFor(tab, q, timeZone ? todayKey(timeZone) : ""), timeZone !== undefined);
  const bookings = list.data?.pages.flatMap((page) => page.results) ?? [];
  const total = list.data?.pages[0]?.count ?? 0;

  return (
    <div className="grid grid-cols-1 gap-6">
      <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.9] tracking-[-0.03em]">Reservas</h1>

      <div role="tablist" aria-label="Filtrar reservas" className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 pt-1 [scrollbar-width:none] md:mx-0 md:px-0">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={
              "press min-h-[48px] shrink-0 rounded-box border-[3px] border-line px-4 font-display text-base font-bold " +
              (tab === id ? "bg-accent text-on-accent shadow-hard" : "bg-surface text-text shadow-hard-sm")
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
          className="min-h-[52px] w-full rounded-box border-[3px] border-line bg-surface pl-12 pr-4 text-lg text-text placeholder:text-muted/70 focus:shadow-hard focus:outline-none"
        />
      </label>

      {(list.isPending || !timeZone) && (
        <div className="grid gap-3" aria-busy="true" aria-label="Cargando">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-[72px]" />
          ))}
        </div>
      )}

      {list.isError && (
        <div role="alert" className="grid gap-3 rounded-box border-[3px] border-danger p-4">
          <p className="font-semibold text-danger">No pudimos cargar las reservas. {list.error.message}</p>
          <Button variant="plain" onClick={() => void list.refetch()}>
            Intentar otra vez
          </Button>
        </div>
      )}

      {list.isSuccess && timeZone && bookings.length === 0 && (
        <p className="rounded-box border-[3px] border-dashed border-line p-5 font-display text-xl font-bold leading-tight">
          {q ? "Nada coincide con tu búsqueda." : EMPTY[tab]}
        </p>
      )}

      {list.isSuccess && timeZone && bookings.length > 0 && (
        <>
          <p className="text-sm text-muted" aria-live="polite">
            {total === 1 ? "1 reserva" : `${total} reservas`}
          </p>
          <div className="grid gap-6">
            {byDay(bookings, timeZone).map((group) => (
              <section key={group.day} aria-label={group.label} className="grid gap-3">
                <h2 className="font-display text-xl font-extrabold">{group.label}</h2>
                <ul className="grid gap-3">
                  {group.items.map((booking) => (
                    <BookingRow key={booking.id} booking={booking} timeZone={timeZone} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
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
