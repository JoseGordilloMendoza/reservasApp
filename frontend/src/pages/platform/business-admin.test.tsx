import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getSupport } from "../../lib/session";
import type { PlatformBusiness } from "../../lib/platformTypes";
import { page, renderApp, signedInRoutes } from "../../test/helpers";
import { TEAM, businessPage } from "../../test/platform";

afterEach(() => {
  vi.unstubAllGlobals();
});

const PATH = "/plataforma/negocios/canchas-los-andes";
const BASE = "/platform/businesses/canchas-los-andes";

function open(business: PlatformBusiness = businessPage(), path = PATH, extra: Parameters<typeof signedInRoutes>[0] = {}) {
  const api = signedInRoutes({
    "GET /auth/me/": { status: 200, body: TEAM },
    [`GET ${BASE}/`]: { status: 200, body: business },
    ...extra,
  });
  renderApp(path);
  return api;
}

const called = (api: ReturnType<typeof open>, method: string, path: string) =>
  api.calls.find((call) => call.method === method && call.path === path);

describe("a business, for the team", () => {
  it("shows who it is and where it stands", async () => {
    open();

    expect(await screen.findByRole("heading", { level: 1, name: "Canchas Los Andes" })).toBeInTheDocument();
    expect(screen.getByText("/canchas-los-andes")).toBeInTheDocument();
    expect(screen.getByText("Cancha deportiva")).toBeInTheDocument();
    expect(screen.getByText("America/Lima")).toBeInTheDocument();
    expect(screen.getByText("2 personas")).toBeInTheDocument();
    expect(screen.getByText("Vigente")).toBeInTheDocument();
  });

  it("offers its public link to copy", async () => {
    open();

    const link = (await screen.findByLabelText("Enlace público")) as HTMLTextAreaElement;
    expect(link.value).toBe(`${window.location.origin}/canchas-los-andes`);
  });

  it("says when the business does not exist", async () => {
    open(businessPage(), PATH, { [`GET ${BASE}/`]: { status: 404, body: { detail: "No encontrado." } } });

    expect(await screen.findByText("No encontramos ese negocio")).toBeInTheDocument();
  });

  it("says when it could not be loaded", async () => {
    open(businessPage(), PATH, { [`GET ${BASE}/`]: { status: 500, body: { detail: "Falla del servidor" } } });

    expect(await screen.findByText("No pudimos cargar el negocio")).toBeInTheDocument();
  });

  it("leads to what the team did in this business", async () => {
    open();

    expect(await screen.findByRole("link", { name: /Ver lo que el equipo hizo/ })).toHaveAttribute(
      "href",
      "/plataforma/actividad?negocio=canchas-los-andes",
    );
  });

  it("has a way back to the list", async () => {
    open();

    expect(await screen.findByRole("link", { name: "Negocios" })).toHaveAttribute("href", "/plataforma/negocios");
  });

  it("moves between its sections, and opens the one named in the address", async () => {
    open(businessPage(), `${PATH}?seccion=personas`, { [`GET ${BASE}/users/`]: { status: 200, body: [] } });

    expect(await screen.findByRole("heading", { name: "Personas del negocio" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Personas" })).toHaveAttribute("aria-selected", "true");
  });

  it("ignores a section it does not know", async () => {
    open(businessPage(), `${PATH}?seccion=inventada`);

    await screen.findByRole("heading", { level: 1, name: "Canchas Los Andes" });
    expect(screen.getByRole("tab", { name: "Resumen" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows the subscription section when its tab is chosen", async () => {
    open(businessPage(), PATH, { [`GET ${BASE}/payments/`]: { status: 200, body: [] } });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("tab", { name: "Suscripción" }));

    expect(await screen.findByRole("heading", { level: 2, name: "Suscripción" })).toBeInTheDocument();
  });
});

describe("suspending", () => {
  it("asks for a reason first, and does not call the server without one", async () => {
    const api = open();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Suspender negocio" }));
    await user.click(screen.getByRole("button", { name: "Suspender" }));

    expect(await screen.findByText("Escribe el motivo: queda en el registro.")).toBeInTheDocument();
    expect(called(api, "POST", `${BASE}/suspend/`)).toBeUndefined();
  });

  it("suspends with the reason", async () => {
    const api = open(businessPage(), PATH, {
      [`POST ${BASE}/suspend/`]: { status: 200, body: businessPage({ status: "suspended", suspended_reason: "No pagó" }) },
    });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Suspender negocio" }));
    await user.type(screen.getByLabelText("Motivo"), "  No pagó  ");
    await user.click(screen.getByRole("button", { name: "Suspender" }));

    await waitFor(() => expect(called(api, "POST", `${BASE}/suspend/`)?.body).toEqual({ reason: "No pagó" }));
  });

  it("can be called off before confirming", async () => {
    const api = open();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Suspender negocio" }));
    await user.click(screen.getByRole("button", { name: "No" }));

    expect(screen.getByRole("button", { name: "Suspender negocio" })).toBeInTheDocument();
    expect(called(api, "POST", `${BASE}/suspend/`)).toBeUndefined();
  });

  it("shows the reason of a suspended business and how to reactivate it", async () => {
    open(businessPage({ status: "suspended", suspended_reason: "No pagó los dos últimos meses" }));

    const section = within(await screen.findByRole("region", { name: "Suspendido" }));
    expect(section.getByText(/No pagó los dos últimos meses/)).toBeInTheDocument();
    expect(screen.getAllByText("Suspendido").length).toBeGreaterThan(1); // the stamp says it too
  });

  it("reactivates only after asking", async () => {
    const api = open(businessPage({ status: "suspended", suspended_reason: "x" }), PATH, {
      [`POST ${BASE}/reactivate/`]: { status: 200, body: businessPage() },
    });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Reactivar" }));
    expect(called(api, "POST", `${BASE}/reactivate/`)).toBeUndefined();
    await user.click(screen.getByRole("button", { name: "Sí, reactivar" }));

    await waitFor(() => expect(called(api, "POST", `${BASE}/reactivate/`)).toBeDefined());
  });

  it("warns that reactivating does not reopen a business whose subscription expired", async () => {
    open(
      businessPage({
        status: "suspended",
        suspended_reason: "x",
        standing: { state: "expired", valid_until: "2030-01-01", grace_ends_on: "2030-01-06", days_left: -90 },
      }),
    );

    expect(await screen.findByText(/seguirá sin recibir reservas hasta que registres un pago/)).toBeInTheDocument();
  });

  it("does not warn about that when the subscription is fine", async () => {
    open(businessPage({ status: "suspended", suspended_reason: "x" }));

    await screen.findByRole("region", { name: "Suspendido" });
    expect(screen.queryByText(/seguirá sin recibir reservas/)).not.toBeInTheDocument();
  });
});

describe("entering as support", () => {
  const SESSION = { id: 7, business: "canchas-los-andes", reason: "Ayuda con los horarios", started_at: "2030-01-01T00:00:00Z", expires_at: new Date(Date.now() + 7_200_000).toISOString() };

  const panelRoutes = {
    "GET /panel/business/": { status: 200, body: { name: "Canchas Los Andes", slug: "canchas-los-andes", timezone: "America/Lima", accent: "lime", status: "active", subscription: null, support: null } },
    "GET /panel/bookings/": { status: 200, body: page([]) },
  };

  it("asks why before going in, and does not open a session without a reason", async () => {
    const api = open();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Entrar como soporte" }));

    expect(await screen.findByText("Escribe por qué entras: queda en el registro.")).toBeInTheDocument();
    expect(called(api, "POST", `${BASE}/support-session/`)).toBeUndefined();
  });

  it("opens a session with the reason and goes into the business panel", async () => {
    const api = open(businessPage(), PATH, { [`POST ${BASE}/support-session/`]: { status: 201, body: SESSION }, ...panelRoutes });
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("¿Por qué entras?"), "Ayuda con los horarios");
    await user.click(screen.getByRole("button", { name: "Entrar como soporte" }));

    expect(await screen.findByRole("heading", { name: /Hola/ })).toBeInTheDocument();
    expect(called(api, "POST", `${BASE}/support-session/`)?.body).toEqual({ reason: "Ayuda con los horarios" });
    expect(getSupport()).toMatchObject({ session: 7, slug: "canchas-los-andes", name: "Canchas Los Andes", reason: "Ayuda con los horarios" });
  });

  it("stays in the team area when the server refuses", async () => {
    open(businessPage(), PATH, { [`POST ${BASE}/support-session/`]: { status: 403, body: { code: "forbidden", detail: "No puedes hacer esto." } } });
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("¿Por qué entras?"), "Ayuda");
    await user.click(screen.getByRole("button", { name: "Entrar como soporte" }));

    expect(await screen.findByText("No puedes hacer esto.")).toBeInTheDocument();
    expect(getSupport()).toBeNull();
  });
});
