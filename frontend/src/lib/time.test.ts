import { describe, expect, it } from "vitest";

import { zonedToUtc } from "./time";

describe("zonedToUtc", () => {
  it("converts Lima time, which has no daylight saving", () => {
    expect(zonedToUtc("2030-01-07", "19:00", "America/Lima").toISOString()).toBe("2030-01-08T00:00:00.000Z");
    expect(zonedToUtc("2030-07-07", "19:00", "America/Lima").toISOString()).toBe("2030-07-08T00:00:00.000Z");
  });

  it("crosses midnight in UTC", () => {
    expect(zonedToUtc("2030-01-07", "23:30", "America/Lima").toISOString()).toBe("2030-01-08T04:30:00.000Z");
  });

  it("is the identity for UTC", () => {
    expect(zonedToUtc("2030-01-07", "09:15", "UTC").toISOString()).toBe("2030-01-07T09:15:00.000Z");
  });

  it("follows daylight saving where it exists", () => {
    // New York: UTC-5 in winter, UTC-4 in summer.
    expect(zonedToUtc("2030-01-07", "19:00", "America/New_York").toISOString()).toBe("2030-01-08T00:00:00.000Z");
    expect(zonedToUtc("2030-07-07", "19:00", "America/New_York").toISOString()).toBe("2030-07-07T23:00:00.000Z");
  });

  it("handles the day the clocks jump forward", () => {
    // 2030-03-10: at 02:00 New York moves to 03:00, so 03:30 is already summer time.
    expect(zonedToUtc("2030-03-10", "03:30", "America/New_York").toISOString()).toBe("2030-03-10T07:30:00.000Z");
    expect(zonedToUtc("2030-03-10", "01:30", "America/New_York").toISOString()).toBe("2030-03-10T06:30:00.000Z");
  });
});
