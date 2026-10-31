import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CreatedBusiness } from "../../lib/platformTypes";
import { renderApp, signedInRoutes } from "../../test/helpers";
import { TEAM, row } from "../../test/platform";

afterEach(() => {
  vi.unstubAllGlobals();
});

const PATH = "/plataforma/negocios/nuevo";

const created = (overrides: Partial<CreatedBusiness> = {}): CreatedBusiness => ({
  ...row({ slug: "canchas-el-sol", name: "Canchas El Sol" }),
  subscription: null,
  suspended_reason: "",
  timezone: "America/Lima",
  accent: "poppy",
  description: "",
  address: "",
  phone: "",
  whatsapp: "",
  owner: { email: "rosa@example.com", account_created: true, temporary_password: null },
  ...overrides,
});

function open(extra: Parameters<typeof signedInRoutes>[0] = {}) {
  const api = signedInRoutes({ "GET /auth/me/": { status: 200, body: TEAM }, ...extra });
  renderApp(PATH);
  return api;
}

async function fillMinimum(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText("Nombre del negocio"), "Canchas El Sol");
  await user.type(screen.getByLabelText("Correo del dueño"), "rosa@example.com");
  await user.type(screen.getByLabelText("Precio al mes (S/)"), "80");
}

const post = (api: ReturnType<typeof open>) => api.calls.find((call) => call.method === "POST" && call.path === "/platform/businesses/");

describe("opening a business", () => {
  it("starts with a court, a 30 day trial and nothing else filled in", async () => {
    open();

    expect(await screen.findByLabelText("Tipo")).toHaveValue("court");
    expect(screen.getByLabelText("Días de prueba")).toHaveValue("30");
    expect(screen.getByRole("radio", { name: /Prueba de unos días/ })).toBeChecked();
  });

  it("sends the minimum and shows the owner what happens next", async () => {
    const api = open({ "POST /platform/businesses/": { status: 201, body: created() } });
    const user = userEvent.setup();
    await fillMinimum(user);

    await user.click(screen.getByRole("button", { name: "Abrir negocio" }));

    expect(await screen.findByRole("heading", { name: "Negocio abierto" })).toBeInTheDocument();
    expect(post(api)?.body).toEqual({
      name: "Canchas El Sol",
      business_type: "court",
      delivery: "email",
      owner: { email: "rosa@example.com" },
      subscription: { price: "80.00", trial_days: 30 },
    });
    expect(screen.getByRole("status")).toHaveTextContent("Le enviamos un correo a rosa@example.com para que elija su contraseña");
  });

  it("sends an end date instead of trial days when that is chosen", async () => {
    const api = open({ "POST /platform/businesses/": { status: 201, body: created() } });
    const user = userEvent.setup();
    await fillMinimum(user);

    await user.click(screen.getByRole("radio", { name: /Hasta un día en concreto/ }));
    expect(screen.queryByLabelText("Días de prueba")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Vale hasta el"), "2030-06-30");
    await user.click(screen.getByRole("button", { name: "Abrir negocio" }));

    await screen.findByRole("heading", { name: "Negocio abierto" });
    expect(post(api)?.body).toMatchObject({ subscription: { price: "80.00", valid_until: "2030-06-30" } });
  });

  it("sends everything that was filled in", async () => {
    const api = open({ "POST /platform/businesses/": { status: 201, body: created() } });
    const user = userEvent.setup();
    await fillMinimum(user);

    await user.selectOptions(screen.getByLabelText("Tipo"), "psychologist");
    await user.type(screen.getByLabelText(/Link/), "el-sol");
    await user.type(screen.getByLabelText("Plan (opcional)"), "Mensual");
    await user.type(screen.getByLabelText("Nombre del dueño"), "Rosa");
    await user.type(screen.getByLabelText("Apellido del dueño"), "Quispe");
    await user.click(screen.getByRole("button", { name: "Abrir negocio" }));

    await screen.findByRole("heading", { name: "Negocio abierto" });
    expect(post(api)?.body).toEqual({
      name: "Canchas El Sol",
      slug: "el-sol",
      business_type: "psychologist",
      delivery: "email",
      owner: { email: "rosa@example.com", first_name: "Rosa", last_name: "Quispe" },
      subscription: { plan_name: "Mensual", price: "80.00", trial_days: 30 },
    });
  });

  it("points at what is wrong without calling the server", async () => {
    const api = open();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Abrir negocio" }));

    expect(await screen.findByText("Escribe el nombre del negocio.")).toBeInTheDocument();
    expect(screen.getByText("Escribe el correo del dueño.")).toBeInTheDocument();
    expect(screen.getByText("Escribe el precio mensual acordado.")).toBeInTheDocument();
    expect(post(api)).toBeUndefined();
    expect(screen.getByLabelText("Nombre del negocio")).toHaveFocus();
  });

  it("puts the server's complaint under its field, such as a taken link", async () => {
    open({ "POST /platform/businesses/": { status: 400, body: { slug: "Ese link ya está en uso." } } });
    const user = userEvent.setup();
    await fillMinimum(user);
    await user.type(screen.getByLabelText(/Link/), "cancha-los-andes");

    await user.click(screen.getByRole("button", { name: "Abrir negocio" }));

    expect(await screen.findByText("Ese link ya está en uso.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Negocio abierto" })).not.toBeInTheDocument();
  });

  it("puts a complaint about the subscription under its field", async () => {
    open({
      "POST /platform/businesses/": { status: 400, body: { subscription: { valid_until: ["La vigencia no puede estar en el pasado."] } } },
    });
    const user = userEvent.setup();
    await fillMinimum(user);

    await user.click(screen.getByRole("button", { name: "Abrir negocio" }));

    expect(await screen.findByText("La vigencia no puede estar en el pasado.")).toBeInTheDocument();
  });

  it("says when the owner already had an account, which stays as it was", async () => {
    open({ "POST /platform/businesses/": { status: 201, body: created({ owner: { email: "rosa@example.com", account_created: false, temporary_password: null } }) } });
    const user = userEvent.setup();
    await fillMinimum(user);

    await user.click(screen.getByRole("button", { name: "Abrir negocio" }));

    expect(await screen.findByRole("status")).toHaveTextContent("ya tenía cuenta");
  });

  it("offers the public link and the way to the new business, or to open another", async () => {
    open({ "POST /platform/businesses/": { status: 201, body: created() } });
    const user = userEvent.setup();
    await fillMinimum(user);

    await user.click(screen.getByRole("button", { name: "Abrir negocio" }));

    const link = (await screen.findByLabelText("Enlace del negocio")) as HTMLTextAreaElement;
    expect(link.value).toBe(`${window.location.origin}/canchas-el-sol`);
    expect(screen.getByRole("link", { name: "Ver el negocio" })).toHaveAttribute("href", "/plataforma/negocios/canchas-el-sol");

    await user.click(screen.getByRole("button", { name: "Abrir otro" }));
    await waitFor(() => expect(screen.getByLabelText("Nombre del negocio")).toHaveValue(""));
  });

  it("shows a general failure when the server is down", async () => {
    open({ "POST /platform/businesses/": { status: 500, body: { detail: "Falla del servidor" } } });
    const user = userEvent.setup();
    await fillMinimum(user);

    await user.click(screen.getByRole("button", { name: "Abrir negocio" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Falla del servidor");
  });
});

describe("handing over access without an email", () => {
  it("offers both ways, starting with the email", async () => {
    open();

    expect(await screen.findByRole("radio", { name: /Por correo/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Con contraseña temporal/ })).not.toBeChecked();
  });

  it("asks for a temporary password and shows it once the business is open", async () => {
    const api = open({
      "POST /platform/businesses/": {
        status: 201,
        body: created({ owner: { email: "rosa@example.com", account_created: true, temporary_password: "k7mq-4xpd-9tzw" } }),
      },
    });
    const user = userEvent.setup();
    await fillMinimum(user);
    await user.click(screen.getByRole("radio", { name: /Con contraseña temporal/ }));

    await user.click(screen.getByRole("button", { name: "Abrir negocio" }));

    expect(await screen.findByText("k7mq-4xpd-9tzw")).toBeInTheDocument();
    expect(post(api)?.body).toMatchObject({ delivery: "credentials" });
    expect(screen.getByText(/No enviamos ningún correo/)).toBeInTheDocument();
    expect(screen.queryByText(/Le enviamos un correo/)).not.toBeInTheDocument();
  });

  it("says an existing account keeps its own password, and that no email went out", async () => {
    open({
      "POST /platform/businesses/": {
        status: 201,
        body: created({ owner: { email: "rosa@example.com", account_created: false, temporary_password: null } }),
      },
    });
    const user = userEvent.setup();
    await fillMinimum(user);
    await user.click(screen.getByRole("radio", { name: /Con contraseña temporal/ }));

    await user.click(screen.getByRole("button", { name: "Abrir negocio" }));

    expect(await screen.findByText(/entra con su contraseña de siempre/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Mensaje para enviar")).not.toBeInTheDocument();
  });
});
