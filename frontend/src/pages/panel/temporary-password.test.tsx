import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PANEL_BUSINESS, OWNER, page, renderApp, signedInRoutes } from "../../test/helpers";
import { TEAM, businessPage } from "../../test/platform";

afterEach(() => {
  vi.unstubAllGlobals();
});

const FORCED = { ...OWNER, must_change_password: true };
const CHANGE = "/panel/cambiar-contrasena";

function asForced(extra: Parameters<typeof signedInRoutes>[0] = {}) {
  return signedInRoutes({
    "GET /auth/me/": { status: 200, body: FORCED },
    "GET /panel/bookings/": { status: 200, body: page([]) },
    ...extra,
  });
}

describe("an account with a temporary password", () => {
  it("is taken to choose its own before the panel", async () => {
    asForced();
    renderApp("/panel");

    expect(await screen.findByRole("heading", { level: 1, name: "Elige tu contraseña" })).toBeInTheDocument();
    expect(screen.getByText(/Entraste con una contraseña temporal/)).toBeInTheDocument();
  });

  it("is also kept out of the platform area", async () => {
    signedInRoutes({ "GET /auth/me/": { status: 200, body: { ...TEAM, must_change_password: true } } });
    renderApp("/plataforma");

    expect(await screen.findByRole("heading", { level: 1, name: "Elige tu contraseña" })).toBeInTheDocument();
  });

  it("checks what it can before asking the server", async () => {
    const api = asForced();
    const user = userEvent.setup();
    renderApp(CHANGE);

    await user.type(await screen.findByLabelText("Contraseña temporal"), "k7mq-4xpd-9tzw");
    await user.type(screen.getByLabelText("Contraseña nueva"), "corta");
    await user.type(screen.getByLabelText("Repite la contraseña nueva"), "corta");
    await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));

    expect(await screen.findByText("Usa al menos 8 caracteres.")).toBeInTheDocument();
    expect(api.calls.some((call) => call.path === "/auth/change-password/")).toBe(false);
  });

  it("asks for the temporary one and for the new one twice", async () => {
    asForced();
    const user = userEvent.setup();
    renderApp(CHANGE);

    await user.type(await screen.findByLabelText("Contraseña nueva"), "mi-clave-propia-789");
    await user.type(screen.getByLabelText("Repite la contraseña nueva"), "otra-clave-distinta");
    await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));

    expect(await screen.findByText("Escribe tu contraseña actual.")).toBeInTheDocument();
    expect(screen.getByText("Las contraseñas no coinciden.")).toBeInTheDocument();
  });

  it("sends both passwords, opens the panel and stops being asked", async () => {
    const api = asForced({
      "POST /auth/change-password/": { status: 200, body: { access: "new-access", refresh: "new-refresh", user: OWNER } },
      "GET /panel/business/": { status: 200, body: PANEL_BUSINESS },
    });
    const user = userEvent.setup();
    renderApp(CHANGE);

    await user.type(await screen.findByLabelText("Contraseña temporal"), "k7mq-4xpd-9tzw");
    await user.type(screen.getByLabelText("Contraseña nueva"), "mi-clave-propia-789");
    await user.type(screen.getByLabelText("Repite la contraseña nueva"), "mi-clave-propia-789");
    await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));

    await waitFor(() => expect(api.calls.find((call) => call.path === "/auth/change-password/")?.body).toEqual({
      current_password: "k7mq-4xpd-9tzw",
      new_password: "mi-clave-propia-789",
    }));
    expect(await screen.findByRole("heading", { level: 1, name: /Hola/ })).toBeInTheDocument();
  });

  it("says so under the field when the temporary password is wrong", async () => {
    asForced({
      "POST /auth/change-password/": { status: 400, body: { current_password: ["La contraseña actual no es correcta."] } },
    });
    const user = userEvent.setup();
    renderApp(CHANGE);

    await user.type(await screen.findByLabelText("Contraseña temporal"), "equivocada-123");
    await user.type(screen.getByLabelText("Contraseña nueva"), "mi-clave-propia-789");
    await user.type(screen.getByLabelText("Repite la contraseña nueva"), "mi-clave-propia-789");
    await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));

    expect(await screen.findByText("La contraseña actual no es correcta.")).toBeInTheDocument();
  });

  it("can leave instead", async () => {
    asForced({ "POST /auth/logout/": { status: 204, body: null } });
    renderApp(CHANGE);

    expect(await screen.findByRole("button", { name: "Salir" })).toBeInTheDocument();
  });
});

describe("changing the password by choice", () => {
  it("is offered in the settings and does not call the password temporary", async () => {
    signedInRoutes();
    const user = userEvent.setup();
    renderApp("/panel/ajustes");

    await user.click(await screen.findByRole("link", { name: /Mi contraseña/ }));

    expect(await screen.findByRole("heading", { level: 1, name: "Cambiar contraseña" })).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña actual")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ajustes" })).toBeInTheDocument();
  });

  it("needs someone signed in", async () => {
    renderApp(CHANGE);

    expect(await screen.findByRole("heading", { name: /Entrar|Entra|Inicia/i })).toBeInTheDocument();
  });
});

describe("the team hands over access without an email", () => {
  const BASE = "/platform/businesses/canchas-los-andes";

  function team(extra: Parameters<typeof signedInRoutes>[0] = {}) {
    return signedInRoutes({
      "GET /auth/me/": { status: 200, body: TEAM },
      [`GET ${BASE}/`]: { status: 200, body: businessPage() },
      ...extra,
    });
  }

  it("shows a new temporary password once, with a message ready to send", async () => {
    team({
      [`GET ${BASE}/users/`]: {
        status: 200,
        body: [{ id: 1, email: "ana@example.com", name: "Ana", role: "owner", is_active: true, last_login: null, has_password: true, uses_google: false, created_at: "2030-01-01T00:00:00Z" }],
      },
      [`POST ${BASE}/users/1/temporary-password/`]: { status: 200, body: { temporary_password: "k7mq-4xpd-9tzw" } },
    });
    const user = userEvent.setup();
    renderApp("/plataforma/negocios/canchas-los-andes?seccion=personas");

    await user.click(await screen.findByRole("button", { name: "Dar contraseña temporal" }));
    await user.click(screen.getByRole("button", { name: "Sí, dar contraseña" }));

    expect(await screen.findByText("k7mq-4xpd-9tzw")).toBeInTheDocument();
    expect(screen.getByText(/Solo se muestra ahora/)).toBeInTheDocument();
    const message = screen.getByLabelText("Mensaje para enviar") as HTMLTextAreaElement;
    expect(message.value).toContain("Contraseña temporal: k7mq-4xpd-9tzw");
    expect(message.value).toContain("ana@example.com");
    expect(message.value).toContain("/panel/entrar");

    await user.click(screen.getByRole("button", { name: "Ya la copié" }));
    expect(screen.queryByText("k7mq-4xpd-9tzw")).not.toBeInTheDocument();
  });

  it("adds a person with a temporary password and shows it", async () => {
    const api = team({
      [`GET ${BASE}/users/`]: { status: 200, body: [] },
      [`POST ${BASE}/users/`]: {
        status: 201,
        body: {
          id: 2,
          email: "luis@example.com",
          name: "Luis",
          role: "staff",
          is_active: true,
          last_login: null,
          has_password: true,
          uses_google: false,
          created_at: "2030-01-01T00:00:00Z",
          account_created: true,
          temporary_password: "m3np-7qrt-2xvz",
        },
      },
    });
    const user = userEvent.setup();
    renderApp("/plataforma/negocios/canchas-los-andes?seccion=personas");

    await user.click(await screen.findByRole("button", { name: "Agregar a alguien" }));
    await user.type(screen.getByLabelText("Correo"), "luis@example.com");
    await user.click(screen.getByRole("radio", { name: /Con contraseña temporal/ }));
    await user.click(screen.getByRole("button", { name: "Agregar" }));

    expect(await screen.findByText("m3np-7qrt-2xvz")).toBeInTheDocument();
    expect(api.calls.find((call) => call.method === "POST" && call.path === `${BASE}/users/`)?.body).toMatchObject({
      delivery: "credentials",
    });
  });
});
