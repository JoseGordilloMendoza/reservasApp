import { describe, expect, it } from "vitest";

import { LIVE_STATUSES, STATUS_HEADLINE, STATUS_LABEL } from "./status";

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
