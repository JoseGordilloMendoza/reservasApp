import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi, renderApp } from "../../test/helpers";

afterEach(() => {
  vi.unstubAllGlobals();
});

const ASKED = { status: 200, body: { detail: "Si el correo está registrado, te enviamos un enlace." } };

describe("asking for a password link", () => {
  it("is offered from the login page", async () => {
    mockApi({});
    const user = userEvent.setup();
    renderApp("/panel/entrar");

    await user.click(screen.getByRole("link", { name: "¿Olvidaste tu contraseña?" }));

    expect(await screen.findByRole("heading", { name: "Recupera tu contraseña" })).toBeInTheDocument();
  });

  it("sends the address and tells the person to check their email", async () => {
    const api = mockApi({ "POST /auth/password-reset/": ASKED });
    const user = userEvent.setup();
    renderApp("/panel/recuperar");

    await user.type(screen.getByLabelText("Correo"), "  rosa@example.com ");
    await user.click(screen.getByRole("button", { name: "Enviar enlace" }));

    expect(await screen.findByRole("heading", { name: "Revisa tu correo" })).toBeInTheDocument();
    expect(api.calls.find((call) => call.path === "/auth/password-reset/")?.body).toEqual({ email: "rosa@example.com" });
    expect(screen.getByRole("status")).toHaveTextContent("rosa@example.com");
    expect(screen.getByRole("status")).toHaveTextContent("Si ");
  });

  it("does not claim the account exists", async () => {
    mockApi({ "POST /auth/password-reset/": ASKED });
    const user = userEvent.setup();
    renderApp("/panel/recuperar");

    await user.type(screen.getByLabelText("Correo"), "nadie@example.com");
    await user.click(screen.getByRole("button", { name: "Enviar enlace" }));

    // The same wording for any address: "if it has an account", never "we sent it".
    expect(await screen.findByText(/tiene una cuenta, te enviamos/)).toBeInTheDocument();
  });

  it("asks for the address before calling the server", async () => {
    const api = mockApi({});
    const user = userEvent.setup();
    renderApp("/panel/recuperar");

    await user.click(screen.getByRole("button", { name: "Enviar enlace" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Escribe tu correo.");
    expect(api.calls).toHaveLength(0);
  });

  it("says so when there were too many attempts", async () => {
    mockApi({ "POST /auth/password-reset/": { status: 429, body: {} } });
    const user = userEvent.setup();
    renderApp("/panel/recuperar");

    await user.type(screen.getByLabelText("Correo"), "rosa@example.com");
    await user.click(screen.getByRole("button", { name: "Enviar enlace" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("muchos intentos");
    expect(screen.queryByRole("heading", { name: "Revisa tu correo" })).not.toBeInTheDocument();
  });

  it("can go back to signing in", async () => {
    mockApi({});
    renderApp("/panel/recuperar");

    expect(screen.getByRole("link", { name: "Volver a entrar" })).toHaveAttribute("href", "/panel/entrar");
  });
});

describe("choosing a new password", () => {
  const LINK = "/panel/nueva-contrasena?uid=MQ&token=abc-123";
  const OK = { status: 200, body: { detail: "Listo." } };

  async function fill(password: string, confirm: string) {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Contraseña nueva"), password);
    await user.type(screen.getByLabelText("Repite la contraseña"), confirm);
    await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));
  }

  it("sends the link's parts with the new password", async () => {
    const api = mockApi({ "POST /auth/password-reset/confirm/": OK });
    renderApp(LINK);

    await fill("clave-segura-1", "clave-segura-1");

    await waitFor(() => {
      expect(api.calls.find((call) => call.path === "/auth/password-reset/confirm/")?.body).toEqual({
        uid: "MQ",
        token: "abc-123",
        password: "clave-segura-1",
      });
    });
  });

  it("confirms and leads to signing in", async () => {
    mockApi({ "POST /auth/password-reset/confirm/": OK });
    renderApp(LINK);

    await fill("clave-segura-1", "clave-segura-1");

    expect(await screen.findByText(/cambiaste tu contraseña/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/panel/entrar");
  });

  it("checks the password and its repetition without calling the server", async () => {
    const api = mockApi({});
    renderApp(LINK);

    await fill("clave-segura-1", "clave-segura-2");

    expect(await screen.findByText("Las contraseñas no coinciden.")).toBeInTheDocument();
    expect(api.calls).toHaveLength(0);
  });

  it("refuses a short password", async () => {
    const api = mockApi({});
    renderApp(LINK);

    await fill("corta", "corta");

    expect(await screen.findByText("Usa al menos 8 caracteres.")).toBeInTheDocument();
    expect(api.calls).toHaveLength(0);
  });

  it("shows what the server says about a weak password and keeps the form", async () => {
    mockApi({
      "POST /auth/password-reset/confirm/": { status: 400, body: { password: ["Esta contraseña es muy común."] } },
    });
    renderApp(LINK);

    await fill("password123", "password123");

    expect(await screen.findByText("Esta contraseña es muy común.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar contraseña" })).toBeInTheDocument();
  });

  it("offers a new link when this one is expired or used", async () => {
    mockApi({
      "POST /auth/password-reset/confirm/": {
        status: 400,
        body: { code: "invalid_reset_link", detail: "El enlace no es válido o ya venció. Pide uno nuevo." },
      },
    });
    renderApp(LINK);

    await fill("clave-segura-1", "clave-segura-1");

    expect(await screen.findByRole("alert")).toHaveTextContent("ya venció");
    expect(screen.getByRole("link", { name: "Pedir otro enlace" })).toHaveAttribute("href", "/panel/recuperar");
  });

  it("does not show a form for a link that came incomplete", async () => {
    const api = mockApi({});
    renderApp("/panel/nueva-contrasena?uid=MQ");

    expect(await screen.findByRole("alert")).toHaveTextContent("incompleto");
    expect(screen.queryByLabelText("Contraseña nueva")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pedir otro enlace" })).toBeInTheDocument();
    expect(api.calls).toHaveLength(0);
  });
});
