import { describe, expect, it } from "vitest";

import type { PlatformSubscription } from "./platformTypes";
import { fromSubscription, movesTheEnd, toChanges, validateSubscription } from "./subscriptionForm";

const CURRENT: PlatformSubscription = {
  plan_name: "Mensual",
  price: "80.00",
  started_on: "2030-01-01",
  valid_until: "2030-03-31",
  notes: "Descuento acordado",
  updated_at: "2030-01-01T00:00:00Z",
};

describe("the form for a subscription", () => {
  it("starts from what is saved, with no reason yet", () => {
    expect(fromSubscription(CURRENT)).toEqual({
      plan: "Mensual",
      price: "80",
      validUntil: "2030-03-31",
      notes: "Descuento acordado",
      reason: "",
    });
  });

  it("starts empty when there is no subscription", () => {
    expect(fromSubscription(null)).toEqual({ plan: "", price: "", validUntil: "", notes: "", reason: "" });
  });

  it("keeps the cents of a price that has them", () => {
    expect(fromSubscription({ ...CURRENT, price: "79.90" }).price).toBe("79.90");
  });
});

describe("when the end date moves", () => {
  it("only counts a different date, for a subscription that already exists", () => {
    const same = fromSubscription(CURRENT);

    expect(movesTheEnd(same, CURRENT)).toBe(false);
    expect(movesTheEnd({ ...same, validUntil: "2030-04-15" }, CURRENT)).toBe(true);
    expect(movesTheEnd({ ...same, validUntil: "" }, CURRENT)).toBe(false);
    expect(movesTheEnd({ ...same, validUntil: "2030-04-15" }, null)).toBe(false);
  });
});

describe("checking a subscription", () => {
  it("accepts the saved one as it is", () => {
    expect(validateSubscription(fromSubscription(CURRENT), CURRENT)).toEqual({});
  });

  it("needs a price and an end date", () => {
    expect(validateSubscription(fromSubscription(null), null)).toEqual({
      price: "Escribe el precio mensual acordado.",
      validUntil: "Elige hasta qué día vale.",
    });
  });

  it("refuses a price that is not an amount in soles", () => {
    for (const price of ["S/ 80", "-1", "1.234", "mucho"]) {
      expect(validateSubscription({ ...fromSubscription(CURRENT), price }, CURRENT).price).toMatch(/precio en soles/);
    }
  });

  it("asks why when the end date is moved by hand, but not when only the plan changes", () => {
    const moved = { ...fromSubscription(CURRENT), validUntil: "2030-04-15" };

    expect(validateSubscription(moved, CURRENT).reason).toBe("Explica por qué cambias la vigencia a mano.");
    expect(validateSubscription({ ...moved, reason: "   " }, CURRENT).reason).toBeDefined();
    expect(validateSubscription({ ...moved, reason: "Cortesía" }, CURRENT)).toEqual({});
    expect(validateSubscription({ ...fromSubscription(CURRENT), plan: "Anual" }, CURRENT)).toEqual({});
  });

  it("does not ask why when creating: there is nothing to correct", () => {
    expect(validateSubscription({ ...fromSubscription(null), price: "80", validUntil: "2030-05-01" }, null)).toEqual({});
  });
});

describe("what the API receives", () => {
  it("creates with everything that was filled in", () => {
    expect(toChanges({ ...fromSubscription(null), plan: " Mensual ", price: "79,9", validUntil: "2030-05-01" }, null)).toEqual({
      plan_name: "Mensual",
      price: "79.90",
      valid_until: "2030-05-01",
    });
  });

  it("creates without the plan and notes when they are blank", () => {
    expect(toChanges({ ...fromSubscription(null), price: "80", validUntil: "2030-05-01" }, null)).toEqual({
      price: "80.00",
      valid_until: "2030-05-01",
    });
  });

  it("sends nothing when nothing changed", () => {
    expect(toChanges(fromSubscription(CURRENT), CURRENT)).toEqual({});
  });

  it("sends only what changed", () => {
    expect(toChanges({ ...fromSubscription(CURRENT), plan: "Anual", price: "70" }, CURRENT)).toEqual({ plan_name: "Anual", price: "70.00" });
  });

  it("sends the new end with its reason", () => {
    expect(toChanges({ ...fromSubscription(CURRENT), validUntil: "2030-04-15", reason: " Cortesía por la falla " }, CURRENT)).toEqual({
      valid_until: "2030-04-15",
      reason: "Cortesía por la falla",
    });
  });

  it("can clear the notes or the plan", () => {
    expect(toChanges({ ...fromSubscription(CURRENT), notes: "", plan: "" }, CURRENT)).toEqual({ plan_name: "", notes: "" });
  });

  it("does not mistake 80 for a change of 80.00", () => {
    expect(toChanges({ ...fromSubscription(CURRENT), price: "80,00" }, CURRENT)).toEqual({});
  });
});
