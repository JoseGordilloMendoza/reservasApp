import { describe, expect, it } from "vitest";

import { MIN_LETTERS, isSearchable } from "./search";

describe("deciding whether to look for something", () => {
  it("needs two letters", () => {
    expect(MIN_LETTERS).toBe(2);
    expect(isSearchable("")).toBe(false);
    expect(isSearchable("c")).toBe(false);
    expect(isSearchable("ca")).toBe(true);
  });

  it("does not count the spaces around", () => {
    expect(isSearchable("   c   ")).toBe(false);
    expect(isSearchable("  ca  ")).toBe(true);
  });
});
