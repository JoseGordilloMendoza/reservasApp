import { TicketIcon, Trash } from "@phosphor-icons/react";
import { useQueries } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Box } from "../components/Box";
import { buttonClass } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { ApiError, api } from "../lib/api";
import { formatShortDate, formatTime } from "../lib/dates";
import { STATUS_LABEL, LIVE_STATUSES } from "../lib/status";
import { DEFAULT_TIME_ZONE, forgetBooking, listSavedBookings } from "../lib/storage";
import type { SavedBooking } from "../lib/storage";
import type { BookingDetails } from "../lib/types";

interface Entry {
  saved: SavedBooking;
  booking: BookingDetails | undefined;
  loading: boolean;
  gone: boolean;
}

/** Upcoming live bookings first (soonest on top), then everything else, newest first. */
function order(entries: Entry[], now = Date.now()): Entry[] {
  const upcoming = (entry: Entry) =>
    !!entry.booking &&
    LIVE_STATUSES.includes(entry.booking.status) &&
    new Date(entry.booking.ends_at).getTime() >= now;

  const time = (entry: Entry) => (entry.booking ? new Date(entry.booking.starts_at).getTime() : 0);
  return [
    ...entries.filter(upcoming).sort((a, b) => time(a) - time(b)),
    ...entries.filter((entry) => !upcoming(entry)).sort((a, b) => time(b) - time(a)),
  ];
}

export function MyBookingsPage() {
  const [saved, setSaved] = useState(listSavedBookings);

  const results = useQueries({
    queries: saved.map((item) => ({
      queryKey: ["booking", item.token],
      queryFn: () => api.booking(item.token),
      staleTime: 15_000,
    })),
  });

  const entries = order(
    saved.map((item, index) => {
      const result = results[index];
      return {
        saved: item,
        booking: result?.data,
        loading: result?.isPending ?? true,
        gone: result?.error instanceof ApiError && result.error.status === 404,
      };
    }),
  );

  function remove(token: string) {
    forgetBooking(token);
    setSaved(listSavedBookings());
  }

  return (
    <div className="mx-auto grid max-w-[40rem] gap-6 pt-4">
      <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.9] tracking-[-0.03em]">
        Mis reservas
      </h1>

      {entries.length === 0 && (
        <Box className="grid gap-4 p-6">
          <TicketIcon size={40} weight="bold" aria-hidden="true" />
          <p className="font-display text-2xl font-bold leading-tight">Aquí aparecerán tus boletos.</p>
          <p className="text-muted">
            Se guardan solo en este celular. Si reservas desde otro, abre el link de tu boleto para verlo aquí.
          </p>
          <Link to="/" className={buttonClass("primary", "w-fit")}>
            Ir al inicio
          </Link>
        </Box>
      )}

      <ul className="grid gap-4">
        {entries.map(({ saved: item, booking, loading, gone }) => {
          const timeZone = item.timeZone ?? DEFAULT_TIME_ZONE;
          return (
            <li key={item.token} className="grid gap-2">
              {loading && <Skeleton className="h-[104px]" />}

              {!loading && booking && (
                <Link
                  to={`/${item.slug}/reserva/${item.token}`}
                  className="press flex items-center justify-between gap-4 rounded-box border-[3px] border-line bg-surface p-4 shadow-hard"
                >
                  <span className="grid gap-1">
                    <span className="font-display text-xl font-extrabold leading-tight">{booking.business.name}</span>
                    <span className="text-sm text-muted">{booking.service.name}</span>
                    <span className="font-mono text-base font-bold">
                      {formatShortDate(booking.starts_at, timeZone)} {formatTime(booking.starts_at, timeZone)}
                    </span>
                  </span>
                  <span className="shrink-0 -rotate-3 rounded-[8px] border-[3px] border-current px-2 py-1 font-display text-sm font-extrabold uppercase">
                    {STATUS_LABEL[booking.status]}
                  </span>
                </Link>
              )}

              {!loading && !booking && (
                <Box flat className="p-4">
                  <p className="font-semibold">{item.businessName}</p>
                  <p className="text-sm text-muted">
                    {gone ? "Esta reserva ya no existe." : "No pudimos cargarla ahora."}
                  </p>
                </Box>
              )}

              <button
                type="button"
                onClick={() => remove(item.token)}
                className="inline-flex w-fit items-center gap-2 px-1 text-sm font-semibold text-muted underline underline-offset-4"
              >
                <Trash aria-hidden="true" size={16} />
                Quitar de este celular
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
