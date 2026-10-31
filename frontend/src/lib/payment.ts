import type { PaymentMethod, PaymentStatus } from "./panelTypes";

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  unpaid: "Sin pagar",
  deposit: "Adelanto",
  paid: "Pagada",
};

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  yape: "Yape",
  plin: "Plin",
  transfer: "Transferencia",
  cash: "Efectivo",
  other: "Otro",
};

export const METHODS = Object.keys(METHOD_LABEL) as PaymentMethod[];

/** The code as it is read aloud and written: ABC-DEF. */
export function formatCode(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)}-${code.slice(3)}` : code;
}

const soles = (amount: string) => {
  const value = Number(amount);
  return `S/ ${Number.isInteger(value) ? value : value.toFixed(2)}`;
};

/** One line that says where the payment stands, for a list or the top of a booking. */
export function paymentLine(booking: {
  payment_status: PaymentStatus;
  amount_paid: string;
  balance: string | null;
  payment_method: PaymentMethod | "";
}): string {
  const method = booking.payment_method ? ` por ${METHOD_LABEL[booking.payment_method]}` : "";
  const owed = booking.balance !== null && Number(booking.balance) > 0 ? `Falta ${soles(booking.balance)}` : "";

  if (booking.payment_status === "unpaid") return owed ? `Sin pagar · ${owed}` : "Sin pagar";
  if (booking.payment_status === "deposit") return `Adelanto ${soles(booking.amount_paid)}${method}${owed ? ` · ${owed}` : ""}`;
  return `Pagada ${soles(booking.amount_paid)}${method}${owed ? ` · ${owed}` : ""}`;
}

/** Whether there is something left to collect, as the list shows it. */
export function owesSomething(booking: { payment_status: PaymentStatus; balance: string | null }): boolean {
  return booking.payment_status !== "paid" && booking.balance !== null && Number(booking.balance) > 0;
}
