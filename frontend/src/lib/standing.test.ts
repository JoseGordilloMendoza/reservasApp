import { describe, expect, it } from "vitest";

import type { Standing } from "./platformTypes";
import { standingLabel } from "./standing";

const standing = (overrides: Partial<Standing>): Standing => ({
  state: "active",
  valid_until: "2030-03-31",
  grace_ends_on: "2030-04-05",
  days_left: 30,
  ...overrides,
});

describe("calling where a business stands", () => {
  it("is current when there is plenty of time", () => {
    expect(standingLabel(standing({ days_left: 30 }))).toEqual({ text: "Vigente", tone: "ok" });
    expect(standingLabel(standing({ days_left: 8 }))).toEqual({ text: "Vigente", tone: "ok" });
  });

  it("starts counting a week before the end", () => {
    expect(standingLabel(standing({ days_left: 7 }))).toEqual({ text: "Vence en 7 días", tone: "soon" });
    expect(standingLabel(standing({ days_left: 1 }))).toEqual({ text: "Vence en 1 día", tone: "soon" });
  });

  it("says when it ends today", () => {
    expect(standingLabel(standing({ days_left: 0 }))).toEqual({ text: "Vence hoy", tone: "soon" });
  });

  it("calls the days after the end grace, and then expired", () => {
    expect(standingLabel(standing({ state: "grace", days_left: -2 }))).toEqual({ text: "En gracia", tone: "bad" });
    expect(standingLabel(standing({ state: "expired", days_left: -30 }))).toEqual({ text: "Vencida", tone: "bad" });
  });

  it("has nothing to say about a business without a subscription", () => {
    expect(standingLabel(standing({ state: "none", valid_until: null, days_left: null }))).toEqual({
      text: "Sin suscripción",
      tone: "none",
    });
  });

  it("puts suspension first, whatever the subscription says", () => {
    expect(standingLabel(standing({ days_left: 30 }), true)).toEqual({ text: "Suspendido", tone: "bad" });
    expect(standingLabel(standing({ state: "expired" }), true).text).toBe("Suspendido");
  });
});
