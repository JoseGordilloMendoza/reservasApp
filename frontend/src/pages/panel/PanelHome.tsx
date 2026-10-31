import { CalendarBlank, CheckCircle } from "@phosphor-icons/react";
import { Link } from "react-router-dom";

import { buttonClass } from "../../components/Button";
import { BookingRow, PendingCard } from "../../components/panel/BookingCards";
import { VerifyBooking } from "../../components/panel/VerifyBooking";
import { Skeleton } from "../../components/Skeleton";
import { useAuth } from "../../lib/auth";
import { usePanelBusiness, usePendingBookings, useTodayBookings } from "../../lib/panelQueries";

function Heading({ id, children, count }: { id: string; children: string; count?: number }) {
  return (
    <h2 id={id} className="flex items-center gap-3 font-display text-3xl font-extrabold leading-none">
      {children}
      {count !== undefined && count > 0 && (
        <span className="grid min-w-9 place-items-center rounded-[8px] border-[3px] border-line bg-accent px-2 py-1 text-lg text-on-accent">
          {count}
        </span>
      )}
    </h2>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="grid gap-3" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-[84px]" />
      ))}
    </div>
  );
}

export function PanelHome() {
  const { user } = useAuth();
  const business = usePanelBusiness();
  const pending = usePendingBookings();
  const today = useTodayBookings(business.data?.timezone);

  const timeZone = business.data?.timezone;
  const name = business.data?.name ?? "";
  const first = user?.name.split(" ")[0];

  if (business.isError) {
    return <p role="alert" className="font-semibold text-danger">No pudimos cargar tu negocio. {business.error.message}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-10">
      <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.9] tracking-[-0.03em]">
        {first ? `Hola, ${first}` : "Hola"}
      </h1>

      <VerifyBooking timeZone={timeZone} />

      <section aria-labelledby="por-confirmar" className="grid gap-4">
        <Heading id="por-confirmar" count={pending.data?.count}>
          Por confirmar
        </Heading>

        {(pending.isPending || !timeZone) && <ListSkeleton rows={2} />}
        {pending.isError && <p role="alert" className="font-semibold text-danger">No pudimos cargar las reservas. {pending.error.message}</p>}

        {pending.isSuccess && timeZone && pending.data.results.length === 0 && (
          <p className="flex items-center gap-3 rounded-box border-[3px] border-dashed border-line p-4 text-lg font-semibold">
            <CheckCircle aria-hidden="true" size={28} />
            Nada por confirmar. Todo al día.
          </p>
        )}

        {pending.isSuccess && timeZone && (
          <ul className="grid gap-5">
            {pending.data.results.map((booking) => (
              <PendingCard key={booking.id} booking={booking} business={name} timeZone={timeZone} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="hoy" className="grid gap-4">
        <Heading id="hoy">Hoy</Heading>

        {(today.isPending || !timeZone) && <ListSkeleton rows={3} />}
        {today.isError && <p role="alert" className="font-semibold text-danger">No pudimos cargar el día. {today.error.message}</p>}

        {today.isSuccess && timeZone && today.data.results.length === 0 && (
          <div className="grid justify-items-start gap-4 rounded-box border-[3px] border-dashed border-line p-5">
            <CalendarBlank aria-hidden="true" size={32} />
            <p className="font-display text-xl font-bold leading-tight">Hoy no hay reservas.</p>
            <Link to="/panel/reservas/nueva" className={buttonClass("plain")}>
              Anotar una reserva
            </Link>
          </div>
        )}

        {today.isSuccess && timeZone && (
          <ul className="grid gap-3">
            {today.data.results.map((booking) => (
              <BookingRow key={booking.id} booking={booking} timeZone={timeZone} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
