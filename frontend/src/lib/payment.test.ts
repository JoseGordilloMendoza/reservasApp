import { describe, expect, it } from "vitest";

import { formatCode, owesSomething, paymentLine } from "./payment";

const base = { payment_status: "unpaid", amount_paid: "0.00", balance: "60.00", payment_method: "" } as const;

describe("formatCode", () => {
  it("splits the six characters in two halves, as they are read aloud", () => {
    expect(formatCode("K7M42X")).toBe("K7M-42X");
  });

  it("leaves anything else as it came", () => {
    expect(formatCode("K7M")).toBe("K7M");
  });
});

describe("paymentLine", () => {
  it("says what is owed when nothing was paid", () => {
    expect(paymentLine(base)).toBe("Sin pagar · Falta S/ 60");
  });

  it("says how much was left as a deposit, how, and what is still missing", () => {
    expect(paymentLine({ ...base, payment_status: "deposit", amount_paid: "20.00", balance: "40.00", payment_method: "yape" })).toBe(
      "Adelanto S/ 20 por Yape · Falta S/ 40",
    );
  });

  it("says nothing is missing once it is paid", () => {
    expect(paymentLine({ ...base, payment_status: "paid", amount_paid: "60.00", balance: "0.00", payment_method: "cash" })).toBe(
      "Pagada S/ 60 por Efectivo",
    );
  });

  it("keeps cents when the amount has them", () => {
    expect(paymentLine({ ...base, payment_status: "deposit", amount_paid: "12.50", balance: "47.50" })).toBe("Adelanto S/ 12.50 · Falta S/ 47.50");
  });

  it("does not invent a balance when there is no price", () => {
    expect(paymentLine({ ...base, balance: null })).toBe("Sin pagar");
  });
});

describe("owesSomething", () => {
  it("is true while part of the price is missing", () => {
    expect(owesSomething(base)).toBe(true);
    expect(owesSomething({ ...base, payment_status: "deposit", balance: "40.00" })).toBe(true);
  });

  it("is false when paid or when there is no price", () => {
    expect(owesSomething({ ...base, payment_status: "paid", balance: "0.00" })).toBe(false);
    expect(owesSomething({ ...base, balance: null })).toBe(false);
  });
});
