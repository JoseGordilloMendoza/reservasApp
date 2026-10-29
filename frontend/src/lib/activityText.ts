import { formatDayKeyWithYear } from "./dates";
import { formatPrice } from "./format";
import { METHOD_LABEL } from "./paymentForm";
import type { ActivityEntry } from "./platformTypes";

const ROLE: Record<string, string> = { owner: "dueño", staff: "personal" };

const FIELD: Record<string, string> = { name: "el nombre", business_type: "el tipo", timezone: "la zona horaria" };

const text = (value: unknown) => (typeof value === "string" ? value : "");

const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const pair = (value: unknown): [string, string] =>
  Array.isArray(value) ? [text(value[0]), text(value[1])] : ["", ""];

function plural(count: number, one: string, many: string) {
  return count === 1 ? one : many;
}

/** A sentence saying what the team did, from the entry's action and detail. */
export function describeActivity(entry: ActivityEntry): string {
  const d = entry.detail;

  switch (entry.action) {
    case "business.created":
      return "Abrió el negocio";
    case "business.updated": {
      const changed = Object.keys((d.changes as Record<string, unknown>) ?? {}).map((field) => FIELD[field] ?? field);
      return changed.length ? `Cambió ${changed.join(" y ")} del negocio` : "Cambió datos del negocio";
    }
    case "business.suspended":
      return `Suspendió el negocio. Motivo: ${text(d.reason)}`;
    case "business.reactivated":
      return "Reactivó el negocio";
    case "subscription.set": {
      const price = formatPrice(text(d.price));
      const until = text(d.valid_until);
      return `Creó la suscripción${price ? ` de ${price} al mes` : ""}${isDay(until) ? `, hasta el ${formatDayKeyWithYear(until)}` : ""}`;
    }
    case "subscription.adjusted": {
      const [from, to] = pair(d.valid_until);
      // Only with both dates is there a span to describe; a made up date would be worse than none.
      const span = isDay(from) && isDay(to) ? `del ${formatDayKeyWithYear(from)} al ${formatDayKeyWithYear(to)}` : "de una fecha a otra";
      return `Movió la vigencia ${span}. Motivo: ${text(d.reason)}`;
    }
    case "payment.recorded": {
      const months = Number(d.months) || 1;
      const method = METHOD_LABEL[text(d.method) as keyof typeof METHOD_LABEL] ?? text(d.method);
      const amount = formatPrice(text(d.amount));
      const how = [method, `${months} ${plural(months, "mes", "meses")}`].filter(Boolean).join(", ");
      return `Registró un pago${amount ? ` de ${amount}` : ""} (${how})`;
    }
    case "user.added":
      return `Agregó a ${text(d.email)} como ${ROLE[text(d.role)] ?? text(d.role)}`;
    case "user.role_changed": {
      const [from, to] = pair(d.role);
      return `Cambió el rol de ${text(d.email)} de ${ROLE[from] ?? from} a ${ROLE[to] ?? to}`;
    }
    case "user.removed":
      return `Quitó a ${text(d.email)} del negocio`;
    case "user.link_sent":
      return `Reenvió el acceso a ${text(d.email)}`;
    case "support.started":
      return `Abrió una sesión de soporte. Motivo: ${text(d.reason)}`;
    case "support.ended":
      return "Cerró la sesión de soporte";
    case "support.action":
      return `Hizo un cambio desde soporte: ${text(d.method)} ${text(d.path).replace("/api/v1", "")}`;
    default:
      return entry.action;
  }
}
