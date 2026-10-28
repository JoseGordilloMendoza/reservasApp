import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PanelResource, PanelService } from "../../lib/panelTypes";
import { PANEL_BUSINESS, page, renderApp, signedInRoutes } from "../../test/helpers";

afterEach(() => {
  vi.unstubAllGlobals();
});

const PATH = "/panel/ajustes/servicios";

const SPACES: PanelResource[] = [
  { id: 1, name: "Cancha 1", is_active: true, position: 0 },
  { id: 2, name: "Cancha 2", is_active: true, position: 1 },
  { id: 3, name: "Cancha vieja", is_active: false, position: 2 },
];

const service = (overrides: Partial<PanelService> = {}): PanelService => ({
  id: 11,
  resource: { id: 1, name: "Cancha 1" },
  name: "Alquiler 1 hora",
  duration_minutes: 60,
  reference_price: "60.00",
  is_active: true,
  ...overrides,
});

function open(services: PanelService[], extra: Parameters<typeof signedInRoutes>[0] = {}, spaces = SPACES) {
  return signedInRoutes({
    "GET /panel/services/": { status: 200, body: page(services) },
    "GET /panel/resources/": { status: 200, body: page(spaces) },
    ...extra,
  });
}

const row = async (name: string) => within((await screen.findByText(name)).closest("li")!);

describe("the services", () => {
  it("lists them with space, duration and price", async () => {
    open([service(), service({ id: 12, name: "Media hora", duration_minutes: 30, reference_price: null })]);
    renderApp(PATH);

    expect(await screen.findByText("Cancha 1 · 60 min · S/ 60")).toBeInTheDocument();
    expect(screen.getByText("Cancha 1 · 30 min")).toBeInTheDocument();
  });

  it("marks the inactive ones with a word", async () => {
    open([service({ is_active: false })]);
    renderApp(PATH);

    expect(await screen.findByText("Inactivo")).toBeInTheDocument();
  });

  it("invites to add the first one", async () => {
    open([]);
    renderApp(PATH);

    expect(await screen.findByText(/Todavía no tienes servicios/)).toBeInTheDocument();
  });
});

describe("adding a service", () => {
  it("starts from the duration the business type suggests", async () => {
    open([], {}, SPACES);
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByRole("button", { name: "Nuevo servicio" }));

    expect(screen.getByLabelText("Duración (minutos)")).toHaveValue(String(PANEL_BUSINESS.suggested_service_duration_minutes));
  });

  it("creates it in the chosen space", async () => {
    const api = open([], { "POST /panel/services/": { status: 201, body: service({ id: 20 }) } });
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByRole("button", { name: "Nuevo servicio" }));
    await screen.findByRole("option", { name: "Cancha 2" });
    await user.selectOptions(screen.getByLabelText("Espacio"), "Cancha 2");
    await user.type(screen.getByLabelText("Nombre"), "Alquiler 2 horas");
    const duration = screen.getByLabelText("Duración (minutos)");
    await user.clear(duration);
    await user.type(duration, "120");
    await user.type(screen.getByLabelText("Precio (S/)"), "110,50");
    await user.click(screen.getByRole("button", { name: "Agregar" }));

    await waitFor(() => {
      expect(api.calls.find((call) => call.method === "POST")?.body).toEqual({
        resource_id: 2,
        name: "Alquiler 2 horas",
        duration_minutes: 120,
        reference_price: "110.50",
      });
    });
    expect(await screen.findByRole("button", { name: "Nuevo servicio" })).toBeInTheDocument();
  });

  it("does not offer inactive spaces", async () => {
    open([]);
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByRole("button", { name: "Nuevo servicio" }));
    await screen.findByRole("option", { name: "Cancha 2" });

    expect(screen.queryByRole("option", { name: "Cancha vieja" })).not.toBeInTheDocument();
  });

  it("picks the only space by itself", async () => {
    open([], {}, [SPACES[0]!]);
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByRole("button", { name: "Nuevo servicio" }));

    // Whether the spaces arrived before or after the form opened, the only one is chosen.
    await waitFor(() => expect(screen.getByLabelText("Espacio")).toHaveValue("1"));
  });

  it("points at every field that is wrong, without calling the server", async () => {
    const api = open([]);
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByRole("button", { name: "Nuevo servicio" }));
    const duration = screen.getByLabelText("Duración (minutos)");
    await user.clear(duration);
    await user.type(duration, "2");
    await user.type(screen.getByLabelText("Precio (S/)"), "mucho");
    await user.click(screen.getByRole("button", { name: "Agregar" }));

    expect(await screen.findByText("Elige el espacio.")).toBeInTheDocument();
    expect(screen.getByText("Escribe el nombre del servicio.")).toBeInTheDocument();
    expect(screen.getByText(/entre 5 y 1440/)).toBeInTheDocument();
    expect(screen.getByText(/precio en soles/)).toBeInTheDocument();
    expect(api.calls.some((call) => call.method === "POST")).toBe(false);
  });

  it("puts the server's complaint under its field", async () => {
    open([], { "POST /panel/services/": { status: 400, body: { name: ["Ya existe un servicio con ese nombre."] } } });
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByRole("button", { name: "Nuevo servicio" }));
    await screen.findByRole("option", { name: "Cancha 2" });
    await user.selectOptions(screen.getByLabelText("Espacio"), "Cancha 1");
    await user.type(screen.getByLabelText("Nombre"), "Alquiler 1 hora");
    await user.click(screen.getByRole("button", { name: "Agregar" }));

    expect(await screen.findByText("Ya existe un servicio con ese nombre.")).toBeInTheDocument();
  });
});

describe("changing a service", () => {
  it("edits name, duration and price, but not the space", async () => {
    const api = open([service()], { "PATCH /panel/services/11/": { status: 200, body: service({ name: "Alquiler largo", duration_minutes: 90 }) } });
    const user = userEvent.setup();
    renderApp(PATH);

    const item = await row("Alquiler 1 hora");
    await user.click(item.getByRole("button", { name: "Editar" }));
    expect(item.queryByLabelText("Espacio")).not.toBeInTheDocument();
    expect(item.getByLabelText("Precio (S/)")).toHaveValue("60");

    const name = item.getByLabelText("Nombre");
    await user.clear(name);
    await user.type(name, "Alquiler largo");
    const duration = item.getByLabelText("Duración (minutos)");
    await user.clear(duration);
    await user.type(duration, "90");
    await user.click(item.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(api.calls.find((call) => call.method === "PATCH")?.body).toEqual({
        name: "Alquiler largo",
        duration_minutes: 90,
        reference_price: "60.00",
      });
    });
  });

  it("deactivates only after asking, and activates in one tap", async () => {
    const api = open([service(), service({ id: 12, name: "Media hora", is_active: false })], {
      "PATCH /panel/services/11/": { status: 200, body: service({ is_active: false }) },
      "PATCH /panel/services/12/": { status: 200, body: service({ id: 12, is_active: true }) },
    });
    const user = userEvent.setup();
    renderApp(PATH);

    const first = await row("Alquiler 1 hora");
    await user.click(first.getByRole("button", { name: "Desactivar" }));
    expect(api.calls.some((call) => call.method === "PATCH")).toBe(false);
    await user.click(first.getByRole("button", { name: "Sí, desactivar" }));
    await waitFor(() => {
      expect(api.calls.find((call) => call.path === "/panel/services/11/")?.body).toEqual({ is_active: false });
    });

    await user.click((await row("Media hora")).getByRole("button", { name: "Activar" }));
    await waitFor(() => {
      expect(api.calls.find((call) => call.path === "/panel/services/12/")?.body).toEqual({ is_active: true });
    });
  });

  it("deletes only after asking", async () => {
    const api = open([service()], { "DELETE /panel/services/11/": { status: 204, body: null } });
    const user = userEvent.setup();
    renderApp(PATH);

    const item = await row("Alquiler 1 hora");
    await user.click(item.getByRole("button", { name: "Eliminar" }));
    expect(api.calls.some((call) => call.method === "DELETE")).toBe(false);
    await user.click(item.getByRole("button", { name: "Sí, eliminar" }));

    await waitFor(() => {
      expect(api.calls.some((call) => call.method === "DELETE" && call.path === "/panel/services/11/")).toBe(true);
    });
  });

  it("explains that a service with bookings is deactivated instead of deleted", async () => {
    open([service()], { "DELETE /panel/services/11/": { status: 409, body: { code: "has_bookings", detail: "Tiene reservas." } } });
    const user = userEvent.setup();
    renderApp(PATH);

    const item = await row("Alquiler 1 hora");
    await user.click(item.getByRole("button", { name: "Eliminar" }));
    await user.click(item.getByRole("button", { name: "Sí, eliminar" }));

    expect(await item.findByRole("alert")).toHaveTextContent("Desactívalo");
  });
});
