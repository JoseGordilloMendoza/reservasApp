import { describe, expect, it } from "vitest";

import { KINDS, KIND_LABEL } from "./kinds";

describe("business types", () => {
  it("has a name for every type the API knows", () => {
    expect([...KINDS].sort()).toEqual(["court", "generic", "psychologist"]);
    for (const kind of KINDS) expect(KIND_LABEL[kind].length).toBeGreaterThan(2);
  });
});
