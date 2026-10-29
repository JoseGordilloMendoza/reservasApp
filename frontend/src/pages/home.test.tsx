import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi, renderApp } from "../test/helpers";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the home page", () => {
  it("speaks to anyone who books, not to one kind of business", async () => {
    mockApi({});
    renderApp("/");

    const title = await screen.findByRole("heading", { level: 1 });
    expect(title).toHaveTextContent("Separa tu hora.");
    // The platform serves courts, therapists and more: the headline must not name just one.
    expect(title).not.toHaveTextContent(/cancha|consultorio|psic/i);
    expect(screen.getByText(/Canchas, consultorios y más/)).toBeInTheDocument();
  });

  it("explains that each business has its own link, and leads to the bookings already made", async () => {
    mockApi({});
    renderApp("/");

    expect(await screen.findByRole("heading", { name: "Pídele su link al negocio" })).toBeInTheDocument();
    // The header has its own link to the same place; this is the one in the page.
    expect(within(screen.getByRole("main")).getByRole("link", { name: /Mis reservas/ })).toHaveAttribute("href", "/mis-reservas");
  });
});
