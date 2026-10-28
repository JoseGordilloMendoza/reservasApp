import { ArrowLeft, Prohibit, X } from "@phosphor-icons/react";
import { Link, useParams } from "react-router-dom";

import { Button } from "../../components/Button";
import { ConfirmAction } from "../../components/ConfirmAction";
import { ContactLinks } from "../../components/ContactLinks";
import { Skeleton } from "../../components/Skeleton";
import { StatusBadge } from "../../components/StatusBadge";
import { formatTime, relativeDay } from "../../lib/dates";
import { ApiError } from "../../lib/http";
import type { CustomerBooking, CustomerDetail } from "../../lib/panelTypes";
import { useCustomerDetail, usePanelBusiness, useUpdateCustomer } from "../../lib/panelQueries";
import { NotFoundPage } from "../NotFoundPage";

function BlockControl({ customer }: { customer: CustomerDetail }) {
  const update = useUpdateCustomer();

  return (
    <div className="grid gap-3">
      {customer.is_blocked ? (
        <>
          <p className="flex items-start gap-2 rounded-box border-[3px] border-danger p-4 font-semibold text-danger">
            <Prohibit aria-hidden="true" className="mt-0.5 shrink-0" />
            Este cliente está bloqueado: no puede reservar en línea. Tú sí puedes anotarle reservas.
          </p>
          <Button
            variant="plain"
            disabled={update.isPending}
            onClick={() => update.mutate({ id: customer.id, is_blocked: false })}
          >
            Desbloquear
          </Button>
        </>
      ) : (
        <ConfirmAction
          label="Bloquear cliente"
          question="¿Bloquear a este cliente? No podrá reservar en línea."
          confirmLabel="Sí, bloquear"
          busy={update.isPending}
          onConfirm={() => update.mutate({ id: customer.id, is_blocked: true })}
        />
      )}

      {update.error && (
        <p role="alert" className="flex items-start gap-2 rounded-box border-[3px] border-danger p-3 font-semibold text-danger">
          <X aria-hidden="true" className="mt-0.5 shrink-0" />
          {update.error.message}
        </p>
      )}
    </div>
  );
}

function HistoryRow({ booking, timeZone }: { booking: CustomerBooking; timeZone: string }) {
  return (
    <li>
      <Link
        to={`/panel/reservas/${booking.id}`}
        className="press flex items-center gap-4 rounded-box border-[3px] border-line bg-surface p-3 text-text shadow-hard-sm"
      >
        <span className="w-[5.5rem] shrink-0 font-mono text-sm font-bold leading-tight">
          {relativeDay(booking.starts_at, timeZone)}
          <span className="block text-lg">{formatTime(booking.starts_at, timeZone)}</span>
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-muted">
          {booking.service.name} · {booking.resource.name}
        </span>
        <StatusBadge status={booking.status} />
      </Link>
    </li>
  );
}

export function CustomerDetailPage() {
  const id = Number(useParams().id);
  const business = usePanelBusiness();
  const detail = useCustomerDetail(id);
  const timeZone = business.data?.timezone;

  if (detail.isError) {
    const missing = detail.error instanceof ApiError && detail.error.status === 404;
    return (
      <NotFoundPage
        title={missing ? "No encontramos a ese cliente" : "No pudimos cargar al cliente"}
        hint={missing ? undefined : detail.error.message}
      />
    );
  }

  if (detail.isPending || !timeZone || !business.data) {
    return (
      <div className="grid gap-4" aria-busy="true" aria-label="Cargando">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[260px]" />
      </div>
    );
  }

  const customer = detail.data;
  const count = customer.bookings_count === 1 ? "1 reserva" : `${customer.bookings_count} reservas`;

  return (
    <div className="grid max-w-[34rem] gap-6">
      <Link to="/panel/clientes" className="inline-flex w-fit items-center gap-2 font-display font-bold underline decoration-[3px] underline-offset-4">
        <ArrowLeft aria-hidden="true" />
        Clientes
      </Link>

      <article className="grid gap-4 rounded-box border-[3px] border-line bg-surface p-5 text-text shadow-hard">
        <h1 className="break-words font-display text-3xl font-extrabold leading-[0.95] sm:text-4xl">{customer.name}</h1>
        <p className="text-muted">{count}</p>
        {customer.email && <p className="break-all font-semibold">{customer.email}</p>}
        <ContactLinks phone={customer.phone} message={`Hola ${customer.name}, te escribo de ${business.data.name}.`} />
      </article>

      <BlockControl customer={customer} />

      <section aria-labelledby="historial" className="grid gap-3">
        <h2 id="historial" className="font-display text-2xl font-extrabold">
          Historial
        </h2>
        {customer.bookings.length === 0 ? (
          <p className="rounded-box border-[3px] border-dashed border-line p-4 font-semibold">Todavía no tiene reservas.</p>
        ) : (
          <ul className="grid gap-3">
            {customer.bookings.map((booking) => (
              <HistoryRow key={booking.id} booking={booking} timeZone={timeZone} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
