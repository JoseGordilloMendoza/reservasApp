import { Clock, WarningCircle } from "@phosphor-icons/react";

import { formatDayKey } from "../../lib/dates";
import type { PanelBusiness } from "../../lib/panelTypes";

/** Days before the end at which the owner starts hearing about it. */
const WARN_FROM_DAYS = 7;

function plural(days: number) {
  return days === 1 ? "1 día" : `${days} días`;
}

/**
 * What the owner should know about the business's standing: suspended, past its subscription,
 * or close to it. Nothing at all when everything is fine or there is no subscription.
 */
export function SubscriptionBanner({ business }: { business: PanelBusiness }) {
  const { status, subscription } = business;

  if (status === "suspended") {
    return (
      <p role="status" className="mb-6 flex items-start gap-3 rounded-box border-[3px] border-danger p-4 font-semibold text-danger">
        <WarningCircle aria-hidden="true" className="mt-0.5 shrink-0" />
        Tu negocio está suspendido: no recibe reservas nuevas. Puedes seguir viendo tus datos.
      </p>
    );
  }

  if (!subscription) return null;

  if (subscription.state === "expired") {
    return (
      <p role="status" className="mb-6 flex items-start gap-3 rounded-box border-[3px] border-danger p-4 font-semibold text-danger">
        <WarningCircle aria-hidden="true" className="mt-0.5 shrink-0" />
        Tu suscripción venció el {formatDayKey(subscription.valid_until)}: tu página ya no recibe reservas nuevas. Tus datos y las
        reservas que ya tienes están a salvo. Renueva para volver a recibirlas.
      </p>
    );
  }

  if (subscription.state === "grace") {
    return (
      <p role="status" className="mb-6 flex items-start gap-3 rounded-box border-[3px] border-danger p-4 font-semibold text-danger">
        <WarningCircle aria-hidden="true" className="mt-0.5 shrink-0" />
        Tu suscripción venció el {formatDayKey(subscription.valid_until)}. Tus clientes pueden seguir reservando hasta el{" "}
        {formatDayKey(subscription.grace_ends_on)}; después tu página dejará de recibir reservas. Renueva a tiempo.
      </p>
    );
  }

  if (subscription.days_left <= WARN_FROM_DAYS) {
    return (
      <p role="status" className="mb-6 flex items-start gap-3 rounded-box border-[3px] border-line bg-surface p-4 font-semibold">
        <Clock aria-hidden="true" className="mt-0.5 shrink-0" />
        {subscription.days_left === 0
          ? "Tu suscripción vence hoy."
          : `Tu suscripción vence en ${plural(subscription.days_left)}, el ${formatDayKey(subscription.valid_until)}.`}
      </p>
    );
  }

  return null;
}
