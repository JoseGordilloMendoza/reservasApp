import type { BusinessKind, Delivery, NewPlatformBusiness } from "./platformTypes";

// The form for opening a business: what is typed, what is wrong with it, and what the API gets.

export interface NewBusinessValues {
  name: string;
  slug: string;
  kind: BusinessKind;
  ownerEmail: string;
  ownerFirstName: string;
  ownerLastName: string;
  /** An email to choose a password, or a temporary password to hand over. */
  delivery: Delivery;
  plan: string;
  /** In soles per month. */
  price: string;
  /** A trial counted in days from today, or an end date picked by hand. */
  term: "trial" | "date";
  trialDays: string;
  validUntil: string;
}

export type NewBusinessErrors = Partial<Record<keyof NewBusinessValues, string>>;

export const DEFAULT_TRIAL_DAYS = "30";

export const emptyBusiness = (): NewBusinessValues => ({
  name: "",
  slug: "",
  kind: "court",
  ownerEmail: "",
  ownerFirstName: "",
  ownerLastName: "",
  delivery: "email",
  plan: "",
  price: "",
  term: "trial",
  trialDays: DEFAULT_TRIAL_DAYS,
  validUntil: "",
});

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PRICE = /^\d{1,6}([.,]\d{1,2})?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateNewBusiness(values: NewBusinessValues): NewBusinessErrors {
  const errors: NewBusinessErrors = {};

  if (!values.name.trim()) errors.name = "Escribe el nombre del negocio.";

  const slug = values.slug.trim();
  if (slug && !SLUG.test(slug)) errors.slug = "Solo minúsculas, números y guiones, por ejemplo canchas-el-sol.";

  if (!values.ownerEmail.trim()) errors.ownerEmail = "Escribe el correo del dueño.";
  else if (!EMAIL.test(values.ownerEmail.trim())) errors.ownerEmail = "Revisa el correo: parece incompleto.";

  const price = values.price.trim();
  if (!price) errors.price = "Escribe el precio mensual acordado.";
  else if (!PRICE.test(price)) errors.price = "Escribe el precio en soles, por ejemplo 80 o 79.90.";

  if (values.term === "trial") {
    const days = values.trialDays.trim();
    if (!/^\d+$/.test(days) || Number(days) < 1 || Number(days) > 365) errors.trialDays = "Entre 1 y 365 días.";
  } else if (!DATE.test(values.validUntil)) {
    errors.validUntil = "Elige hasta qué día vale.";
  }

  return errors;
}

/** What the API receives. Call it only with values that passed `validateNewBusiness`. */
export function toNewBusiness(values: NewBusinessValues): NewPlatformBusiness {
  const slug = values.slug.trim();
  const firstName = values.ownerFirstName.trim();
  const lastName = values.ownerLastName.trim();
  const plan = values.plan.trim();

  return {
    name: values.name.trim(),
    ...(slug ? { slug } : {}),
    business_type: values.kind,
    delivery: values.delivery,
    owner: {
      email: values.ownerEmail.trim(),
      ...(firstName ? { first_name: firstName } : {}),
      ...(lastName ? { last_name: lastName } : {}),
    },
    subscription: {
      ...(plan ? { plan_name: plan } : {}),
      price: Number(values.price.trim().replace(",", ".")).toFixed(2),
      ...(values.term === "trial" ? { trial_days: Number(values.trialDays.trim()) } : { valid_until: values.validUntil }),
    },
  };
}

/** Where the API's field names land in the form. */
export const SERVER_FIELD: Record<string, keyof NewBusinessValues> = {
  name: "name",
  slug: "slug",
  business_type: "kind",
  "owner.email": "ownerEmail",
  "owner.first_name": "ownerFirstName",
  "owner.last_name": "ownerLastName",
  "subscription.plan_name": "plan",
  "subscription.price": "price",
  "subscription.trial_days": "trialDays",
  "subscription.valid_until": "validUntil",
};
