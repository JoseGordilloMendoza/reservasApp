// The service form: what is typed, what is wrong with it, and what the API gets.

export interface ServiceValues {
  /** A resource id; only chosen when the service is created. */
  resource: string;
  name: string;
  duration: string;
  /** In soles. Empty means the service has no reference price. */
  price: string;
}

export type ServiceErrors = Partial<Record<keyof ServiceValues, string>>;

export const MIN_DURATION = 5;
export const MAX_DURATION = 1440;

/** "60", "60.5" and "60,50" are all fine; the comma is how many people type decimals. */
const PRICE = /^\d{1,6}([.,]\d{1,2})?$/;

export function validateService(values: ServiceValues, { creating }: { creating: boolean }): ServiceErrors {
  const errors: ServiceErrors = {};

  if (creating && !values.resource) errors.resource = "Elige el espacio.";
  if (!values.name.trim()) errors.name = "Escribe el nombre del servicio.";

  const duration = values.duration.trim();
  if (!/^\d+$/.test(duration)) {
    errors.duration = "Escribe los minutos, con un número entero.";
  } else if (Number(duration) < MIN_DURATION || Number(duration) > MAX_DURATION) {
    errors.duration = `Debe durar entre ${MIN_DURATION} y ${MAX_DURATION} minutos.`;
  }

  const price = values.price.trim();
  if (price !== "" && !PRICE.test(price)) errors.price = "Escribe el precio en soles, por ejemplo 60 o 45.50.";

  return errors;
}

/** What the API receives. Call it only with values that passed `validateService`. */
export function serviceInput(values: ServiceValues, { creating }: { creating: boolean }) {
  const price = values.price.trim();
  return {
    ...(creating ? { resource_id: Number(values.resource) } : {}),
    name: values.name.trim(),
    duration_minutes: Number(values.duration.trim()),
    reference_price: price === "" ? null : Number(price.replace(",", ".")).toFixed(2),
  };
}

/** "60.00" -> "60", "45.50" -> "45.50": how a price is shown in the form. */
export function priceText(price: string | null): string {
  if (price === null || price === "") return "";
  const amount = Number(price);
  if (Number.isNaN(amount)) return "";
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}
