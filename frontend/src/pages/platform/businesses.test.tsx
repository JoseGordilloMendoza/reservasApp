import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PlatformBusinessRow } from "../../lib/platformTypes";
import { page, renderApp, signedInRoutes } from "../../test/helpers";
import { TEAM, row } from "../../test/platform";

afterEach(() => {
  vi.unstubAllGlobals();
});

function open(rows: PlatformBusinessRow[], path = "/plataforma/negocios", extra: Parameters<typeof signedInRoutes>[0] = {}) {
  const api = signedInRoutes({
    "GET /auth/me/": { status: 200, body: TEAM },
    "GET /platform/businesses/": { status: 200, body: page(rows) },
    ...extra,
  });
  renderApp(path);
  return api;
}

const asked = (api: ReturnType<typeof open>, fragment: string) =>
  api.fetchMock.mock.calls.some(([url]) => String(url).includes(fragment));

describe("the list of businesses", () => {
  it("shows each business with its link, type, plan, price, people and activity", async () => {
    open([row()]);

    const item = await screen.findByRole("link", { name: /Canchas Los Andes/ });
    expect(item).toHaveAttribute("href", "/plataforma/negocios/canchas-los-andes");
    expect(item).toHaveTextContent("/canchas-los-andes");
    expect(item).toHaveTextContent("Cancha deportiva · Mensual · S/ 80 al mes");
    expect(item).toHaveTextContent("2 usuarios · 41 reservas en 30 días");
    expect(item).toHaveTextContent("Vigente");
  });

  it("uses the singular for one user and one booking", async () => {
    open([row({ users_count: 1, bookings_30d: 1 })]);

    expect(await screen.findByText("1 usuario · 1 reserva en 30 días")).toBeInTheDocument();
  });

  it("says suspended before anything else about the subscription", async () => {
    open([row({ status: "suspended" })]);

    expect(await screen.findByRole("link", { name: /Canchas Los Andes/ })).toHaveTextContent("Suspendido");
  });

  it("says when there is no subscription, without a plan or price line", async () => {
    open([row({ standing: { state: "none", valid_until: null, grace_ends_on: null, days_left: null }, plan_name: null, price: null })]);

    const item = await screen.findByRole("link", { name: /Canchas Los Andes/ });
    expect(item).toHaveTextContent("Sin suscripción");
    expect(item).toHaveTextContent("Cancha deportiva");
    expect(item).not.toHaveTextContent("al mes");
  });

  it("counts them", async () => {
    open([row(), row({ slug: "otro", name: "Otro" })]);

    expect(await screen.findByText("2 negocios")).toBeInTheDocument();
  });

  it("invites to open the first business when there are none", async () => {
    open([]);

    expect(await screen.findByText(/Todavía no hay negocios/)).toBeInTheDocument();
  });

  it("offers to try again when it fails", async () => {
    open([], "/plataforma/negocios", { "GET /platform/businesses/": { status: 500, body: { detail: "Falla del servidor" } } });

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar los negocios");
  });

  it("loads more when there are more", async () => {
    const api = signedInRoutes({
      "GET /auth/me/": { status: 200, body: TEAM },
      "GET /platform/businesses/": (_init, query) =>
        query.get("page") === "2"
          ? { status: 200, body: page([row({ slug: "segundo", name: "Segundo" })], { count: 2 }) }
          : { status: 200, body: page([row()], { count: 2, next: "http://x/?page=2" }) },
    });
    const user = userEvent.setup();
    renderApp("/plataforma/negocios");

    await user.click(await screen.findByRole("button", { name: "Ver más" }));

    expect(await screen.findByRole("link", { name: /Segundo/ })).toBeInTheDocument();
    expect(asked(api, "page=2")).toBe(true);
    expect(screen.queryByRole("button", { name: "Ver más" })).not.toBeInTheDocument();
  });
});

describe("filtering and searching", () => {
  it("asks for the businesses of a state when its tab is chosen", async () => {
    const api = open([row()]);
    const user = userEvent.setup();

    await screen.findByRole("link", { name: /Canchas Los Andes/ });
    await user.click(screen.getByRole("tab", { name: "Suspendidos" }));

    await waitFor(() => expect(asked(api, "filter=suspended")).toBe(true));
    expect(screen.getByRole("tab", { name: "Suspendidos" })).toHaveAttribute("aria-selected", "true");
  });

  it("starts on the filter named in the address, as the home links do", async () => {
    const api = open([row()], "/plataforma/negocios?filtro=expiring");

    await screen.findByRole("link", { name: /Canchas Los Andes/ });

    expect(asked(api, "filter=expiring")).toBe(true);
    expect(screen.getByRole("tab", { name: "Por vencer" })).toHaveAttribute("aria-selected", "true");
  });

  it("ignores a filter it does not know", async () => {
    const api = open([row()], "/plataforma/negocios?filtro=inventado");

    await screen.findByRole("link", { name: /Canchas Los Andes/ });

    expect(asked(api, "filter=")).toBe(false);
    expect(screen.getByRole("tab", { name: "Todos" })).toHaveAttribute("aria-selected", "true");
  });

  it("goes back to all of them", async () => {
    const api = open([row()], "/plataforma/negocios?filtro=suspended");
    const user = userEvent.setup();

    await screen.findByRole("link", { name: /Canchas Los Andes/ });
    await user.click(screen.getByRole("tab", { name: "Todos" }));

    await waitFor(() => expect(screen.getByRole("tab", { name: "Todos" })).toHaveAttribute("aria-selected", "true"));
    expect(api.fetchMock.mock.calls.at(-1)?.[0]).not.toContain("filter=");
  });

  it("searches by name or link", async () => {
    const api = open([row()]);
    const user = userEvent.setup();

    await screen.findByRole("link", { name: /Canchas Los Andes/ });
    await user.type(screen.getByRole("searchbox"), "lucia");

    await waitFor(() => expect(asked(api, "q=lucia")).toBe(true));
  });

  it("says nothing matches, rather than that there are no businesses", async () => {
    open([], "/plataforma/negocios?filtro=suspended");

    expect(await screen.findByText("Ningún negocio coincide.")).toBeInTheDocument();
  });

  it("offers every state to filter by", async () => {
    open([row()]);

    const tabs = within(await screen.findByRole("tablist", { name: "Filtrar negocios" }));
    expect(tabs.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Todos",
      "Activos",
      "Por vencer",
      "Vencidos",
      "Suspendidos",
      "Sin suscripción",
    ]);
  });
});
