import { describe, expect, it } from "vitest";

import { FEATURES, featuresOf } from "./features";

describe("featuresOf", () => {
  it("keeps the order the business picked and skips keys it does not know", () => {
    expect(featuresOf(["wifi", "helipad", "parking"]).map((feature) => feature.key)).toEqual(["wifi", "parking"]);
  });

  it("gives every feature a name and an icon, with no repeats", () => {
    expect(new Set(FEATURES.map((feature) => feature.key)).size).toBe(FEATURES.length);
    for (const feature of FEATURES) {
      expect(feature.label.length).toBeGreaterThan(2);
      expect(feature.Icon).toBeTruthy();
    }
  });
});
