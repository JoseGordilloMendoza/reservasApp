import { describe, expect, it } from "vitest";

import { METHODS, emptyPayment, toNewPayment, validatePayment } from "./paymentForm";
import type { PaymentValues } from "./paymentForm";

const valid = (overrides: Partial<PaymentValues> = {}): PaymentValues => ({ ...emptyPayment("80.00"), ...overrides });

describe("the blank payment", () => {
  it("proposes the agreed price, one month paid with Yape", () => {
    expect(emptyPayment("80.00")).toEqual({ amount: "80", method: "yape", months: "1", paidOn: "", reference: "", note: "" });
  });

  it("keeps the cents of a price that has them", () => {
    expect(emptyPayment("79.90").amount).toBe("79.90");
  });

  it("starts with no amount when there is no price", () => {
    expect(emptyPayment().amount).toBe("");
  });

  it("offers every method the API knows", () => {
    expect([...METHODS].sort()).toEqual(["cash", "other", "plin", "transfer", "yape"]);
  });
});

describe("checking a payment", () => {
  it("accepts the proposed one", () => {
    expect(validatePayment(valid())).toEqual({});
  });

  it("asks for the amount, in soles with at most two decimals", () => {
    expect(validatePayment(valid({ amount: "" })).amount).toBe("Escribe cuánto pagó.");
    for (const amount of ["S/ 80", "-1", "1.234", "ochenta"]) {
      expect(validatePayment(valid({ amount })).amount).toMatch(/monto en soles/);
    }
    for (const amount of ["0", "79,90", " 120 "]) expect(validatePayment(valid({ amount })).amount).toBeUndefined();
  });

  it("limits the months to 1 through 24", () => {
    expect(validatePayment(valid({ months: "24" })).months).toBeUndefined();
    for (const months of ["0", "25", "", "uno", "1.5"]) {
      expect(validatePayment(valid({ months })).months).toBe("Entre 1 y 24 meses.");
    }
  });

  it("takes an empty date as today, and refuses a broken one", () => {
    expect(validatePayment(valid({ paidOn: "" })).paidOn).toBeUndefined();
    expect(validatePayment(valid({ paidOn: "2030-03-31" })).paidOn).toBeUndefined();
    expect(validatePayment(valid({ paidOn: "31/03/2030" })).paidOn).toBe("Elige la fecha del pago.");
  });

  it("keeps the reference and note within what the server stores", () => {
    expect(validatePayment(valid({ reference: "x".repeat(81) })).reference).toBe("Máximo 80 caracteres.");
    expect(validatePayment(valid({ note: "x".repeat(201) })).note).toBe("Máximo 200 caracteres.");
  });
});

describe("what the API receives", () => {
  it("sends only what matters when the rest is blank", () => {
    expect(toNewPayment(valid())).toEqual({ amount: "80.00", method: "yape", months: 1 });
  });

  it("sends everything that was filled in, trimmed and with a dot for decimals", () => {
    expect(
      toNewPayment(valid({ amount: "79,9", method: "transfer", months: "3", paidOn: "2030-03-31", reference: " Op. 123 ", note: " Pagó su hermana " })),
    ).toEqual({
      amount: "79.90",
      method: "transfer",
      months: 3,
      paid_on: "2030-03-31",
      reference: "Op. 123",
      note: "Pagó su hermana",
    });
  });
});
