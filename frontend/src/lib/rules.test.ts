import { describe, expect, it } from "vitest";

import { RULES, describeMinutes, describeValue, ruleError } from "./rules";

const rule = (key: string) => RULES.find((item) => item.key === key)!;

describe("describing minutes", () => {
  it("uses the biggest natural unit", () => {
    expect(describeMinutes(0)).toBe("0 min");
    expect(describeMinutes(45)).toBe("45 min");
    expect(describeMinutes(90)).toBe("1 h 30 min");
    expect(describeMinutes(120)).toBe("2 h");
    expect(describeMinutes(1440)).toBe("1 día");
    expect(describeMinutes(4320)).toBe("3 días");
  });

  it("keeps hours when a day does not divide evenly", () => {
    expect(describeMinutes(1500)).toBe("25 h");
  });
});

describe("echoing a typed value", () => {
  it("says the unit of the rule", () => {
    expect(describeValue(rule("pending_hold_minutes"), "120")).toBe("2 h");
    expect(describeValue(rule("booking_horizon_days"), "1")).toBe("1 día");
    expect(describeValue(rule("booking_horizon_days"), "30")).toBe("30 días");
    expect(describeValue(rule("max_active_bookings_per_customer"), "3")).toBe("3 reservas");
  });

  it("says nothing for something that is not a number", () => {
    expect(describeValue(rule("buffer_minutes"), "")).toBe("");
    expect(describeValue(rule("buffer_minutes"), "abc")).toBe("");
    expect(describeValue(rule("buffer_minutes"), "1.5")).toBe("");
  });
});

describe("checking a typed value", () => {
  it("accepts values within the limits, including both ends", () => {
    expect(ruleError(rule("pending_hold_minutes"), "5")).toBeNull();
    expect(ruleError(rule("pending_hold_minutes"), "10080")).toBeNull();
    expect(ruleError(rule("buffer_minutes"), "0")).toBeNull();
  });

  it("refuses what is out of range", () => {
    expect(ruleError(rule("pending_hold_minutes"), "4")).toBe("Debe ser al menos 5.");
    expect(ruleError(rule("booking_horizon_days"), "366")).toBe("Debe ser como máximo 365.");
  });

  it("refuses what is not a whole number", () => {
    for (const text of ["", "  ", "-1", "2.5", "dos"]) {
      expect(ruleError(rule("buffer_minutes"), text)).toBe("Escribe un número entero.");
    }
  });
});
