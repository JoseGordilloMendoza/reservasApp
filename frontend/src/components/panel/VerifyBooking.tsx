import { MagnifyingGlass, UserCheck } from "@phosphor-icons/react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { formatTime, relativeDay } from "../../lib/dates";
import { useBookingList } from "../../lib/panelQueries";
import type { PanelBooking } from "../../lib/panelTypes";
import { useRecordBooking } from "../../lib/panelQueries";
import { formatCode, owesSomething, paymentLine } from "../../lib/payment";
import { useDebounced } from "../../lib/useDebounced";
import { StatusBadge } from "../StatusBadge";
import { Button } from "../Button";
import { Skeleton } from "../Skeleton";

const LIVE = ["pending", "confirmed", "completed"];

function Match({ booking, timeZone }: { booking: PanelBooking; timeZone: string }) {
  const record = useRecordBooking(booking.id);
  const canArrive = LIVE.includes(booking.status);

  return (
    <li className="grid gap-3 rounded-box border-[3px] border-line bg-surface p-4 text-text shadow-hard-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/panel/reservas/${booking.id}`} className="block truncate font-display text-xl font-extrabold leading-tight underline decoration-[3px] underline-offset-4">
            {booking.customer.name}
          </Link>
          <p className="mt-1 text-sm text-muted">
            {booking.service.name} · {booking.resource.name}
          </p>
          <p className="font-mono text-sm font-bold">{formatCode(booking.code)}</p>
        </div>
        <div className="grid shrink-0 justify-items-end gap-2">
          <p className="text-right font-mono font-bold leading-tight">
            {relativeDay(booking.starts_at, timeZone)}
            <span className="block text-xl">{formatTime(booking.starts_at, timeZone)}</span>
          </p>
          <StatusBadge status={booking.status} />
        </div>
      </div>

      <p className={`text-sm font-semibold ${owesSomething(booking) ? "text-danger" : ""}`}>{paymentLine(booking)}</p>

      {canArrive &&
        (booking.arrived_at ? (
          <p className="flex items-center gap-2 font-semibold">
            <UserCheck aria-hidden="true" />
            Llegó a las {formatTime(booking.arrived_at, timeZone)}
          </p>
        ) : (
          <Button onClick={() => record.mutate({ arrived: true })} disabled={record.isPending}>
            <UserCheck aria-hidden="true" />
            Llegó
          </Button>
        ))}

      {record.error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {record.error.message}
        </p>
      )}
    </li>
  );
}

/** For the moment a customer walks in: type their code or their name and mark them as arrived. */
export function VerifyBooking({ timeZone }: { timeZone: string | undefined }) {
  const [typed, setTyped] = useState("");
  const settled = useDebounced(typed, 300);
  const ready = typed.trim().length >= 2;
  const search = useBookingList({ q: settled, status: ["pending", "confirmed", "completed"], ordering: "-starts_at" }, ready && settled.trim().length >= 2);
  const waiting = ready && (search.isPending || typed.trim() !== settled.trim());
  const results = ready ? (search.data?.pages.flatMap((page) => page.results) ?? []).slice(0, 6) : [];

  return (
    <section aria-labelledby="verificar" className="grid gap-4">
      <h2 id="verificar" className="font-display text-3xl font-extrabold leading-none">
        Verificar una reserva
      </h2>
      <label className="relative block">
        <span className="sr-only">Código o nombre de quien llegó</span>
        <MagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={22} />
        <input
          type="search"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          placeholder="Código (K7M-42X) o nombre"
          className="min-h-[52px] w-full rounded-box border-[3px] border-line bg-surface pl-12 pr-4 text-lg text-text placeholder:text-muted/70 focus:shadow-hard focus:outline-none"
        />
      </label>

      <div aria-live="polite" className="grid gap-3">
        {waiting && results.length === 0 && <Skeleton className="h-[120px]" />}

        {ready && !waiting && search.isSuccess && results.length === 0 && (
          <p className="rounded-box border-[3px] border-dashed border-line p-4 font-semibold">
            No encontramos esa reserva. Revisa el código o prueba con el nombre.
          </p>
        )}

        {ready && !waiting && search.isError && (
          <p role="alert" className="font-semibold text-danger">
            No pudimos buscar ahora. {search.error.message}
          </p>
        )}

        {timeZone && results.length > 0 && (
          <ul className="grid gap-3">
            {results.map((booking) => (
              <Match key={booking.id} booking={booking} timeZone={timeZone} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
