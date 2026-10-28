export interface CustomerValues {
  name: string;
  phone: string;
  email: string;
  accepted: boolean;
}

export type CustomerErrors = Partial<Record<keyof CustomerValues, string>>;

const PERU_MOBILE = /^(\+?51)?9\d{8}$/;
const INTERNATIONAL = /^\+\d{8,15}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Cheap checks so obvious mistakes are caught before a round trip. The server decides in the end. */
export function validateCustomer(values: CustomerValues): CustomerErrors {
  const errors: CustomerErrors = {};

  if (values.name.trim().length < 2) errors.name = "Escribe tu nombre.";

  const phone = values.phone.replace(/[\s\-().]/g, "");
  if (!phone) {
    errors.phone = "Escribe tu celular para avisarte.";
  } else if (!PERU_MOBILE.test(phone) && !INTERNATIONAL.test(phone)) {
    errors.phone = "Ese celular no parece válido. Ejemplo: 987 654 321.";
  }

  if (values.email.trim() && !EMAIL.test(values.email.trim())) {
    errors.email = "Ese correo no parece válido.";
  }

  if (!values.accepted) errors.accepted = "Marca la casilla para poder reservar.";

  return errors;
}
