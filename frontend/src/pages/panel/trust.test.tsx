import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CustomerTrust } from "../../lib/panelTypes";
import { page, panelBooking, panelDetail, renderApp, signedInRoutes } from "../../test/helpers";

afterEach(() => {
  vi.unstubAllGlobals();
});

const pendingList = (...bookings: ReturnType<typeof panelBooking>[]) => (_init: RequestInit | undefined, query: URLSearchParams) => ({
  status: 200,
  body: page(query.get("status") === "pending" ? bookings : []),
});

const trusted = (level: CustomerTrust["level"], completed = 0, no_shows = 0): CustomerTrust => ({ level, completed, no_shows });

describe("who booked, on a booking waiting for an answer", () => {
  it("says it is a first time, so the owner knows to be careful", async () => {
    signedInRoutes({ "GET /panel/bookings/": pendingList(panelBooking({ id: 7, customer_trust: trusted("new") })) });
    renderApp("/panel");

    const card = within(await screen.findByRole("region", { name: /Por confirmar/ }));

    expect(await card.findByText("Primera vez")).toBeInTheDocument();
    expect(card.getByText("Todavía no tiene reservas atendidas contigo")).toBeInTheDocument();
  });

  it("says a customer came in with Google", async () => {
    signedInRoutes({ "GET /panel/bookings/": pendingList(panelBooking({ id: 7, customer_trust: trusted("verified") })) });
    renderApp("/panel");

    const card = within(await screen.findByRole("region", { name: /Por confirmar/ }));

    expect(await card.findByText("Verificado con Google")).toBeInTheDocument();
  });

  it("warns about someone who did not show up before, and how many times", async () => {
    signedInRoutes({ "GET /panel/bookings/": pendingList(panelBooking({ id: 7, customer_trust: trusted("flagged", 1, 2) })) });
    renderApp("/panel");

    const card = within(await screen.findByRole("region", { name: /Por confirmar/ }));

    expect(await card.findByText("Con faltas")).toBeInTheDocument();
    expect(card.getByText("No se presentó 2 veces · 1 reserva atendida")).toBeInTheDocument();
  });
});

describe("turning down a joke", () => {
  const joke = panelBooking({ id: 7, customer_trust: trusted("new") });

  it("asks first, because it blocks the customer", async () => {
    const api = signedInRoutes({ "GET /panel/bookings/": pendingList(joke) });
    const user = userEvent.setup();
    renderApp("/panel");

    const card = within(await screen.findByRole("region", { name: /Por confirmar/ }));
    await user.click(await card.findByRole("button", { name: "Era una broma" }));

    expect(card.getByText(/bloquear a este cliente/)).toBeInTheDocument();
    expect(api.calls.some((call) => call.path.endsWith("/dismiss/"))).toBe(false);
  });

  it("discards the booking and blocks the customer in one step once confirmed", async () => {
    const api = signedInRoutes({
      "GET /panel/bookings/": pendingList(joke),
      "POST /panel/bookings/7/dismiss/": { status: 200, body: panelDetail({ id: 7, status: "cancelled", customer_trust: trusted("flagged") }) },
    });
    const user = userEvent.setup();
    renderApp("/panel");

    const card = within(await screen.findByRole("region", { name: /Por confirmar/ }));
    await user.click(await card.findByRole("button", { name: "Era una broma" }));
    await user.click(card.getByRole("button", { name: "Sí, descartar y bloquear" }));

    await waitFor(() => expect(api.calls.some((call) => call.method === "POST" && call.path === "/panel/bookings/7/dismiss/")).toBe(true));
  });

  it("is also on the page of the booking, but only while it is pending", async () => {
    signedInRoutes({
      "GET /panel/bookings/7/": { status: 200, body: panelDetail({ id: 7, customer_trust: trusted("new") }) },
      "GET /panel/bookings/8/": { status: 200, body: panelDetail({ id: 8, status: "confirmed", customer_trust: trusted("known", 3) }) },
    });
    const { unmount } = renderApp("/panel/reservas/7");

    expect(await screen.findByRole("button", { name: "Era una broma" })).toBeInTheDocument();
    expect(screen.getByText("Primera vez")).toBeInTheDocument();
    unmount();

    renderApp("/panel/reservas/8");

    expect(await screen.findByText("Cliente conocido")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Era una broma" })).not.toBeInTheDocument();
  });
});

describe("in the list of bookings", () => {
  it("marks a customer with faults, and says nothing about the others", async () => {
    signedInRoutes({
      "GET /panel/bookings/": {
        status: 200,
        body: page([
          panelBooking({ id: 1, customer: { id: 1, name: "Ana Pérez", phone: "+51987654321", email: "", is_blocked: false }, customer_trust: trusted("flagged", 0, 1) }),
          panelBooking({ id: 2, customer: { id: 2, name: "Luis Ramos", phone: "+51987000111", email: "", is_blocked: false }, customer_trust: trusted("new") }),
        ]),
      },
    });
    renderApp("/panel/reservas");

    const ana = (await screen.findByRole("link", { name: /Ana Pérez/ })).closest("li")!;
    const luis = screen.getByRole("link", { name: /Luis Ramos/ }).closest("li")!;

    expect(within(ana).getByText("Con faltas")).toBeInTheDocument();
    expect(within(luis).queryByText("Con faltas")).not.toBeInTheDocument();
  });
});
