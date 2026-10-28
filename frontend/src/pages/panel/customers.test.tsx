import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CustomerDetail, CustomerSummary } from "../../lib/panelTypes";
import { page, renderApp, signedInRoutes, slotAt } from "../../test/helpers";

afterEach(() => {
  vi.unstubAllGlobals();
});

const summary = (overrides: Partial<CustomerSummary> = {}): CustomerSummary => ({
  id: 5,
  name: "Ana Pérez",
  phone: "+51987654321",
  email: "",
  is_blocked: false,
  created_at: slotAt(0, 9).starts_at,
  bookings_count: 3,
  last_booking_at: slotAt(1, 17).starts_at,
  ...overrides,
});

const detail = (overrides: Partial<CustomerDetail> = {}): CustomerDetail => ({
  ...summary(overrides),
  bookings: [
    {
      id: 40,
      status: "confirmed",
      starts_at: slotAt(1, 17).starts_at,
      ends_at: slotAt(1, 18).starts_at,
      resource: { id: 1, name: "Cancha 1" },
      service: { id: 11, name: "Alquiler 1 hora" },
    },
  ],
  ...overrides,
});

describe("the customer list", () => {
  it("shows each customer with how often they booked", async () => {
    signedInRoutes({
      "GET /panel/customers/": {
        status: 200,
        body: page([summary(), summary({ id: 6, name: "Luis Ramos", bookings_count: 1, last_booking_at: null })]),
      },
    });
    renderApp("/panel/clientes");

    expect(await screen.findByRole("link", { name: /Ana Pérez/ })).toHaveAttribute("href", "/panel/clientes/5");
    expect(screen.getByText(/3 reservas/)).toBeInTheDocument();
    expect(screen.getByText("1 reserva")).toBeInTheDocument();
    expect(screen.getByText("2 clientes")).toBeInTheDocument();
  });

  it("marks the blocked ones with a word, not only a color", async () => {
    signedInRoutes({ "GET /panel/customers/": { status: 200, body: page([summary({ is_blocked: true })]) } });
    renderApp("/panel/clientes");

    expect(await screen.findByText("Bloqueado")).toBeInTheDocument();
  });

  it("searches by name or phone", async () => {
    const api = signedInRoutes({ "GET /panel/customers/": { status: 200, body: page([summary()]) } });
    const user = userEvent.setup();
    renderApp("/panel/clientes");

    await screen.findByRole("link", { name: /Ana Pérez/ });
    await user.type(screen.getByRole("searchbox"), "987");

    await waitFor(() => {
      expect(api.fetchMock.mock.calls.some(([url]) => String(url).includes("q=987"))).toBe(true);
    });
  });

  it("filters to the blocked customers", async () => {
    const api = signedInRoutes({ "GET /panel/customers/": { status: 200, body: page([]) } });
    const user = userEvent.setup();
    renderApp("/panel/clientes");

    await user.click(await screen.findByRole("tab", { name: "Bloqueados" }));

    await waitFor(() => {
      expect(api.fetchMock.mock.calls.some(([url]) => String(url).includes("blocked=true"))).toBe(true);
    });
    expect(await screen.findByText("No tienes clientes bloqueados.")).toBeInTheDocument();
  });

  it("explains an empty list", async () => {
    signedInRoutes({ "GET /panel/customers/": { status: 200, body: page([]) } });
    renderApp("/panel/clientes");

    expect(await screen.findByText(/Todavía no tienes clientes/)).toBeInTheDocument();
  });

  it("offers to try again when the list fails", async () => {
    signedInRoutes({ "GET /panel/customers/": { status: 500, body: { detail: "Falla del servidor" } } });
    renderApp("/panel/clientes");

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar los clientes");
    expect(screen.getByRole("button", { name: "Intentar otra vez" })).toBeInTheDocument();
  });
});

describe("a customer", () => {
  it("shows contact data and the history", async () => {
    signedInRoutes({ "GET /panel/customers/5/": { status: 200, body: detail({ email: "ana@example.com" }) } });
    renderApp("/panel/clientes/5");

    expect(await screen.findByRole("heading", { level: 1, name: "Ana Pérez" })).toBeInTheDocument();
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /987 654 321/ })).toHaveAttribute("href", "tel:+51987654321");
    expect(screen.getByRole("link", { name: /Alquiler 1 hora/ })).toHaveAttribute("href", "/panel/reservas/40");
  });

  it("blocks only after asking again", async () => {
    const api = signedInRoutes({
      "GET /panel/customers/5/": { status: 200, body: detail() },
      "PATCH /panel/customers/5/": { status: 200, body: detail({ is_blocked: true }) },
    });
    const user = userEvent.setup();
    renderApp("/panel/clientes/5");

    await user.click(await screen.findByRole("button", { name: "Bloquear cliente" }));
    expect(api.calls.some((call) => call.method === "PATCH")).toBe(false);

    await user.click(screen.getByRole("button", { name: "Sí, bloquear" }));

    await waitFor(() => {
      expect(api.calls.find((call) => call.method === "PATCH")?.body).toEqual({ is_blocked: true });
    });
    expect(await screen.findByText(/está bloqueado/)).toBeInTheDocument();
  });

  it("unblocks in one tap", async () => {
    const api = signedInRoutes({
      "GET /panel/customers/5/": { status: 200, body: detail({ is_blocked: true }) },
      "PATCH /panel/customers/5/": { status: 200, body: detail({ is_blocked: false }) },
    });
    const user = userEvent.setup();
    renderApp("/panel/clientes/5");

    await user.click(await screen.findByRole("button", { name: "Desbloquear" }));

    await waitFor(() => {
      expect(api.calls.find((call) => call.method === "PATCH")?.body).toEqual({ is_blocked: false });
    });
    expect(await screen.findByRole("button", { name: "Bloquear cliente" })).toBeInTheDocument();
  });

  it("says when the customer does not exist", async () => {
    signedInRoutes({ "GET /panel/customers/5/": { status: 404, body: { detail: "No encontrado." } } });
    renderApp("/panel/clientes/5");

    expect(await screen.findByText("No encontramos a ese cliente")).toBeInTheDocument();
  });
});

describe("the more menu", () => {
  it("leads to the sections outside the tab bar", async () => {
    signedInRoutes();
    renderApp("/panel/mas");

    // The tab bar and the sidebar are the same element here; the menu itself lives in <main>.
    const menu = within(await screen.findByRole("main"));
    expect(menu.getByRole("link", { name: /Clientes/ })).toHaveAttribute("href", "/panel/clientes");
    expect(menu.getByRole("link", { name: /Bloqueos/ })).toHaveAttribute("href", "/panel/bloqueos");
    expect(menu.getByRole("link", { name: /Ajustes/ })).toHaveAttribute("href", "/panel/ajustes");
  });
});
