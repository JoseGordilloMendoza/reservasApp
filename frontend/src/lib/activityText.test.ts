import { describe, expect, it } from "vitest";

import { describeActivity } from "./activityText";

const entry = (action: string, detail: Record<string, unknown> = {}) => ({
  id: 1,
  actor_email: "equipo@example.com",
  business_slug: "canchas-los-andes",
  action,
  detail,
  created_at: "2030-03-20T15:00:00Z",
});

describe("telling what the team did", () => {
  it("says a business was opened or reactivated", () => {
    expect(describeActivity(entry("business.created"))).toBe("Abrió el negocio");
    expect(describeActivity(entry("business.reactivated"))).toBe("Reactivó el negocio");
  });

  it("says what was changed in a business", () => {
    expect(describeActivity(entry("business.updated", { changes: { name: ["A", "B"] } }))).toBe("Cambió el nombre del negocio");
    expect(describeActivity(entry("business.updated", { changes: { name: [], business_type: [] } }))).toBe(
      "Cambió el nombre y el tipo del negocio",
    );
    expect(describeActivity(entry("business.updated"))).toBe("Cambió datos del negocio");
  });

  it("keeps the reason of a suspension", () => {
    expect(describeActivity(entry("business.suspended", { reason: "No pagó" }))).toBe("Suspendió el negocio. Motivo: No pagó");
  });

  it("describes a new subscription with its price and end", () => {
    expect(describeActivity(entry("subscription.set", { price: "80.00", valid_until: "2030-05-01" }))).toBe(
      "Creó la suscripción de S/ 80 al mes, hasta el 1 may 2030",
    );
  });

  it("describes moving the end date with before, after and why", () => {
    expect(
      describeActivity(entry("subscription.adjusted", { valid_until: ["2030-03-31", "2030-04-15"], reason: "Cortesía" })),
    ).toBe("Movió la vigencia del 31 mar 2030 al 15 abr 2030. Motivo: Cortesía");
  });

  it("describes a payment with how it was paid and for how many months", () => {
    expect(describeActivity(entry("payment.recorded", { amount: "80.00", method: "yape", months: 1 }))).toBe(
      "Registró un pago de S/ 80 (Yape, 1 mes)",
    );
    expect(describeActivity(entry("payment.recorded", { amount: "240.00", method: "transfer", months: 3 }))).toBe(
      "Registró un pago de S/ 240 (Transferencia, 3 meses)",
    );
  });

  it("names the person and the role when someone is added, changed or removed", () => {
    expect(describeActivity(entry("user.added", { email: "luis@example.com", role: "staff" }))).toBe("Agregó a luis@example.com como personal");
    expect(describeActivity(entry("user.role_changed", { email: "luis@example.com", role: ["staff", "owner"] }))).toBe(
      "Cambió el rol de luis@example.com de personal a dueño",
    );
    expect(describeActivity(entry("user.removed", { email: "luis@example.com" }))).toBe("Quitó a luis@example.com del negocio");
    expect(describeActivity(entry("user.link_sent", { email: "luis@example.com" }))).toBe("Reenvió el acceso a luis@example.com");
  });

  it("describes support: the reason to go in, the end, and each change", () => {
    expect(describeActivity(entry("support.started", { reason: "Ayuda con los horarios" }))).toBe(
      "Abrió una sesión de soporte. Motivo: Ayuda con los horarios",
    );
    expect(describeActivity(entry("support.ended"))).toBe("Cerró la sesión de soporte");
    expect(describeActivity(entry("support.action", { method: "PATCH", path: "/api/v1/panel/business/" }))).toBe(
      "Hizo un cambio desde soporte: PATCH /panel/business/",
    );
  });

  it("falls back to the raw action for one it does not know, rather than failing", () => {
    expect(describeActivity(entry("algo.nuevo"))).toBe("algo.nuevo");
  });

  it("never writes null or a made up date when the detail is incomplete", () => {
    for (const incomplete of ["payment.recorded", "subscription.set", "subscription.adjusted", "user.added", "user.role_changed"]) {
      const sentence = describeActivity(entry(incomplete));
      expect(sentence).not.toMatch(/null|undefined|NaN|\b0\b/);
    }
    expect(describeActivity(entry("payment.recorded"))).toBe("Registró un pago (1 mes)");
    expect(describeActivity(entry("subscription.set"))).toBe("Creó la suscripción");
    expect(describeActivity(entry("subscription.adjusted"))).toBe("Movió la vigencia de una fecha a otra. Motivo: ");
  });

  it("does not break on an entry with missing detail", () => {
    expect(() => describeActivity(entry("payment.recorded"))).not.toThrow();
    expect(() => describeActivity(entry("subscription.adjusted"))).not.toThrow();
    expect(() => describeActivity(entry("user.role_changed"))).not.toThrow();
  });
});
