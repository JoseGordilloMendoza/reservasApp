import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DateStrip } from "./DateStrip";

const DAYS = ["2030-01-07", "2030-01-08", "2030-01-09"];

afterEach(() => {
  vi.restoreAllMocks();
  // jsdom has no Element.scrollTo; a test that defines one removes it again.
  delete (HTMLElement.prototype as { scrollTo?: unknown }).scrollTo;
});

describe("the day strip", () => {
  it("moves only itself to show the chosen day, never the whole page", () => {
    const scrollTo = vi.fn();
    HTMLElement.prototype.scrollTo = scrollTo as unknown as typeof HTMLElement.prototype.scrollTo;
    const intoView = vi.spyOn(HTMLElement.prototype, "scrollIntoView");

    render(<DateStrip days={DAYS} available={new Set(DAYS)} selected="2030-01-08" onSelect={() => {}} />);

    expect(screen.getByRole("radiogroup", { name: "Día" })).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: "smooth" }));
    // This is what made the page jump down on load when something tall sat above the strip.
    expect(intoView).not.toHaveBeenCalled();
  });

  it("works where the browser cannot scroll an element", () => {
    expect(() =>
      render(<DateStrip days={DAYS} available={new Set(DAYS)} selected="2030-01-08" onSelect={() => {}} />),
    ).not.toThrow();
  });
});
