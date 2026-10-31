import { formatTime, relativeDay } from "./dates";
import type { PanelBooking } from "./panelTypes";
import { formatCode } from "./payment";
import { whatsappLink } from "./whatsapp";

export interface QuickMessage {
  id: "reminder" | "payment" | "unconfirmed";
  label: string;
  /** A wa.me link that opens the chat with the message already written, or null when the phone is not usable. */
  href: string | null;
}

interface Context {
  /** The name of the business, as the customer knows it. */
  business: string;
  timeZone: string;
  /** What the owner wrote in "Cómo te pagan". */
  paymentInstructions: string;
  now?: Date;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

/**
 * The messages an owner writes again and again, ready to send from the booking they are about. They only
 * open the chat: nothing is sent until the owner presses send in WhatsApp.
 */
export function quickMessages(booking: PanelBooking, { business, timeZone, paymentInstructions, now }: Context): QuickMessage[] {
  const hello = `Hola ${firstName(booking.customer.name)}`;
  const what = `tu reserva de ${booking.service.name} ${relativeDay(booking.starts_at, timeZone, now).toLowerCase()} a las ${formatTime(booking.starts_at, timeZone)} en ${business}`;
  const code = formatCode(booking.code);
  const link = (text: string) => whatsappLink(booking.customer.phone, text);
  const messages: QuickMessage[] = [];

  if (booking.status === "pending") {
    messages.push({
      id: "unconfirmed",
      label: "Avisar que no pude confirmar",
      href: link(`${hello}, no pudimos confirmar ${what}. ¿Te viene bien que coordinemos otro horario?`),
    });
  }

  if ((booking.status === "pending" || booking.status === "confirmed") && booking.payment_status !== "paid" && paymentInstructions.trim()) {
    messages.push({
      id: "payment",
      label: "Enviar cómo pagar",
      href: link(`${hello}, ${what} (código ${code}). Para asegurarla puedes pagar así: ${paymentInstructions.trim()}. Cuando lo hagas, avísanos por aquí.`),
    });
  }

  if (booking.status === "confirmed" && !booking.arrived_at) {
    messages.push({
      id: "reminder",
      label: booking.customer_confirmed_at ? "Recordar la reserva" : "Recordar y pedir que confirme",
      href: link(`${hello}, te recordamos ${what}. Tu código es ${code}. ¿Nos confirmas que vienes?`),
    });
  }

  return messages;
}

/** Whether the customer's "I am coming" is expected now: a confirmed booking in the day before it starts. */
export function attendanceIsDue(booking: PanelBooking, now: Date = new Date()): boolean {
  if (booking.status !== "confirmed" || booking.arrived_at) return false;
  const start = new Date(booking.starts_at).getTime();
  return start - 24 * 3_600_000 <= now.getTime() && now.getTime() < start;
}
