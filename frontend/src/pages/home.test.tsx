import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SearchResult } from "../lib/types";
import { mockApi, renderApp } from "../test/helpers";

afterEach(() => {
  vi.unstubAllGlobals();
});

const LUCIA: SearchResult = {
  name: "Consultorio Lucía Quispe",
  slug: "consultorio-lucia",
  business_type: "psychologist",
  accent: "sky",
  address: "Calle Mercaderes 100, Cercado",
};

const searched = (api: ReturnType<typeof mockApi>) =>
  api.calls.filter((call) => call.path === "/public/search/").length;

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

  it("offers to find a business, says what to do if it is not there, and leads to the bookings already made", async () => {
    mockApi({});
    renderApp("/");

    expect(await screen.findByRole("heading", { name: "Encuentra tu negocio" })).toBeInTheDocument();
    expect(screen.getByText(/pídele su link y reserva/)).toBeInTheDocument();
    // The header has its own link to the same place; this is the one in the page.
    expect(within(screen.getByRole("main")).getByRole("link", { name: /Mis reservas/ })).toHaveAttribute("href", "/mis-reservas");
  });
});

describe("finding a business by name", () => {
  it("asks for at least two letters, and asks the server nothing before that", async () => {
    const api = mockApi({});
    const user = userEvent.setup();
    renderApp("/");

    expect(await screen.findByText("Escribe al menos 2 letras.")).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox"), "l");
    await new Promise((resolve) => setTimeout(resolve, 450));

    expect(screen.getByText("Escribe al menos 2 letras.")).toBeInTheDocument();
    expect(searched(api)).toBe(0);
  });

  it("shows the businesses that match, with their type and address, each leading to its page", async () => {
    mockApi({ "GET /public/search/": { status: 200, body: { results: [LUCIA] } } });
    const user = userEvent.setup();
    renderApp("/");

    await user.type(await screen.findByRole("searchbox"), "lucia");

    const result = await screen.findByRole("link", { name: /Consultorio Lucía Quispe/ });
    expect(result).toHaveAttribute("href", "/consultorio-lucia");
    expect(result).toHaveTextContent("Psicólogo · Calle Mercaderes 100, Cercado");
    expect(screen.queryByText("Escribe al menos 2 letras.")).not.toBeInTheDocument();
  });

  it("waits for a pause in the typing: one request, with what was typed", async () => {
    const api = mockApi({ "GET /public/search/": { status: 200, body: { results: [LUCIA] } } });
    const user = userEvent.setup();
    renderApp("/");

    await user.type(await screen.findByRole("searchbox"), "lucia");
    await screen.findByRole("link", { name: /Consultorio Lucía Quispe/ });

    expect(searched(api)).toBe(1);
    expect(api.fetchMock.mock.calls.some(([url]) => String(url).includes("q=lucia"))).toBe(true);
  });

  it("sends accents and spaces safely", async () => {
    const api = mockApi({ "GET /public/search/": { status: 200, body: { results: [] } } });
    const user = userEvent.setup();
    renderApp("/");

    await user.type(await screen.findByRole("searchbox"), "lucía q&a");
    await waitFor(() => expect(searched(api)).toBe(1));

    expect(api.fetchMock.mock.calls.some(([url]) => String(url).includes("q=luc%C3%ADa%20q%26a"))).toBe(true);
  });

  it("says so when nothing matches, while the page keeps saying to ask for the link", async () => {
    mockApi({ "GET /public/search/": { status: 200, body: { results: [] } } });
    const user = userEvent.setup();
    renderApp("/");

    await user.type(await screen.findByRole("searchbox"), "inexistente");

    expect(await screen.findByText(/No encontramos ese negocio/)).toBeInTheDocument();
    expect(screen.getByText(/¿No aparece\? Cada negocio tiene su propia página/)).toBeInTheDocument();
  });

  it("says when the search could not be done", async () => {
    mockApi({ "GET /public/search/": { status: 500, body: { detail: "Falla del servidor" } } });
    const user = userEvent.setup();
    renderApp("/");

    await user.type(await screen.findByRole("searchbox"), "lucia");

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos buscar ahora");
  });

  it("goes back to the hint when the text is cleared", async () => {
    mockApi({ "GET /public/search/": { status: 200, body: { results: [LUCIA] } } });
    const user = userEvent.setup();
    renderApp("/");

    const box = await screen.findByRole("searchbox");
    await user.type(box, "lucia");
    await screen.findByRole("link", { name: /Consultorio Lucía Quispe/ });
    await user.clear(box);

    expect(await screen.findByText("Escribe al menos 2 letras.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Consultorio Lucía Quispe/ })).not.toBeInTheDocument();
  });
});

describe("the businesses shown on the home page", () => {
  const ANDES = {
    name: "Canchas Los Andes",
    slug: "canchas-los-andes",
    business_type: "court",
    accent: "poppy" as const,
    address: "Av. Ejército 123, Cayma",
    description: "Grass sintético y luces LED.",
  };

  it("shows each business as a card that leads to its page", async () => {
    mockApi({ "GET /public/directory/": { status: 200, body: { results: [ANDES, { ...LUCIA, description: "" }] } } });
    renderApp("/");

    const card = await screen.findByRole("link", { name: /Canchas Los Andes/ });
    expect(card).toHaveAttribute("href", "/canchas-los-andes");
    expect(card).toHaveTextContent("Cancha deportiva");
    expect(card).toHaveTextContent("Grass sintético y luces LED.");
    expect(screen.getByRole("link", { name: /Consultorio Lucía Quispe/ })).toHaveAttribute("href", "/consultorio-lucia");
  });

  it("leaves the section out when no business has chosen to appear", async () => {
    mockApi({ "GET /public/directory/": { status: 200, body: { results: [] } } });
    renderApp("/");

    await screen.findByRole("heading", { name: "Encuentra tu negocio" });
    await waitFor(() => expect(screen.queryByRole("heading", { name: /Reserva en/ })).not.toBeInTheDocument());
  });

  it("still shows the rest of the page when the list cannot be loaded", async () => {
    mockApi({ "GET /public/directory/": { status: 500, body: { detail: "Error" } } });
    renderApp("/");

    expect(await screen.findByRole("heading", { name: "Encuentra tu negocio" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Reserva en/ })).not.toBeInTheDocument();
  });
});
