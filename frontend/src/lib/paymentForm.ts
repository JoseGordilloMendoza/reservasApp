import type { NewPayment, PaymentMethod } from "./platformTypes";

// The form for recording a payment received from a business.

export interface PaymentValues {
  amount: string;
  method: PaymentMethod;
  months: string;
  /** Empty means today. */
  paidOn: string;
  reference: string;
  note: string;
}

export type PaymentErrors = Partial<Record<keyof PaymentValues, string>>;

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  yape: "Yape",
  plin: "Plin",
  transfer: "Transferencia",
  cash: "Efectivo",
  other: "Otro",
};

export const METHODS = Object.keys(METHOD_LABEL) as PaymentMethod[];

/** A blank form, with the agreed monthly price as the amount: most payments are exactly that. */
export const emptyPayment = (price = ""): PaymentValues => ({
  amount: price.replace(/\.00$/, ""),
  method: "yape",
  months: "1",
  paidOn: "",
  reference: "",
  note: "",
});

const AMOUNT = /^\d{1,6}([.,]\d{1,2})?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validatePayment(values: PaymentValues): PaymentErrors {
  const errors: PaymentErrors = {};

  const amount = values.amount.trim();
  if (!amount) errors.amount = "Escribe cuánto pagó.";
  else if (!AMOUNT.test(amount)) errors.amount = "Escribe el monto en soles, por ejemplo 80 o 79.90.";

  const months = values.months.trim();
  if (!/^\d+$/.test(months) || Number(months) < 1 || Number(months) > 24) errors.months = "Entre 1 y 24 meses.";

  if (values.paidOn && !DATE.test(values.paidOn)) errors.paidOn = "Elige la fecha del pago.";
  if (values.reference.length > 80) errors.reference = "Máximo 80 caracteres.";
  if (values.note.length > 200) errors.note = "Máximo 200 caracteres.";
  return errors;
}

/** What the API receives. Call it only with values that passed `validatePayment`. */
export function toNewPayment(values: PaymentValues): NewPayment {
  const reference = values.reference.trim();
  const note = values.note.trim();
  return {
    amount: Number(values.amount.trim().replace(",", ".")).toFixed(2),
    method: values.method,
    months: Number(values.months.trim()),
    ...(values.paidOn ? { paid_on: values.paidOn } : {}),
    ...(reference ? { reference } : {}),
    ...(note ? { note } : {}),
  };
}
