// The booking options a business can change, with the same limits the server enforces.

export type RuleKey =
  | "pending_hold_minutes"
  | "cancellation_notice_minutes"
  | "min_booking_notice_minutes"
  | "booking_horizon_days"
  | "slot_interval_minutes"
  | "buffer_minutes"
  | "max_active_bookings_per_customer";

export interface Rule {
  key: RuleKey;
  label: string;
  hint: string;
  min: number;
  max: number;
  unit: "minutes" | "days" | "count";
  /** Only meaningful when the owner confirms each booking by hand. */
  manualOnly?: boolean;
}

export const RULES: Rule[] = [
  {
    key: "pending_hold_minutes",
    label: "Tiempo para confirmar",
    hint: "Si no respondes en este tiempo, el horario se libera solo.",
    min: 5,
    max: 10080,
    unit: "minutes",
    manualOnly: true,
  },
  {
    key: "min_booking_notice_minutes",
    label: "Anticipación mínima para reservar",
    hint: "Con cuánto tiempo de aviso como mínimo se puede reservar. 0 permite reservar para ahora mismo.",
    min: 0,
    max: 43200,
    unit: "minutes",
  },
  {
    key: "cancellation_notice_minutes",
    label: "Anticipación para cancelar",
    hint: "Hasta cuánto antes puede cancelar el cliente una reserva confirmada.",
    min: 0,
    max: 43200,
    unit: "minutes",
  },
  {
    key: "booking_horizon_days",
    label: "Días hacia adelante",
    hint: "Hasta cuántos días de anticipación se puede reservar.",
    min: 1,
    max: 365,
    unit: "days",
  },
  {
    key: "slot_interval_minutes",
    label: "Cada cuánto empieza un horario",
    hint: "Con 60 minutos los horarios salen a las 8:00, 9:00, 10:00. Con 30, también a las 8:30.",
    min: 5,
    max: 240,
    unit: "minutes",
  },
  {
    key: "buffer_minutes",
    label: "Descanso entre reservas",
    hint: "Tiempo libre después de cada reserva, por ejemplo para limpiar. 0 si no hace falta.",
    min: 0,
    max: 240,
    unit: "minutes",
  },
  {
    key: "max_active_bookings_per_customer",
    label: "Reservas activas por cliente",
    hint: "Cuántas reservas pendientes o confirmadas puede tener a la vez un mismo cliente.",
    min: 1,
    max: 50,
    unit: "count",
  },
];

/** 90 -> "1 h 30 min", 1440 -> "1 día", 4320 -> "3 días". */
export function describeMinutes(minutes: number): string {
  if (minutes >= 1440 && minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? "1 día" : `${days} días`;
  }
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** A readable echo of what was typed, shown under the field. Empty when it is not a number. */
export function describeValue(rule: Rule, text: string): string {
  if (text.trim() === "" || !/^\d+$/.test(text.trim())) return "";
  const value = Number(text);
  if (rule.unit === "minutes") return describeMinutes(value);
  if (rule.unit === "days") return value === 1 ? "1 día" : `${value} días`;
  return value === 1 ? "1 reserva" : `${value} reservas`;
}

/** The complaint about a typed value, or null when it is fine. */
export function ruleError(rule: Rule, text: string): string | null {
  const clean = text.trim();
  if (!/^\d+$/.test(clean)) return "Escribe un número entero.";
  const value = Number(clean);
  if (value < rule.min) return `Debe ser al menos ${rule.min}.`;
  if (value > rule.max) return `Debe ser como máximo ${rule.max}.`;
  return null;
}
