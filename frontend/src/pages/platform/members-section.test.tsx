import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Member } from "../../lib/platformTypes";
import { renderApp, signedInRoutes } from "../../test/helpers";
import { TEAM, businessPage } from "../../test/platform";

afterEach(() => {
  vi.unstubAllGlobals();
});

const BASE = "/platform/businesses/canchas-los-andes";
const PATH = "/plataforma/negocios/canchas-los-andes?seccion=personas";

const member = (overrides: Partial<Member> = {}): Member => ({
  id: 1,
  email: "ana@example.com",
  name: "Ana Pérez",
  role: "owner",
  is_active: true,
  last_login: "2030-03-20T15:00:00Z",
  has_password: true,
  uses_google: false,
  created_at: "2030-01-01T00:00:00Z",
  ...overrides,
});

function open(members: Member[] = [member()], extra: Parameters<typeof signedInRoutes>[0] = {}) {
  const api = signedInRoutes({
    "GET /auth/me/": { status: 200, body: TEAM },
    [`GET ${BASE}/`]: { status: 200, body: businessPage() },
    [`GET ${BASE}/users/`]: { status: 200, body: members },
    ...extra,
  });
  renderApp(PATH);
  return api;
}

const called = (api: ReturnType<typeof open>, method: string, path: string) =>
  api.calls.find((call) => call.method === method && call.path === path);

/** The card of one person, so their buttons are not confused with another's. */
const card = async (text: string) => within((await screen.findByText(text)).closest("li")!);

describe("the people of a business", () => {
  it("lists them with their role and how they get in", async () => {
    open([
      member(),
      member({ id: 2, email: "luis@example.com", name: "", role: "staff", has_password: false, last_login: null }),
      member({ id: 3, email: "rosa@example.com", name: "Rosa", role: "staff", uses_google: true, has_password: false, last_login: null }),
    ]);

    const ana = await card("Ana Pérez");
    expect(ana.getByText("Dueño")).toBeInTheDocument();
    expect(ana.getByText(/Último ingreso/)).toBeInTheDocument();
    expect(ana.getByText("ana@example.com")).toBeInTheDocument();

    const luis = await card("luis@example.com");
    expect(luis.getByText("Personal")).toBeInTheDocument();
    expect(luis.getByText("Sin contraseña: aún no la elige")).toBeInTheDocument();

    expect((await card("Rosa")).getByText(/Usa Google/)).toBeInTheDocument();
  });

  it("says when nobody administers the business", async () => {
    open([]);

    expect(await screen.findByText("Este negocio no tiene a nadie que lo administre.")).toBeInTheDocument();
  });

  it("says when the people could not be loaded", async () => {
    open([], { [`GET ${BASE}/users/`]: { status: 500, body: { detail: "Falla del servidor" } } });

    expect(await screen.findByText(/No pudimos cargar a las personas/)).toBeInTheDocument();
  });
});

describe("adding someone", () => {
  it("checks the email before calling the server", async () => {
    const api = open();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Agregar a alguien" }));
    await user.click(screen.getByRole("button", { name: "Agregar" }));
    expect(await screen.findByText("Escribe el correo.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Correo"), "luis@");
    await user.click(screen.getByRole("button", { name: "Agregar" }));
    expect(await screen.findByText("Revisa el correo: parece incompleto.")).toBeInTheDocument();
    expect(called(api, "POST", `${BASE}/users/`)).toBeUndefined();
  });

  it("adds a staff member by default and closes the form", async () => {
    const api = open([member()], { [`POST ${BASE}/users/`]: { status: 201, body: { ...member({ id: 2 }), account_created: true } } });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Agregar a alguien" }));
    await user.type(screen.getByLabelText("Correo"), " luis@example.com ");
    await user.type(screen.getByLabelText("Nombre (opcional)"), "Luis");
    await user.click(screen.getByRole("button", { name: "Agregar" }));

    await waitFor(() =>
      expect(called(api, "POST", `${BASE}/users/`)?.body).toEqual({ email: "luis@example.com", role: "staff", delivery: "email", first_name: "Luis" }),
    );
    expect(await screen.findByRole("button", { name: "Agregar a alguien" })).toBeInTheDocument();
  });

  it("can add an owner", async () => {
    const api = open([member()], { [`POST ${BASE}/users/`]: { status: 201, body: { ...member({ id: 2 }), account_created: false } } });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Agregar a alguien" }));
    await user.type(screen.getByLabelText("Correo"), "luis@example.com");
    await user.selectOptions(screen.getByLabelText("Rol"), "owner");
    await user.click(screen.getByRole("button", { name: "Agregar" }));

    await waitFor(() => expect(called(api, "POST", `${BASE}/users/`)?.body).toMatchObject({ role: "owner" }));
  });

  it("shows why it was refused, such as someone already there", async () => {
    open([member()], { [`POST ${BASE}/users/`]: { status: 409, body: { code: "already_member", detail: "Esa persona ya trabaja en este negocio." } } });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Agregar a alguien" }));
    await user.type(screen.getByLabelText("Correo"), "ana@example.com");
    await user.click(screen.getByRole("button", { name: "Agregar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Esa persona ya trabaja en este negocio.");
  });

  it("can be cancelled", async () => {
    open();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Agregar a alguien" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.getByRole("button", { name: "Agregar a alguien" })).toBeInTheDocument();
  });
});

describe("changing a role", () => {
  it("offers the other role and applies it", async () => {
    const api = open([member(), member({ id: 2, email: "luis@example.com", name: "Luis", role: "staff" })], {
      [`PATCH ${BASE}/users/2/`]: { status: 200, body: member({ id: 2, role: "owner" }) },
    });
    const user = userEvent.setup();

    const luis = await card("Luis");
    await user.click(luis.getByRole("button", { name: "Pasar a dueño" }));

    await waitFor(() => expect(called(api, "PATCH", `${BASE}/users/2/`)?.body).toEqual({ role: "owner" }));
  });

  it("offers to demote an owner", async () => {
    open();

    expect((await card("Ana Pérez")).getByRole("button", { name: "Pasar a personal" })).toBeInTheDocument();
  });

  it("explains why the only owner cannot be demoted", async () => {
    open([member()], { [`PATCH ${BASE}/users/1/`]: { status: 409, body: { code: "last_owner", detail: "Es el único dueño: nombra a otro dueño antes de cambiarle el rol." } } });
    const user = userEvent.setup();

    const ana = await card("Ana Pérez");
    await user.click(ana.getByRole("button", { name: "Pasar a personal" }));

    expect(await ana.findByRole("alert")).toHaveTextContent("Es el único dueño");
  });
});

describe("removing someone", () => {
  it("asks first, and says their account stays", async () => {
    const api = open([member(), member({ id: 2, email: "luis@example.com", name: "Luis", role: "staff" })], {
      [`DELETE ${BASE}/users/2/`]: { status: 204, body: null },
    });
    const user = userEvent.setup();

    const luis = await card("Luis");
    await user.click(luis.getByRole("button", { name: "Quitar del negocio" }));
    expect(luis.getByText(/Su cuenta y sus otros negocios no se tocan/)).toBeInTheDocument();
    expect(called(api, "DELETE", `${BASE}/users/2/`)).toBeUndefined();

    await user.click(luis.getByRole("button", { name: "Sí, quitar" }));

    await waitFor(() => expect(called(api, "DELETE", `${BASE}/users/2/`)).toBeDefined());
  });

  it("explains why the only owner cannot be removed", async () => {
    open([member()], { [`DELETE ${BASE}/users/1/`]: { status: 409, body: { code: "last_owner", detail: "Es el único dueño: nombra a otro dueño antes de quitarlo." } } });
    const user = userEvent.setup();

    const ana = await card("Ana Pérez");
    await user.click(ana.getByRole("button", { name: "Quitar del negocio" }));
    await user.click(ana.getByRole("button", { name: "Sí, quitar" }));

    expect(await ana.findByRole("alert")).toHaveTextContent("Es el único dueño");
  });
});

describe("sending access again", () => {
  it("sends it and says to whom", async () => {
    const api = open([member()], { [`POST ${BASE}/users/1/send-link/`]: { status: 200, body: { detail: "Enviamos el correo a ana@example.com." } } });
    const user = userEvent.setup();

    const ana = await card("Ana Pérez");
    await user.click(ana.getByRole("button", { name: "Reenviar acceso" }));

    expect(await ana.findByRole("status")).toHaveTextContent("Enviamos el correo a ana@example.com.");
    expect(called(api, "POST", `${BASE}/users/1/send-link/`)).toBeDefined();
  });
});
