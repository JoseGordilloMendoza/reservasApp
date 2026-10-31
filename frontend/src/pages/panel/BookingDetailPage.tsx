import { ArrowLeft, Check, X } from "@phosphor-icons/react";
import { Link, useParams } from "react-router-dom";

import { Button } from "../../components/Button";
import { ConfirmAction } from "../../components/ConfirmAction";
import { ContactLinks } from "../../components/ContactLinks";
import { greeting } from "../../components/panel/BookingCards";
import { PaymentCard } from "../../components/panel/PaymentCard";
import { Skeleton } from "../../components/Skeleton";
import { StatusBadge } from "../../components/StatusBadge";
import { ApiError } from "../../lib/http";
import { formatLongDate, formatTime } from "../../lib/dates";
import { formatDuration, formatPrice } from "../../lib/format";
import { formatCode } from "../../lib/payment";
import type { BookingEvent, PanelBookingDetail } from "../../lib/panelTypes";
import { useBookingAction, useBookingDetail, usePanelBusiness } from "../../lib/panelQueries";
import { STATUS_LABEL } from "../../lib/status";
import { NotFoundPage } from "../NotFoundPage";

const ACTOR: Record<BookingEvent["actor"], string> = {
  customer: "el cliente",
  business: "el negocio",
  system: "el sistema",
};

function Event({ event, timeZone }: { event: BookingEvent; timeZone: string }) {
  const what = event.from_status === "" ? "Reservó" : `Pasó a ${STATUS_LABEL[event.to_status].toLowerCase()}`;
  return (
    <li className="flex items-baseline justify-between gap-4 border-t-[3px] border-dashed border-line/40 py-3 first:border-t-0">
      <span className="font-semibold">
        {what} <span className="font-normal text-muted">por {ACTOR[event.actor]}</span>
      </span>
      <time dateTime={event.created_at} className="shrink-0 font-mono text-sm text-muted">
        {formatTime(event.created_at, timeZone)}
      </time>
    </li>
  );
}

function Actions({ booking }: { booking: PanelBookingDetail }) {
  const action = useBookingAction();
  const run = (name: Parameters<typeof action.mutate>[0]["action"]) => action.mutate({ id: booking.id, action: name });
  const started = new Date(booking.starts_at).getTime() <= Date.now();

  return (
    <div className="grid gap-3">
      {booking.status === "pending" && (
        <>
          <Button onClick={() => run("confirm")} disabled={action.isPending}>
            <Check aria-hidden="true" />
            Confirmar
          </Button>
          <ConfirmAction
            label="Rechazar"
            question="¿Rechazar esta reserva?"
            confirmLabel="Sí, rechazar"
            busy={action.isPending}
            onConfirm={() => run("reject")}
          />
        </>
      )}

      {booking.status === "confirmed" && started && (
        <>
          <Button onClick={() => run("complete")} disabled={action.isPending}>
            <Check aria-hidden="true" />
            Marcar como atendida
          </Button>
          <Button variant="plain" onClick={() => run("no-show")} disabled={action.isPending}>
            No asistió
          </Button>
        </>
      )}

      {booking.status === "confirmed" && (
        <ConfirmAction
          label="Cancelar reserva"
          question="¿Cancelar esta reserva?"
          confirmLabel="Sí, cancelar"
          busy={action.isPending}
          onConfirm={() => run("cancel")}
        />
      )}

      {action.error && (
        <p role="alert" className="flex items-start gap-2 rounded-box border-[3px] border-danger p-3 font-semibold text-danger">
          <X aria-hidden="true" className="mt-0.5 shrink-0" />
          {action.error.message}
        </p>
      )}
    </div>
  );
}

export function BookingDetailPage() {
  const id = Number(useParams().id);
  const business = usePanelBusiness();
  const detail = useBookingDetail(id);
  const timeZone = business.data?.timezone;

  if (detail.isError) {
    const missing = detail.error instanceof ApiError && detail.error.status === 404;
    return (
      <NotFoundPage
        title={missing ? "No encontramos esa reserva" : "No pudimos cargar la reserva"}
        hint={missing ? undefined : detail.error.message}
      />
    );
  }

  if (detail.isPending || !timeZone || !business.data) {
    return (
      <div className="grid gap-4" aria-busy="true" aria-label="Cargando">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[360px]" />
      </div>
    );
  }

  const booking = detail.data;
  const price = formatPrice(booking.price);

  return (
    <div className="grid max-w-[34rem] grid-cols-1 gap-6">
      <Link to="/panel/reservas" className="inline-flex w-fit items-center gap-2 font-display font-bold underline decoration-[3px] underline-offset-4">
        <ArrowLeft aria-hidden="true" />
        Reservas
      </Link>

      <article className="grid gap-5 rounded-box border-[3px] border-line bg-surface p-5 text-text shadow-hard">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words font-display text-3xl font-extrabold leading-[0.95] sm:text-4xl">{booking.customer.name}</h1>
            <p className="mt-2 text-muted">
              {booking.source === "business" ? "Anotada por el negocio" : "Reservada por el cliente"}
            </p>
          </div>
          <StatusBadge status={booking.status} />
        </header>

        <p className="w-fit rounded-box border-[3px] border-line bg-paper px-3 py-1 font-mono text-xl font-bold tracking-widest">
          <span className="sr-only">Código de reserva </span>
          {formatCode(booking.code)}
        </p>

        <div>
          <p className="font-display text-xl font-bold first-letter:uppercase">{formatLongDate(booking.starts_at, timeZone)}</p>
          <p className="mt-1 font-mono text-5xl font-bold leading-none">
            {formatTime(booking.starts_at, timeZone)}
            <span className="ml-2 text-2xl font-semibold text-muted">a {formatTime(booking.ends_at, timeZone)}</span>
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-muted">Servicio</dt>
            <dd className="font-semibold">{booking.service.name}</dd>
          </div>
          <div>
            <dt className="text-muted">Lugar</dt>
            <dd className="font-semibold">{booking.resource.name}</dd>
          </div>
          <div>
            <dt className="text-muted">Duración</dt>
            <dd className="font-semibold">{formatDuration(booking.duration_minutes)}</dd>
          </div>
          {price && (
            <div>
              <dt className="text-muted">Precio</dt>
              <dd className="font-mono font-bold">{price}</dd>
            </div>
          )}
          {booking.customer.email && (
            <div className="col-span-2">
              <dt className="text-muted">Correo</dt>
              <dd className="break-all font-semibold">{booking.customer.email}</dd>
            </div>
          )}
        </dl>

        <ContactLinks phone={booking.customer.phone} message={greeting(booking, business.data.name, timeZone)} />
      </article>

      <Actions key={booking.status} booking={booking} />

      <PaymentCard key={`${booking.payment_status}-${booking.arrived_at}-${booking.internal_note}`} booking={booking} timeZone={timeZone} />

      <section aria-labelledby="historial" className="grid gap-2">
        <h2 id="historial" className="font-display text-2xl font-extrabold">
          Historial
        </h2>
        <ul className="rounded-box border-[3px] border-line bg-surface px-4 text-text">
          {booking.events.map((event) => (
            <Event key={`${event.created_at}-${event.to_status}`} event={event} timeZone={timeZone} />
          ))}
        </ul>
      </section>
    </div>
  );
}
