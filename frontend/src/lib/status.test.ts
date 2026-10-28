import { describe, expect, it } from "vitest";

import { LIVE_STATUSES, STATUS_HEADLINE, STATUS_LABEL, shortCode } from "./status";

describe("shortCode", () => {
  it("is stable for the same token", () => {
    expect(shortCode("abc-123")).toBe(shortCode("abc-123"));
  });

  it("differs between tokens", () => {
    expect(shortCode("abc-123")).not.toBe(shortCode("abc-124"));
  });

  it("has a fixed length", () => {
    expect(shortCode("x")).toHaveLength(7);
    expect(shortCode("a very long token ".repeat(20))).toHaveLength(7);
  });

  it("does not expose the token", () => {
    const token = "SECRETtokenVALUE";
    const code = shortCode(token);

    expect(token.toUpperCase()).not.toContain(code);
    expect(code).toMatch(/^[0-9A-Z]{7}$/);
  });
});

describe("status texts", () => {
  it("covers every status in Spanish", () => {
    const statuses = ["pending", "confirmed", "completed", "cancelled", "expired", "no_show"] as const;

    for (const status of statuses) {
      expect(STATUS_LABEL[status]).toBeTruthy();
      expect(STATUS_HEADLINE[status]).toBeTruthy();
    }
  });

  it("treats only pending and confirmed bookings as live", () => {
    expect(LIVE_STATUSES).toEqual(["pending", "confirmed"]);
  });
});
