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

/** A short, stable reference derived from the token without revealing any part of it. */
export function shortCode(token: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36).toUpperCase().padStart(7, "0").slice(-7);
}
