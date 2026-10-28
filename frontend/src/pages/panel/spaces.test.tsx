import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PanelResource } from "../../lib/panelTypes";
import { page, renderApp, signedInRoutes } from "../../test/helpers";

afterEach(() => {
  vi.unstubAllGlobals();
});

const SPACES: PanelResource[] = [
  { id: 1, name: "Cancha 1", is_active: true, position: 0 },
  { id: 2, name: "Cancha vieja", is_active: false, position: 1 },
];

function open(extra: Parameters<typeof signedInRoutes>[0] = {}, spaces = SPACES) {
  return signedInRoutes({ "GET /panel/resources/": { status: 200, body: page(spaces) }, ...extra });
}

/** The row of one space, so its buttons are not confused with another's. */
const row = async (name: string) => within((await screen.findByText(name)).closest("li")!);

describe("the spaces", () => {
  it("lists them, saying which ones are inactive, with a link to each schedule", async () => {
    open();
    renderApp("/panel/ajustes/espacios");

    const first = await row("Cancha 1");
    expect(first.getByRole("link", { name: "Horario" })).toHaveAttribute("href", "/panel/ajustes/espacios/1/horario");
    expect(first.queryByText("Inactivo")).not.toBeInTheDocument();
    expect((await row("Cancha vieja")).getByText("Inactivo")).toBeInTheDocument();
  });

  it("invites to add the first one", async () => {
    open({}, []);
    renderApp("/panel/ajustes/espacios");

    expect(await screen.findByText(/Todavía no tienes espacios/)).toBeInTheDocument();
  });

  it("adds a space", async () => {
    const api = open({ "POST /panel/resources/": { status: 201, body: { id: 3, name: "Cancha 2", is_active: true, position: 2 } } });
    const user = userEvent.setup();
    renderApp("/panel/ajustes/espacios");

    await user.click(await screen.findByRole("button", { name: "Nuevo espacio" }));
    await user.type(screen.getByLabelText("Nombre"), "  Cancha 2 ");
    await user.click(screen.getByRole("button", { name: "Agregar" }));

    await waitFor(() => {
      expect(api.calls.find((call) => call.method === "POST")?.body).toEqual({ name: "Cancha 2" });
    });
    // The form closes once the space is added.
    expect(await screen.findByRole("button", { name: "Nuevo espacio" })).toBeInTheDocument();
  });

  it("says why a name was refused", async () => {
    open({ "POST /panel/resources/": { status: 400, body: { name: ["Ya tienes un recurso con ese nombre."] } } });
    const user = userEvent.setup();
    renderApp("/panel/ajustes/espacios");

    await user.click(await screen.findByRole("button", { name: "Nuevo espacio" }));
    await user.type(screen.getByLabelText("Nombre"), "Cancha 1");
    await user.click(screen.getByRole("button", { name: "Agregar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ya tienes un recurso con ese nombre.");
  });

  it("renames a space", async () => {
    const api = open({ "PATCH /panel/resources/1/": { status: 200, body: { ...SPACES[0], name: "Cancha Norte" } } });
    const user = userEvent.setup();
    renderApp("/panel/ajustes/espacios");

    const first = await row("Cancha 1");
    await user.click(first.getByRole("button", { name: "Cambiar nombre" }));
    const name = first.getByLabelText("Nombre");
    await user.clear(name);
    await user.type(name, "Cancha Norte");
    await user.click(first.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(api.calls.find((call) => call.method === "PATCH")?.body).toEqual({ name: "Cancha Norte" });
    });
  });

  it("deactivates only after asking, and activates in one tap", async () => {
    const api = open({
      "PATCH /panel/resources/1/": { status: 200, body: { ...SPACES[0], is_active: false } },
      "PATCH /panel/resources/2/": { status: 200, body: { ...SPACES[1], is_active: true } },
    });
    const user = userEvent.setup();
    renderApp("/panel/ajustes/espacios");

    const first = await row("Cancha 1");
    await user.click(first.getByRole("button", { name: "Desactivar" }));
    expect(api.calls.some((call) => call.method === "PATCH")).toBe(false);
    await user.click(first.getByRole("button", { name: "Sí, desactivar" }));
    await waitFor(() => {
      expect(api.calls.find((call) => call.path === "/panel/resources/1/")?.body).toEqual({ is_active: false });
    });

    await user.click((await row("Cancha vieja")).getByRole("button", { name: "Activar" }));
    await waitFor(() => {
      expect(api.calls.find((call) => call.path === "/panel/resources/2/")?.body).toEqual({ is_active: true });
    });
  });

  it("deletes only after asking", async () => {
    const api = open({ "DELETE /panel/resources/2/": { status: 204, body: null } });
    const user = userEvent.setup();
    renderApp("/panel/ajustes/espacios");

    const old = await row("Cancha vieja");
    await user.click(old.getByRole("button", { name: "Eliminar" }));
    expect(api.calls.some((call) => call.method === "DELETE")).toBe(false);
    await user.click(old.getByRole("button", { name: "Sí, eliminar" }));

    await waitFor(() => {
      expect(api.calls.some((call) => call.method === "DELETE" && call.path === "/panel/resources/2/")).toBe(true);
    });
  });

  it("explains that a space with bookings is deactivated instead of deleted", async () => {
    open({ "DELETE /panel/resources/1/": { status: 409, body: { code: "has_bookings", detail: "Tiene reservas." } } });
    const user = userEvent.setup();
    renderApp("/panel/ajustes/espacios");

    const first = await row("Cancha 1");
    await user.click(first.getByRole("button", { name: "Eliminar" }));
    await user.click(first.getByRole("button", { name: "Sí, eliminar" }));

    expect(await first.findByRole("alert")).toHaveTextContent("tiene reservas");
    expect(first.getByRole("alert")).toHaveTextContent("Desactívalo");
  });
});

describe("the weekly schedule", () => {
  const PATH = "/panel/ajustes/espacios/1/horario";
  const open_ = (rules: object[], extra: Parameters<typeof signedInRoutes>[0] = {}) =>
    open({ "GET /panel/resources/1/schedule/": { status: 200, body: { rules } }, ...extra });
  const mondayToFriday = [0, 1, 2, 3, 4].map((weekday) => ({ weekday, start_time: "08:00:00", end_time: "22:00:00" }));

  it("shows the saved hours and marks the other days closed", async () => {
    open_(mondayToFriday);
    renderApp(PATH);

    expect(await screen.findByLabelText("Lunes, abre")).toHaveValue("08:00");
    expect(screen.getByLabelText("Viernes, cierra")).toHaveValue("22:00");
    expect(screen.queryByLabelText("Sábado, abre")).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Sábado" })).getByText("Cerrado")).toBeInTheDocument();
    expect(screen.getByText("Cancha 1")).toBeInTheDocument();
  });

  it("opens a closed day with the usual hours and saves the whole week", async () => {
    const api = open_(mondayToFriday, { "PUT /panel/resources/1/schedule/": { status: 200, body: { rules: [] } } });
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(within(await screen.findByRole("region", { name: "Sábado" })).getByRole("button", { name: "Abrir este día" }));
    await user.click(screen.getByRole("button", { name: "Guardar horario" }));

    await waitFor(() => {
      const body = api.calls.find((call) => call.method === "PUT")?.body as { rules: unknown[] };
      expect(body.rules).toHaveLength(6);
      expect(body.rules).toContainEqual({ weekday: 5, start_time: "08:00", end_time: "22:00" });
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Horario guardado");
  });

  it("copies a day to all the others", async () => {
    const api = open_(mondayToFriday, { "PUT /panel/resources/1/schedule/": { status: 200, body: { rules: [] } } });
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(within(await screen.findByRole("region", { name: "Lunes" })).getByRole("button", { name: "Copiar a todos los días" }));
    await user.click(screen.getByRole("button", { name: "Guardar horario" }));

    await waitFor(() => {
      expect((api.calls.find((call) => call.method === "PUT")?.body as { rules: unknown[] }).rules).toHaveLength(7);
    });
  });

  it("closes a day by removing its last window", async () => {
    const api = open_(mondayToFriday, { "PUT /panel/resources/1/schedule/": { status: 200, body: { rules: [] } } });
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByRole("button", { name: "Quitar horario del lunes" }));
    await user.click(screen.getByRole("button", { name: "Guardar horario" }));

    await waitFor(() => {
      const rules = (api.calls.find((call) => call.method === "PUT")?.body as { rules: { weekday: number }[] }).rules;
      expect(rules.map((rule) => rule.weekday)).toEqual([1, 2, 3, 4]);
    });
  });

  it("refuses overlapping hours without calling the server", async () => {
    const api = open_(mondayToFriday);
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(within(await screen.findByRole("region", { name: "Lunes" })).getByRole("button", { name: "Otro horario" }));
    const monday = within(screen.getByRole("region", { name: "Lunes" }));
    // The first window runs to 22:00; make the second one start inside it.
    const [, secondStart] = monday.getAllByLabelText(/abre/);
    await user.clear(secondStart!);
    await user.type(secondStart!, "21:00");
    await user.click(screen.getByRole("button", { name: "Guardar horario" }));

    expect(await monday.findByRole("alert")).toHaveTextContent("Los horarios del lunes se solapan.");
    expect(api.calls.some((call) => call.method === "PUT")).toBe(false);
  });

  it("says when the space does not exist", async () => {
    signedInRoutes({
      "GET /panel/resources/": { status: 200, body: page(SPACES) },
      "GET /panel/resources/99/schedule/": { status: 404, body: { detail: "No encontrado." } },
    });
    renderApp("/panel/ajustes/espacios/99/horario");

    expect(await screen.findByText("No encontramos ese espacio")).toBeInTheDocument();
  });

  it("offers to try again when the schedule fails to load", async () => {
    open({ "GET /panel/resources/1/schedule/": { status: 500, body: { detail: "Falla del servidor" } } });
    renderApp(PATH);

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar el horario");
  });
});
