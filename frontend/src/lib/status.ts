import type { BookingStatus } from "./types";

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  completed: "Atendida",
  cancelled: "Cancelada",
  expired: "Vencida",
  no_show: "No asistió",
};

/** Statuses of a booking that still stands. */
export const LIVE_STATUSES: BookingStatus[] = ["pending", "confirmed"];

export const STATUS_HEADLINE: Record<BookingStatus, string> = {
  pending: "Casi lista",
  confirmed: "Reserva lista",
  completed: "Ya la usaste",
  cancelled: "Reserva cancelada",
  expired: "Esta reserva venció",
  no_show: "No asististe",
};
