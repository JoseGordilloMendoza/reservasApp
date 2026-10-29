import type { PlatformSubscription, SubscriptionChanges } from "./platformTypes";

// Creating a subscription, or correcting one by hand. Normally a payment moves the end date;
// moving it directly is a correction, and corrections have to say why.

export interface SubscriptionValues {
  plan: string;
  price: string;
  validUntil: string;
  notes: string;
  reason: string;
}

export type SubscriptionErrors = Partial<Record<keyof SubscriptionValues, string>>;

export const fromSubscription = (subscription: PlatformSubscription | null): SubscriptionValues => ({
  plan: subscription?.plan_name ?? "",
  price: (subscription?.price ?? "").replace(/\.00$/, ""),
  validUntil: subscription?.valid_until ?? "",
  notes: subscription?.notes ?? "",
  reason: "",
});

const PRICE = /^\d{1,6}([.,]\d{1,2})?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True when the end date differs from the one saved: that is what needs a reason. */
export const movesTheEnd = (values: SubscriptionValues, current: PlatformSubscription | null) =>
  current !== null && values.validUntil !== "" && values.validUntil !== current.valid_until;

export function validateSubscription(values: SubscriptionValues, current: PlatformSubscription | null): SubscriptionErrors {
  const errors: SubscriptionErrors = {};

  const price = values.price.trim();
  if (!price) errors.price = "Escribe el precio mensual acordado.";
  else if (!PRICE.test(price)) errors.price = "Escribe el precio en soles, por ejemplo 80 o 79.90.";

  if (!DATE.test(values.validUntil)) errors.validUntil = "Elige hasta qué día vale.";
  if (values.notes.length > 1000) errors.notes = "Máximo 1000 caracteres.";
  if (movesTheEnd(values, current) && !values.reason.trim()) errors.reason = "Explica por qué cambias la vigencia a mano.";
  return errors;
}

const cents = (text: string) => Number(text.trim().replace(",", ".")).toFixed(2);

/** Only what changed, so the log of an adjustment says exactly that. Creating sends everything. */
export function toChanges(values: SubscriptionValues, current: PlatformSubscription | null): SubscriptionChanges {
  const price = cents(values.price);
  const plan = values.plan.trim();
  const notes = values.notes.trim();

  if (current === null) {
    return { price, valid_until: values.validUntil, ...(plan ? { plan_name: plan } : {}), ...(notes ? { notes } : {}) };
  }

  const changes: SubscriptionChanges = {};
  if (plan !== current.plan_name) changes.plan_name = plan;
  if (price !== cents(current.price)) changes.price = price;
  if (notes !== current.notes) changes.notes = notes;
  if (values.validUntil !== current.valid_until) {
    changes.valid_until = values.validUntil;
    changes.reason = values.reason.trim();
  }
  return changes;
}
