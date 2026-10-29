import type { Standing } from "./platformTypes";

/** How soon before the end a subscription starts being called "about to expire". */
export const EXPIRING_DAYS = 7;

export type Tone = "ok" | "soon" | "bad" | "none";

export interface StandingLabel {
  text: string;
  tone: Tone;
}

/**
 * What to call where a business stands. A suspended business is suspended first, whatever its
 * subscription says: that is the fact the team most needs to see.
 */
export function standingLabel(standing: Standing, suspended = false): StandingLabel {
  if (suspended) return { text: "Suspendido", tone: "bad" };

  switch (standing.state) {
    case "none":
      return { text: "Sin suscripción", tone: "none" };
    case "expired":
      return { text: "Vencida", tone: "bad" };
    case "grace":
      return { text: "En gracia", tone: "bad" };
    case "active": {
      const days = standing.days_left ?? Infinity;
      if (days === 0) return { text: "Vence hoy", tone: "soon" };
      if (days <= EXPIRING_DAYS) return { text: days === 1 ? "Vence en 1 día" : `Vence en ${days} días`, tone: "soon" };
      return { text: "Vigente", tone: "ok" };
    }
  }
}
