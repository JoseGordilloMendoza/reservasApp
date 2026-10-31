import type { CustomerTrust, TrustLevel } from "./panelTypes";

export const TRUST_LABEL: Record<TrustLevel, string> = {
  verified: "Verificado con Google",
  known: "Cliente conocido",
  new: "Primera vez",
  flagged: "Con faltas",
};

const times = (count: number, one: string, many: string) => (count === 1 ? `1 ${one}` : `${count} ${many}`);

/** What the owner needs in one line to decide about a booking: who it is and what they did before. */
export function trustLine(trust: CustomerTrust): string {
  const attended = times(trust.completed, "reserva atendida", "reservas atendidas");
  switch (trust.level) {
    case "flagged":
      return trust.no_shows > 0
        ? `No se presentó ${times(trust.no_shows, "vez", "veces")}${trust.completed > 0 ? ` · ${attended}` : ""}`
        : "Está bloqueado en tu negocio";
    case "verified":
      return trust.completed > 0 ? `Entró con Google · ${attended}` : "Entró con Google";
    case "known":
      return attended;
    case "new":
      return "Todavía no tiene reservas atendidas contigo";
  }
}

/** Whether a booking from this customer deserves a second look before it is confirmed. */
export const needsCare = (trust: CustomerTrust) => trust.level === "new" || trust.level === "flagged";
