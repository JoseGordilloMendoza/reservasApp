import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi, renderApp } from "../test/helpers";
import type { DirectoryEntry } from "../lib/types";

afterEach(() => {
  vi.unstubAllGlobals();
});

const entry = (overrides: Partial<DirectoryEntry>): DirectoryEntry => ({
  name: "Canchas Los Andes",
  slug: "canchas-los-andes",
  business_type: "court",
  accent: "mint",
  address: "Av. Ejército 123",
  description: "",
  logo_url: null,
  cover_url: null,
  ...overrides,
});

const ANDES = entry({});
const NORTE = entry({ name: "Cancha El Norte", slug: "cancha-norte", accent: "tangerine" });
const LUCIA = entry({ name: "Consultorio Lucía", slug: "consultorio-lucia", business_type: "psychologist", accent: "sky" });

function home(results: DirectoryEntry[]) {
  mockApi({ "GET /public/directory/": { status: 200, body: { results } } });
  renderApp("/");
}

describe("the promises", () => {
  it("says only what is true today: no account, no calls, a ticket at once, nothing charged", async () => {
    home([]);

    const promises = within(await screen.findByRole("region", { name: "Lo que te prometemos" }));
    expect(promises.getAllByRole("listitem").map((item) => item.querySelector(".font-display")?.textContent)).toEqual([
      "Sin cuenta",
      "Sin llamadas",
      "Boleto al instante",
      "Sin cobros extra",
    ]);
  });

  it("shows no made-up numbers, ratings or distances", async () => {
    home([ANDES]);
    await screen.findByRole("link", { name: /Canchas Los Andes/ });

    expect(document.body.textContent).not.toMatch(/\+\s?\d|★|\bkm\b|reseñas/);
  });
});

describe("the picture at the top", () => {
  it("is decoration a screen reader skips, and the search stays inside the first block", async () => {
    home([]);

    const hero = await screen.findByRole("region", { name: /Reserva tu hora/ });
    expect(within(hero).getByRole("searchbox")).toBeInTheDocument();
    expect(within(hero).getByRole("heading", { name: "Encuentra tu negocio" })).toBeInTheDocument();
    // The example cards are part of the picture: present on screen, hidden from assistive technology.
    expect(within(hero).queryByText("Reserva confirmada")).not.toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
    expect(hero.querySelector('[aria-hidden="true"] svg')).not.toBeNull();
  });
});

describe("the business cards", () => {
  it("wear the color of each business and invite to book", async () => {
    home([ANDES, LUCIA]);

    const card = await screen.findByRole("link", { name: /Canchas Los Andes/ });
    expect(card).toHaveAttribute("data-accent", "mint");
    expect(card).toHaveTextContent("Reservar aquí");
    expect(screen.getByRole("link", { name: /Consultorio Lucía/ })).toHaveAttribute("data-accent", "sky");
  });

  it("can be narrowed to one kind, and back to all", async () => {
    home([ANDES, LUCIA, NORTE]);
    const user = userEvent.setup();

    const filter = within(await screen.findByRole("group", { name: "Ver por tipo de negocio" }));
    expect(filter.getAllByRole("button").map((button) => button.textContent)).toEqual(["Todos", "Canchas", "Psicólogos"]);
    expect(filter.getByRole("button", { name: "Todos" })).toHaveAttribute("aria-pressed", "true");

    await user.click(filter.getByRole("button", { name: "Psicólogos" }));

    expect(filter.getByRole("button", { name: "Psicólogos" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("link", { name: /Consultorio Lucía/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Canchas Los Andes/ })).not.toBeInTheDocument();

    await user.click(filter.getByRole("button", { name: "Todos" }));
    expect(screen.getAllByRole("link", { name: /Reservar aquí/ })).toHaveLength(3);
  });

  it("offers no filter when every business is of the same kind, so no button leads to an empty list", async () => {
    home([ANDES, NORTE]);
    await screen.findByRole("link", { name: /Canchas Los Andes/ });

    expect(screen.queryByRole("group", { name: "Ver por tipo de negocio" })).not.toBeInTheDocument();
  });
});
