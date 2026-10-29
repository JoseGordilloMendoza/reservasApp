import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ActivityEntry } from "../../lib/platformTypes";
import { page, renderApp, signedInRoutes } from "../../test/helpers";
import { TEAM } from "../../test/platform";

afterEach(() => {
  vi.unstubAllGlobals();
});

const entry = (overrides: Partial<ActivityEntry> = {}): ActivityEntry => ({
  id: 1,
  actor_email: "equipo@example.com",
  business_slug: "canchas-los-andes",
  action: "payment.recorded",
  detail: { amount: "80.00", method: "yape", months: 1 },
  created_at: "2030-03-20T15:30:00Z",
  ...overrides,
});

function open(entries: ActivityEntry[], path = "/plataforma/actividad", extra: Parameters<typeof signedInRoutes>[0] = {}) {
  const api = signedInRoutes({
    "GET /auth/me/": { status: 200, body: TEAM },
    "GET /platform/activity/": { status: 200, body: page(entries) },
    ...extra,
  });
  renderApp(path);
  return api;
}

const asked = (api: ReturnType<typeof open>, fragment: string) =>
  api.fetchMock.mock.calls.some(([url]) => String(url).includes(fragment));

describe("the activity of the team", () => {
  it("says in a sentence what was done, by whom, when, and on which business", async () => {
    open([entry()]);

    expect(await screen.findByText("Registró un pago de S/ 80 (Yape, 1 mes)")).toBeInTheDocument();
    expect(screen.getByText("equipo@example.com")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "/canchas-los-andes" })).toHaveAttribute("href", "/plataforma/negocios/canchas-los-andes");
    // 15:30 UTC is 10:30 in Lima.
    expect(screen.getByText(/10:30/)).toBeInTheDocument();
  });

  it("leaves out the business link for something not tied to one", async () => {
    open([entry({ business_slug: "" })]);

    await screen.findByText(/Registró un pago/);
    expect(screen.queryByRole("link", { name: /^\// })).not.toBeInTheDocument();
  });

  it("says when there is nothing", async () => {
    open([]);

    expect(await screen.findByText("No hay actividad que mostrar.")).toBeInTheDocument();
  });

  it("offers to try again when it fails", async () => {
    open([], "/plataforma/actividad", { "GET /platform/activity/": { status: 500, body: { detail: "Falla del servidor" } } });

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar la actividad");
  });

  it("loads more when there are more", async () => {
    const api = signedInRoutes({
      "GET /auth/me/": { status: 200, body: TEAM },
      "GET /platform/activity/": (_init, query) =>
        query.get("page") === "2"
          ? { status: 200, body: page([entry({ id: 2, action: "business.created", detail: {} })], { count: 2 }) }
          : { status: 200, body: page([entry()], { count: 2, next: "http://x/?page=2" }) },
    });
    const user = userEvent.setup();
    renderApp("/plataforma/actividad");

    await user.click(await screen.findByRole("button", { name: "Ver más" }));

    expect(await screen.findByText("Abrió el negocio")).toBeInTheDocument();
    expect(asked(api as never, "page=2")).toBe(true);
  });
});

describe("filtering the activity", () => {
  it("asks for one kind of action when its tab is chosen", async () => {
    const api = open([entry()]);
    const user = userEvent.setup();

    await screen.findByText(/Registró un pago/);
    await user.click(screen.getByRole("tab", { name: "Soporte" }));

    await waitFor(() => expect(asked(api, "kind=support")).toBe(true));
    expect(screen.getByRole("tab", { name: "Soporte" })).toHaveAttribute("aria-selected", "true");
  });

  it("starts on the kind and the business named in the address", async () => {
    const api = open([entry()], "/plataforma/actividad?tipo=payment&negocio=canchas-los-andes");

    await screen.findByText(/Registró un pago/);

    expect(asked(api, "kind=payment")).toBe(true);
    expect(asked(api, "business=canchas-los-andes")).toBe(true);
    expect(screen.getByText("Solo de /canchas-los-andes")).toBeInTheDocument();
  });

  it("ignores a kind it does not know", async () => {
    const api = open([entry()], "/plataforma/actividad?tipo=inventado");

    await screen.findByText(/Registró un pago/);

    expect(asked(api, "kind=")).toBe(false);
    expect(screen.getByRole("tab", { name: "Todo" })).toHaveAttribute("aria-selected", "true");
  });

  it("lets go of the business filter without losing the kind", async () => {
    const api = open([entry()], "/plataforma/actividad?tipo=payment&negocio=canchas-los-andes");
    const user = userEvent.setup();

    await screen.findByText("Solo de /canchas-los-andes");
    await user.click(screen.getByRole("button", { name: "Ver la actividad de todos los negocios" }));

    await waitFor(() => expect(screen.queryByText(/^Solo de/)).not.toBeInTheDocument());
    const last = String(api.fetchMock.mock.calls.at(-1)?.[0]);
    expect(last).toContain("kind=payment");
    expect(last).not.toContain("business=");
  });

  it("keeps the business when the kind changes", async () => {
    const api = open([entry()], "/plataforma/actividad?negocio=canchas-los-andes");
    const user = userEvent.setup();

    await screen.findByText(/Registró un pago/);
    await user.click(screen.getByRole("tab", { name: "Pagos" }));

    await waitFor(() => expect(asked(api, "kind=payment")).toBe(true));
    expect(String(api.fetchMock.mock.calls.at(-1)?.[0])).toContain("business=canchas-los-andes");
  });

  it("offers every kind", async () => {
    open([entry()]);

    const tabs = await screen.findAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Todo", "Negocios", "Suscripciones", "Pagos", "Personas", "Soporte"]);
  });
});
