import { Check, Clock, X } from "@phosphor-icons/react";
import { Link } from "react-router-dom";

import { clockLabel, formatTime, relativeDay } from "../../lib/dates";
import { formatPrice } from "../../lib/format";
import type { PanelBooking } from "../../lib/panelTypes";
import { useBookingAction } from "../../lib/panelQueries";
import { Button } from "../Button";
import { ConfirmAction } from "../ConfirmAction";
import { ContactLinks } from "../ContactLinks";
import { StatusBadge } from "../StatusBadge";

/** What the owner would say to a customer about their booking. */
export function greeting(booking: PanelBooking, business: string, timeZone: string): string {
  return (
    `Hola ${booking.customer.name}, te escribo de ${business} por tu reserva de ` +
    `${booking.service.name} (${relativeDay(booking.starts_at, timeZone)} a las ${formatTime(booking.starts_at, timeZone)}).`
  );
}

interface Props {
  booking: PanelBooking;
  business: string;
  timeZone: string;
}

/** A booking waiting for an answer: everything needed to confirm or reject it without opening it. */
export function PendingCard({ booking, business, timeZone }: Props) {
  const action = useBookingAction();
  const price = formatPrice(booking.price);

  return (
    <li className="grid gap-4 rounded-box border-[3px] border-line bg-surface p-4 text-text shadow-hard">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/panel/reservas/${booking.id}`} className="block truncate font-display text-2xl font-extrabold leading-tight underline decoration-[3px] underline-offset-4">
            {booking.customer.name}
          </Link>
          <p className="mt-1 text-sm text-muted">
            {booking.service.name} · {booking.resource.name}
            {price ? ` · ${price}` : ""}
          </p>
        </div>
        <p className="shrink-0 text-right font-mono text-lg font-bold leading-tight">
          {relativeDay(booking.starts_at, timeZone)}
          <span className="block text-2xl">{formatTime(booking.starts_at, timeZone)}</span>
        </p>
      </div>

      {booking.expires_at && (
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Clock aria-hidden="true" />
          Si no respondes, se libera a {clockLabel(booking.expires_at, timeZone)}
        </p>
      )}

      <ContactLinks phone={booking.customer.phone} message={greeting(booking, business, timeZone)} />

      <div className="grid gap-3">
        <Button onClick={() => action.mutate({ id: booking.id, action: "confirm" })} disabled={action.isPending}>
          <Check aria-hidden="true" />
          Confirmar
        </Button>
        <ConfirmAction
          label="Rechazar"
          question="¿Rechazar esta reserva?"
          confirmLabel="Sí, rechazar"
          busy={action.isPending}
          onConfirm={() => action.mutate({ id: booking.id, action: "reject" })}
        />
      </div>

      {action.error && (
        <p role="alert" className="flex items-start gap-2 rounded-box border-[3px] border-danger p-3 text-sm font-semibold text-danger">
          <X aria-hidden="true" className="mt-0.5 shrink-0" />
          {action.error.message}
        </p>
      )}
    </li>
  );
}

/** One line of a list of bookings: the time first, because that is how the day is read. */
export function BookingRow({ booking, timeZone, showDay = false }: { booking: PanelBooking; timeZone: string; showDay?: boolean }) {
  return (
    <li>
      <Link
        to={`/panel/reservas/${booking.id}`}
        className="press flex items-center gap-4 rounded-box border-[3px] border-line bg-surface p-3 text-text shadow-hard-sm"
      >
        <span className="w-[4.5rem] shrink-0 font-mono text-xl font-bold leading-tight">
          {formatTime(booking.starts_at, timeZone)}
          {showDay && <span className="block text-xs font-semibold text-muted">{relativeDay(booking.starts_at, timeZone)}</span>}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-lg font-bold leading-tight">{booking.customer.name}</span>
          <span className="block truncate text-sm text-muted">
            {booking.service.name} · {booking.resource.name}
          </span>
        </span>
        <StatusBadge status={booking.status} />
      </Link>
    </li>
  );
}
