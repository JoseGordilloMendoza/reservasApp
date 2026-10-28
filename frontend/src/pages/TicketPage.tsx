import { ArrowLeft, Clock, WarningCircle, WhatsappLogo } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import { Box } from "../components/Box";
import { Button, ButtonLink, buttonClass } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { Ticket } from "../components/Ticket";
import { ApiError, api } from "../lib/api";
import { formatLongDate, formatTime } from "../lib/dates";
import { useAccent, useBooking, useBusiness } from "../lib/queries";
import { DEFAULT_TIME_ZONE, saveBooking } from "../lib/storage";
import { STATUS_HEADLINE, shortCode } from "../lib/status";
import type { BookingDetails } from "../lib/types";
import { whatsappLink } from "../lib/whatsapp";
import { NotFoundPage } from "./NotFoundPage";

function statusNote(booking: BookingDetails, timeZone: string): string {
  switch (booking.status) {
    case "pending":
      return booking.expires_at
        ? `El negocio tiene que confirmarla. Si no lo hace antes de las ${formatTime(booking.expires_at, timeZone)}, el horario se libera.`
        : "El negocio tiene que confirmarla.";
    case "confirmed":
      return "Todo en orden. Muestra este boleto si te lo piden.";
    case "cancelled":
      return "El horario ya quedó libre para otra persona.";
    case "expired":
      return "Nadie la confirmó a tiempo y el horario se liberó. Puedes volver a reservar.";
    case "completed":
      return "Gracias por venir.";
    case "no_show":
      return "Esta reserva quedó marcada como no asistida.";
  }
}

export function TicketPage() {
  const { slug = "", token = "" } = useParams();
  const fresh = (useLocation().state as { fresh?: boolean } | null)?.fresh === true;
  const queryClient = useQueryClient();

  const booking = useBooking(token);
  const business = useBusiness(booking.data?.business.slug ?? slug);
  useAccent(business.data?.accent);

  const timeZone = business.data?.timezone ?? DEFAULT_TIME_ZONE;

  // Opening a ticket link on a new device adds it to that device's list.
  useEffect(() => {
    if (!booking.data) return;
    saveBooking({
      slug: booking.data.business.slug,
      token,
      businessName: booking.data.business.name,
      timeZone: business.data?.timezone,
    });
  }, [booking.data, business.data?.timezone, token]);

  const [confirming, setConfirming] = useState(false);
  const cancel = useMutation({
    mutationFn: () => api.cancelBooking(token),
    onSuccess: (updated) => {
      queryClient.setQueryData(["booking", token], updated);
      setConfirming(false);
    },
    onError: () => setConfirming(false),
    // The server may also have moved the booking on its own (for example it expired).
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["booking", token] }),
  });

  if (booking.isPending || (booking.isSuccess && business.isPending)) {
    return (
      <div className="mx-auto grid max-w-[28rem] gap-6 pt-4" aria-busy="true" aria-label="Cargando">
        <Skeleton className="h-12" />
        <Skeleton className="h-[460px]" />
      </div>
    );
  }

  if (booking.isError) {
    const missing = booking.error instanceof ApiError && booking.error.status === 404;
    return (
      <NotFoundPage
        title={missing ? "No encontramos esta reserva" : "No pudimos cargar tu reserva"}
        hint={missing ? "Revisa que el link esté completo." : booking.error instanceof Error ? booking.error.message : undefined}
      />
    );
  }

  const data = booking.data;
  const note = statusNote(data, timeZone);
  const chat = business.data
    ? whatsappLink(
        business.data.whatsapp,
        `Hola ${data.business.name}, soy ${data.customer_name}. Reservé ${data.service.name} ` +
          `el ${formatLongDate(data.starts_at, timeZone)} a las ${formatTime(data.starts_at, timeZone)}. ` +
          `Código ${shortCode(token)}.`,
      )
    : null;
  const live = data.status === "pending" || data.status === "confirmed";
  const cancelError = cancel.error instanceof ApiError ? cancel.error : null;

  return (
    <div className="mx-auto grid max-w-[28rem] gap-6 pt-4">
      <Link to={`/${data.business.slug}`} className="inline-flex w-fit items-center gap-2 font-display font-bold underline decoration-[3px] underline-offset-4">
        <ArrowLeft aria-hidden="true" />
        {data.business.name}
      </Link>

      <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.9] tracking-[-0.03em]">
        {STATUS_HEADLINE[data.status]}
      </h1>

      <motion.div
        initial={fresh ? { opacity: 0, y: -60, rotate: -3 } : false}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ type: "spring", stiffness: 160, damping: 14, delay: 0.1 }}
      >
        <Ticket booking={data} token={token} timeZone={timeZone} />
      </motion.div>

      <p className="flex items-start gap-3 text-lg leading-snug" role="status">
        {data.status === "pending" && <Clock aria-hidden="true" className="mt-1 shrink-0" size={22} />}
        {note}
      </p>

      <div className="grid gap-3">
        {chat && (
          <ButtonLink href={chat} target="_blank" rel="noreferrer" variant={data.status === "pending" ? "primary" : "plain"}>
            <WhatsappLogo aria-hidden="true" />
            Avisar por WhatsApp
          </ButtonLink>
        )}

        {live && data.can_cancel && !confirming && (
          <Button variant="plain" onClick={() => setConfirming(true)}>
            Cancelar reserva
          </Button>
        )}

        {live && !data.can_cancel && data.status === "confirmed" && (
          <p className="rounded-box border-[3px] border-dashed border-line p-4 text-sm">
            Ya pasó el plazo para cancelar por aquí. Si no puedes ir, avísale al negocio por WhatsApp.
          </p>
        )}

        {!live && (
          <Link to={`/${data.business.slug}`} className={buttonClass("primary")}>
            Reservar de nuevo
          </Link>
        )}
      </div>

      {confirming && (
        <Box className="grid gap-4 p-5">
          <p className="font-display text-xl font-bold leading-tight">¿Cancelar esta reserva?</p>
          <p className="text-muted">El horario se libera para otra persona.</p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="ink" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
              Sí, cancelar
            </Button>
            <Button variant="plain" onClick={() => setConfirming(false)}>
              Mantenerla
            </Button>
          </div>
        </Box>
      )}

      {cancelError && (
        <p role="alert" className="flex items-start gap-2 rounded-box border-[3px] border-danger p-4 font-semibold text-danger">
          <WarningCircle aria-hidden="true" className="mt-0.5 shrink-0" />
          {cancelError.message}
        </p>
      )}
    </div>
  );
}
