import { describe, expect, it } from "vitest";

import { formatDuration, formatPrice } from "./format";

describe("formatPrice", () => {
  it("drops the cents of a round amount", () => {
    expect(formatPrice("60.00")).toBe("S/ 60");
  });

  it("keeps the cents otherwise", () => {
    expect(formatPrice("75.5")).toBe("S/ 75.50");
  });

  it("shows nothing without a price", () => {
    expect(formatPrice(null)).toBeNull();
    expect(formatPrice(undefined)).toBeNull();
    expect(formatPrice("")).toBeNull();
    expect(formatPrice("gratis")).toBeNull();
  });
});

describe("formatDuration", () => {
  it.each([
    [30, "30 min"],
    [50, "50 min"],
    [60, "60 min"],
    [90, "1 h 30 min"],
    [120, "2 h"],
  ])("%i minutes", (minutes, text) => {
    expect(formatDuration(minutes)).toBe(text);
  });
});
