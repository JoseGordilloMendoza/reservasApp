import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OWNER, mockApi, page, renderApp, signedInRoutes } from "../../test/helpers";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  delete window.google;
});

const SESSION = { access: "access-1", refresh: "refresh-1", user: OWNER };
const EMPTY = { status: 200, body: page([]) };

/** What the panel asks for as soon as it opens. */
const PANEL = {
  "GET /panel/business/": { status: 200, body: { name: "Canchas Los Andes", slug: "canchas-los-andes", timezone: "America/Lima", accent: "lime", status: "active" } },
  "GET /panel/bookings/": EMPTY,
};

describe("the panel login", () => {
  it("sends anyone who is not signed in to the login page", async () => {
    mockApi({});
    renderApp("/panel");

    expect(await screen.findByRole("heading", { name: "Entra a tu panel" })).toBeInTheDocument();
  });

  it("signs in with email and password and opens the panel", async () => {
    const { calls } = mockApi({ "POST /auth/login/": { status: 200, body: SESSION }, ...PANEL });
    renderApp("/panel/entrar");
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Correo"), "rosa@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "clave-segura");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("heading", { name: /Hola, Rosa/ })).toBeInTheDocument();
    expect(calls.find((call) => call.path === "/auth/login/")?.body).toEqual({
      email: "rosa@example.com",
      password: "clave-segura",
    });
    expect(localStorage.getItem("separa.panel.refresh.v1")).toBe("refresh-1");
  });

  it("shows the server's message for wrong credentials and stays on the page", async () => {
    mockApi({
      "POST /auth/login/": { status: 401, body: { code: "invalid_credentials", detail: "Correo o contraseña incorrectos." } },
    });
    renderApp("/panel/entrar");
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Correo"), "rosa@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "mal");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Correo o contraseña incorrectos.");
    expect(screen.getByRole("heading", { name: "Entra a tu panel" })).toBeInTheDocument();
    expect(localStorage.getItem("separa.panel.refresh.v1")).toBeNull();
  });

  it("asks to wait when there were too many attempts", async () => {
    mockApi({ "POST /auth/login/": { status: 429, body: { detail: "Request was throttled." } } });
    renderApp("/panel/entrar");
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Correo"), "rosa@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "x");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Espera/);
  });

  it("does not call the server with empty fields", async () => {
    const { calls } = mockApi({});
    renderApp("/panel/entrar");

    await userEvent.setup().click(screen.getByRole("button", { name: "Entrar" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Escribe tu correo y tu contraseña.");
    expect(calls).toHaveLength(0);
  });

  it("takes someone already signed in straight to the panel", async () => {
    signedInRoutes({ "GET /panel/bookings/": EMPTY });
    renderApp("/panel/entrar");

    expect(await screen.findByRole("heading", { name: /Hola, Rosa/ })).toBeInTheDocument();
  });
});

describe("signing in with Google", () => {
  it("offers no Google button until a client id is configured", () => {
    mockApi({});
    renderApp("/panel/entrar");

    expect(screen.queryByLabelText("Entrar con Google")).not.toBeInTheDocument();
  });

  it("draws Google's button and signs in with the credential it returns", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "client-123.apps.googleusercontent.com");
    let deliver: (response: { credential: string }) => void = () => {};
    const renderButton = vi.fn();
    window.google = {
      accounts: {
        id: {
          initialize: (options) => {
            deliver = options.callback;
          },
          renderButton,
        },
      },
    };
    const { calls } = mockApi({ "POST /auth/google/": { status: 200, body: SESSION }, ...PANEL });
    renderApp("/panel/entrar");

    await waitFor(() => expect(renderButton).toHaveBeenCalled());
    expect(renderButton.mock.calls[0]?.[1]).toMatchObject({ locale: "es" });

    deliver({ credential: "google-id-token" });

    expect(await screen.findByRole("heading", { name: /Hola, Rosa/ })).toBeInTheDocument();
    expect(calls.find((call) => call.path === "/auth/google/")?.body).toEqual({ credential: "google-id-token" });
  });

  it("shows the server's message when the Google account has no business", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "client-123.apps.googleusercontent.com");
    let deliver: (response: { credential: string }) => void = () => {};
    window.google = {
      accounts: { id: { initialize: (options) => (deliver = options.callback), renderButton: vi.fn() } },
    };
    mockApi({
      "POST /auth/google/": {
        status: 401,
        body: { code: "account_not_found", detail: "No hay una cuenta activa con ese correo." },
      },
    });
    renderApp("/panel/entrar");
    await waitFor(() => expect(window.google?.accounts.id.renderButton).toHaveBeenCalled());

    deliver({ credential: "google-id-token" });

    expect(await screen.findByRole("alert")).toHaveTextContent("No hay una cuenta activa con ese correo.");
  });
});

describe("the session", () => {
  it("picks the session up again after a reload", async () => {
    signedInRoutes({ "GET /panel/bookings/": EMPTY });
    renderApp("/panel");

    expect(await screen.findByRole("heading", { name: /Hola, Rosa/ })).toBeInTheDocument();
  });

  it("sends the owner back to login when the session can no longer be renewed", async () => {
    localStorage.setItem("separa.panel.refresh.v1", "dead-token");
    mockApi({
      "POST /auth/refresh/": { status: 401, body: { detail: "Token is blacklisted" } },
    });
    renderApp("/panel");

    expect(await screen.findByRole("heading", { name: "Entra a tu panel" })).toBeInTheDocument();
    expect(localStorage.getItem("separa.panel.refresh.v1")).toBeNull();
  });

  it("explains when an account has no business", async () => {
    signedInRoutes({
      "GET /auth/me/": { status: 200, body: { ...OWNER, memberships: [] } },
    });
    renderApp("/panel");

    expect(await screen.findByText("Esta cuenta no tiene un negocio")).toBeInTheDocument();
    expect(screen.getByText(/rosa@example.com/)).toBeInTheDocument();
  });

  it("signs out: tells the server, forgets the tokens and returns to login", async () => {
    const { calls } = signedInRoutes({
      "GET /panel/bookings/": EMPTY,
      "POST /auth/logout/": { status: 200, body: {} },
    });
    renderApp("/panel");
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: /Hola, Rosa/ });
    await user.click(screen.getAllByRole("button", { name: "Salir" })[0]!);

    expect(await screen.findByRole("heading", { name: "Entra a tu panel" })).toBeInTheDocument();
    expect(calls.find((call) => call.path === "/auth/logout/")?.body).toEqual({ refresh: "refresh-token" });
    expect(localStorage.getItem("separa.panel.refresh.v1")).toBeNull();
  });

  it("lets an owner of several businesses switch between them", async () => {
    const other = { name: "Consultorio Lucía", slug: "consultorio-lucia", status: "active" as const };
    const { calls } = signedInRoutes({
      "GET /auth/me/": {
        status: 200,
        body: { ...OWNER, memberships: [...OWNER.memberships, { business: other, role: "owner" }] },
      },
      "GET /panel/bookings/": EMPTY,
    });
    renderApp("/panel");
    const user = userEvent.setup();

    const selector = await screen.findByRole("combobox", { name: "Negocio" });
    await user.selectOptions(selector, "consultorio-lucia");

    await waitFor(() => expect(localStorage.getItem("separa.panel.business.v1")).toBe("consultorio-lucia"));
    await waitFor(() => expect(calls.length).toBeGreaterThan(3));
  });
});
