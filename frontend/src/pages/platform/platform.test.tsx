import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Dashboard } from "../../lib/platformTypes";
import { mockApi, page, renderApp, signedInRoutes } from "../../test/helpers";
import { TEAM } from "../../test/platform";

afterEach(() => {
  vi.unstubAllGlobals();
});

const DASHBOARD: Dashboard = {
  businesses: { total: 5, active: 4, suspended: 1 },
  subscriptions: { active: 3, expiring_soon: 1, grace: 1, expired: 0, without_subscription: 1 },
  revenue: { received_this_month: "240.00", expected_monthly: 320 },
  bookings_30d: 87,
  busiest: [
    { slug: "canchas-los-andes", name: "Canchas Los Andes", bookings: 60 },
    { slug: "consultorio-lucia", name: "Consultorio Lucía", bookings: 27 },
  ],
  attention: [
    { slug: "consultorio-lucia", name: "Consultorio Lucía", state: "grace", valid_until: "2030-03-31", days_left: -2, suspended: false },
    { slug: "canchas-los-andes", name: "Canchas Los Andes", state: "active", valid_until: "2030-04-03", days_left: 3, suspended: false },
  ],
};

function openTeam(dashboard: Dashboard | { status: number; body: unknown } = DASHBOARD, path = "/plataforma") {
  const reply = "status" in dashboard ? dashboard : { status: 200, body: dashboard };
  const api = signedInRoutes({
    "GET /auth/me/": { status: 200, body: TEAM },
    "GET /platform/dashboard/": reply,
  });
  renderApp(path);
  return api;
}

describe("who can enter the team area", () => {
  it("sends anyone who is not signed in to the login page", async () => {
    mockApi({});
    renderApp("/plataforma");

    expect(await screen.findByRole("heading", { name: "Entra a tu panel" })).toBeInTheDocument();
  });

  it("tells a business owner it is not for them, and offers their own panel", async () => {
    signedInRoutes();
    renderApp("/plataforma");

    expect(await screen.findByRole("heading", { name: "Esta sección es solo para el equipo" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir a mi panel" })).toHaveAttribute("href", "/panel");
  });

  it("lets the team in", async () => {
    openTeam();

    expect(await screen.findByRole("heading", { name: "Hola, Jose" })).toBeInTheDocument();
    expect(screen.getByText("Equipo de la plataforma")).toBeInTheDocument();
  });

  it("makes the team area the home of someone with no business of their own", async () => {
    openTeam(DASHBOARD, "/panel");

    expect(await screen.findByRole("heading", { name: "Hola, Jose" })).toBeInTheDocument();
  });

  it("does not offer business owners the team area in their panel", async () => {
    signedInRoutes({ "GET /panel/bookings/": { status: 200, body: page([]) } });
    renderApp("/panel");

    await screen.findByRole("heading", { name: /Hola/ });
    expect(screen.queryByRole("link", { name: "Ir a la plataforma" })).not.toBeInTheDocument();
  });
});

describe("the team home", () => {
  it("puts what needs attention first, with where each one stands", async () => {
    openTeam();

    const section = within(await screen.findByRole("region", { name: /Requieren atención/ }));
    const rows = section.getAllByRole("link");
    expect(rows[0]).toHaveTextContent("Consultorio Lucía");
    expect(rows[0]).toHaveTextContent("En gracia");
    expect(rows[1]).toHaveTextContent("Vence en 3 días");
    expect(rows[0]).toHaveAttribute("href", "/plataforma/negocios/consultorio-lucia");
  });

  it("says everything is fine when nothing needs attention", async () => {
    openTeam({ ...DASHBOARD, attention: [] });

    expect(await screen.findByText(/Todo al día/)).toBeInTheDocument();
  });

  it("shows the numbers", async () => {
    openTeam();

    const numbers = within(await screen.findByRole("region", { name: "En números" }));
    expect(numbers.getByText("Negocios activos").parentElement).toHaveTextContent("4");
    expect(numbers.getByText("Negocios activos").parentElement).toHaveTextContent("1 suspendidos");
    expect(numbers.getByText("Cobrado este mes").parentElement).toHaveTextContent("S/ 240");
    expect(numbers.getByText("Esperado al mes").parentElement).toHaveTextContent("S/ 320");
    expect(numbers.getByText("Reservas, 30 días").parentElement).toHaveTextContent("87");
  });

  it("breaks the subscriptions down and links to the matching businesses", async () => {
    openTeam();

    const list = within(await screen.findByRole("region", { name: "Suscripciones" }));
    expect(list.getByRole("link", { name: /Por vencer esta semana/ })).toHaveAttribute("href", "/plataforma/negocios?filtro=expiring");
    expect(list.getByRole("link", { name: /Sin suscripción/ })).toHaveAttribute("href", "/plataforma/negocios?filtro=no_subscription");
    expect(list.getByText("Vigentes").parentElement).toHaveTextContent("3");
  });

  it("lists the busiest businesses", async () => {
    openTeam();

    const list = within(await screen.findByRole("region", { name: "Más activos" }));
    expect(list.getAllByRole("link")[0]).toHaveTextContent("Canchas Los Andes");
    expect(list.getAllByRole("link")[0]).toHaveTextContent("60");
  });

  it("leaves out the busiest list when there is no activity", async () => {
    openTeam({ ...DASHBOARD, busiest: [] });

    await screen.findByRole("region", { name: "En números" });
    expect(screen.queryByRole("region", { name: "Más activos" })).not.toBeInTheDocument();
  });

  it("offers to try again when the numbers fail to load", async () => {
    openTeam({ status: 500, body: { detail: "Falla del servidor" } });

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar los indicadores");
    expect(screen.getByRole("button", { name: "Intentar otra vez" })).toBeInTheDocument();
  });

  it("has the team navigation, with Nuevo as the loud tab", async () => {
    openTeam();

    const nav = within(await screen.findByRole("navigation", { name: "Plataforma" }));
    expect(nav.getByRole("link", { name: "Negocios" })).toHaveAttribute("href", "/plataforma/negocios");
    expect(nav.getByRole("link", { name: "Actividad" })).toHaveAttribute("href", "/plataforma/actividad");
    expect(nav.getByRole("link", { name: "Nuevo" })).toHaveAttribute("href", "/plataforma/negocios/nuevo");
  });
});
