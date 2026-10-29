import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PanelBusiness, SubscriptionNotice } from "../../lib/panelTypes";
import { PANEL_BUSINESS, page, renderApp, signedInRoutes } from "../../test/helpers";

afterEach(() => {
  vi.unstubAllGlobals();
});

function openWith(changes: Partial<PanelBusiness>) {
  signedInRoutes({
    "GET /panel/business/": { status: 200, body: { ...PANEL_BUSINESS, ...changes } },
    "GET /panel/bookings/": { status: 200, body: page([]) },
  });
  renderApp("/panel");
}

const notice = (overrides: Partial<SubscriptionNotice>): SubscriptionNotice => ({
  state: "active",
  valid_until: "2030-03-31",
  grace_ends_on: "2030-04-05",
  days_left: 30,
  ...overrides,
});

describe("the subscription notice in the panel", () => {
  it("says nothing when the business has no subscription", async () => {
    openWith({ subscription: null });

    await screen.findByRole("heading", { name: /Hola/ });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("says nothing while there is plenty of time", async () => {
    openWith({ subscription: notice({ days_left: 30 }) });

    await screen.findByRole("heading", { name: /Hola/ });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("warns a week before it ends", async () => {
    openWith({ subscription: notice({ days_left: 7 }) });

    expect(await screen.findByRole("status")).toHaveTextContent("Tu suscripción vence en 7 días, el 31 de marzo.");
  });

  it("uses the singular for one day, and says today when it is the last day", async () => {
    openWith({ subscription: notice({ days_left: 1 }) });
    expect(await screen.findByRole("status")).toHaveTextContent("vence en 1 día,");
  });

  it("says it ends today", async () => {
    openWith({ subscription: notice({ days_left: 0 }) });

    expect(await screen.findByRole("status")).toHaveTextContent("Tu suscripción vence hoy.");
  });

  it("explains the grace days: customers can still book until a date", async () => {
    openWith({ subscription: notice({ state: "grace", days_left: -2 }) });

    const warning = await screen.findByRole("status");
    expect(warning).toHaveTextContent("venció el 31 de marzo");
    expect(warning).toHaveTextContent("seguir reservando hasta el 5 de abril");
  });

  it("explains that an expired page no longer takes bookings, and that the data is safe", async () => {
    openWith({ subscription: notice({ state: "expired", days_left: -30 }) });

    const warning = await screen.findByRole("status");
    expect(warning).toHaveTextContent("ya no recibe reservas nuevas");
    expect(warning).toHaveTextContent("a salvo");
  });

  it("keeps the suspended message, and it wins over the subscription", async () => {
    openWith({ status: "suspended", subscription: notice({ days_left: 3 }) });

    expect(await screen.findByRole("status")).toHaveTextContent("Tu negocio está suspendido");
  });

  it("does not block the owner from the panel when expired", async () => {
    openWith({ subscription: notice({ state: "expired", days_left: -30 }) });

    expect(await screen.findByRole("heading", { name: /Hola/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Reservas/ })).toBeInTheDocument();
  });
});
