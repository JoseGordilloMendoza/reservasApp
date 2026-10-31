import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PANEL_BUSINESS, page, panelBooking, panelDetail, renderApp, signedInRoutes } from "../../test/helpers";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The home page asks for pending bookings and for today's; tell them apart by their filters. */
function bookingsFor(pending: ReturnType<typeof panelBooking>[], today: ReturnType<typeof panelBooking>[]) {
  return (_init: RequestInit | undefined, query: URLSearchParams) => ({
    status: 200,
    body: page(query.get("status") === "pending" ? pending : today),
  });
}

describe("the panel home", () => {
  it("greets the owner by first name", async () => {
    signedInRoutes({ "GET /panel/bookings/": bookingsFor([], []) });
    renderApp("/panel");

    expect(await screen.findByRole("heading", { level: 1, name: "Hola, Rosa" })).toBeInTheDocument();
  });

  it("puts the bookings waiting for an answer first, with how to reach the customer", async () => {
    const pending = panelBooking({ id: 7, expires_at: "2030-01-08T03:00:00Z" });
    signedInRoutes({ "GET /panel/bookings/": bookingsFor([pending], []) });
    renderApp("/panel");

    const section = await screen.findByRole("region", { name: /Por confirmar/ });
    const card = within(section);

    expect(await card.findByRole("link", { name: "Ana Pérez" })).toHaveAttribute("href", "/panel/reservas/7");
    expect(card.getByText("17:00")).toBeInTheDocument();
    expect(card.getByText(/se libera a las 22:00/)).toBeInTheDocument();
    expect(card.getByRole("link", { name: /987 654 321/ })).toHaveAttribute("href", "tel:+51987654321");
    expect(card.getByRole("link", { name: "WhatsApp" })).toHaveAttribute(
      "href",
      expect.stringContaining("https://wa.me/51987654321"),
    );
    expect(card.getByRole("button", { name: "Confirmar" })).toBeInTheDocument();
  });

  it("counts what is waiting", async () => {
    signedInRoutes({
      "GET /panel/bookings/": bookingsFor([panelBooking(), panelBooking(), panelBooking()], []),
    });
    renderApp("/panel");

    const heading = await screen.findByRole("heading", { name: /Por confirmar/ });

    await waitFor(() => expect(heading).toHaveTextContent("3"));
  });

  it("says when nothing is waiting", async () => {
    signedInRoutes({ "GET /panel/bookings/": bookingsFor([], []) });
    renderApp("/panel");

    expect(await screen.findByText("Nada por confirmar. Todo al día.")).toBeInTheDocument();
  });

  it("confirms a booking in one tap and refreshes the list", async () => {
    const booking = panelBooking({ id: 7 });
    let pending = [booking];
    const { calls } = signedInRoutes({
      "GET /panel/bookings/": (_init, query) => ({
        status: 200,
        body: page(query.get("status") === "pending" ? pending : []),
      }),
      "POST /panel/bookings/7/confirm/": () => {
        pending = [];
        return { status: 200, body: panelDetail({ id: 7, status: "confirmed" }) };
      },
    });
    renderApp("/panel");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText("Nada por confirmar. Todo al día.")).toBeInTheDocument();
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(1);
  });

  it("asks before rejecting, and can be backed out of", async () => {
    const { calls } = signedInRoutes({ "GET /panel/bookings/": bookingsFor([panelBooking({ id: 7 })], []) });
    renderApp("/panel");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Rechazar" }));
    expect(screen.getByText("¿Rechazar esta reserva?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "No" }));

    expect(screen.queryByText("¿Rechazar esta reserva?")).not.toBeInTheDocument();
    expect(calls.some((call) => call.method === "POST")).toBe(false);
  });

  it("rejects after the owner agrees", async () => {
    const { calls } = signedInRoutes({
      "GET /panel/bookings/": bookingsFor([panelBooking({ id: 7 })], []),
      "POST /panel/bookings/7/reject/": { status: 200, body: panelDetail({ id: 7, status: "cancelled" }) },
    });
    renderApp("/panel");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Rechazar" }));
    await user.click(screen.getByRole("button", { name: "Sí, rechazar" }));

    await waitFor(() => expect(calls.some((call) => call.path === "/panel/bookings/7/reject/")).toBe(true));
  });

  it("shows the server's message when a booking can no longer be confirmed", async () => {
    signedInRoutes({
      "GET /panel/bookings/": bookingsFor([panelBooking({ id: 7 })], []),
      "POST /panel/bookings/7/confirm/": {
        status: 409,
        body: { code: "booking_expired", detail: "La reserva venció y su horario fue liberado. Crea una nueva." },
      },
    });
    renderApp("/panel");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Confirmar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("La reserva venció y su horario fue liberado");
  });

  it("lists today's bookings by time, each linking to its page", async () => {
    const morning = panelBooking({ id: 1, status: "confirmed", customer: { id: 1, name: "Luis Ramos", phone: "+51911111111", email: "", is_blocked: false } });
    signedInRoutes({ "GET /panel/bookings/": bookingsFor([], [morning]) });
    renderApp("/panel");

    const today = await screen.findByRole("region", { name: "Hoy" });

    expect(await within(today).findByRole("link", { name: /Luis Ramos/ })).toHaveAttribute("href", "/panel/reservas/1");
    expect(within(today).getByText("Confirmada")).toBeInTheDocument();
  });

  it("invites to write one down when today is empty", async () => {
    signedInRoutes({ "GET /panel/bookings/": bookingsFor([], []) });
    renderApp("/panel");

    expect(await screen.findByText("Hoy no hay reservas.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Anotar una reserva" })).toHaveAttribute("href", "/panel/reservas/nueva");
  });

  it("warns when the business is suspended", async () => {
    signedInRoutes({
      "GET /panel/business/": { status: 200, body: { ...PANEL_BUSINESS, status: "suspended" } },
      "GET /panel/bookings/": bookingsFor([], []),
    });
    renderApp("/panel");

    expect(await screen.findByText(/Tu negocio está suspendido/)).toBeInTheDocument();
  });

  it("paints the panel with the business accent", async () => {
    signedInRoutes({
      "GET /panel/business/": { status: 200, body: { ...PANEL_BUSINESS, accent: "sky" } },
      "GET /panel/bookings/": bookingsFor([], []),
    });
    renderApp("/panel");

    await screen.findByRole("heading", { level: 1, name: /Hola/ });
    await waitFor(() => expect(document.documentElement.dataset.accent).toBe("sky"));
  });

  it("offers the main actions in the navigation", async () => {
    signedInRoutes({ "GET /panel/bookings/": bookingsFor([], []) });
    renderApp("/panel");

    const nav = await screen.findByRole("navigation", { name: "Panel" });

    expect(within(nav).getByRole("link", { name: "Inicio" })).toHaveAttribute("href", "/panel");
    expect(within(nav).getByRole("link", { name: "Anotar" })).toHaveAttribute("href", "/panel/reservas/nueva");
    expect(within(nav).getByRole("link", { name: "Reservas" })).toHaveAttribute("href", "/panel/reservas");
  });
});
