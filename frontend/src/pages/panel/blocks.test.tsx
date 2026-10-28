import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CreatedBlock, PanelBlock, PanelResource } from "../../lib/panelTypes";
import { page, renderApp, signedInRoutes } from "../../test/helpers";

afterEach(() => {
  vi.unstubAllGlobals();
});

const PATH = "/panel/bloqueos";

const RESOURCES: PanelResource[] = [
  { id: 1, name: "Cancha 1", is_active: true, position: 0 },
  { id: 2, name: "Cancha 2", is_active: true, position: 1 },
  { id: 3, name: "Cancha vieja", is_active: false, position: 2 },
];

// 14:00 to 16:00 in Lima, a long time from now.
const block = (overrides: Partial<PanelBlock> = {}): PanelBlock => ({
  id: 9,
  resource: { id: 1, name: "Cancha 1" },
  starts_at: "2030-01-07T19:00:00Z",
  ends_at: "2030-01-07T21:00:00Z",
  reason: "Mantenimiento",
  ...overrides,
});

function open(blocks: PanelBlock[], extra: Parameters<typeof signedInRoutes>[0] = {}) {
  return signedInRoutes({
    "GET /panel/blocks/": { status: 200, body: page(blocks) },
    "GET /panel/resources/": { status: 200, body: page(RESOURCES) },
    ...extra,
  });
}

describe("the blocks", () => {
  it("lists the upcoming ones with their reason, hours and place", async () => {
    open([block(), block({ id: 10, resource: null, reason: "" })]);
    renderApp(PATH);

    expect(await screen.findByText("Mantenimiento")).toBeInTheDocument();
    expect(screen.getAllByText(/14:00 a 16:00/)).toHaveLength(2);
    expect(screen.getByText("Cancha 1")).toBeInTheDocument();
    // A block with no reason and no resource still says what it is.
    expect(screen.getByText("Cerrado")).toBeInTheDocument();
    expect(screen.getByText("Todo el negocio")).toBeInTheDocument();
  });

  it("explains when there are none", async () => {
    open([]);
    renderApp(PATH);

    expect(await screen.findByText("No tienes bloqueos próximos.")).toBeInTheDocument();
  });

  it("offers to try again when the list fails", async () => {
    signedInRoutes({ "GET /panel/blocks/": { status: 500, body: { detail: "Falla del servidor" } } });
    renderApp(PATH);

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar los bloqueos");
  });
});

describe("closing a period", () => {
  it("closes a resource for whole days", async () => {
    const created: CreatedBlock = { ...block({ id: 11 }), conflicting_bookings: [] };
    const api = open([], { "POST /panel/blocks/": { status: 201, body: created } });
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByRole("button", { name: "Nuevo bloqueo" }));
    await user.selectOptions(screen.getByLabelText("¿Qué cierras?"), "Cancha 1");
    await user.click(screen.getByLabelText("Todo el día"));
    for (const label of ["Desde el día", "Hasta el día"]) {
      const date = screen.getByLabelText(label);
      await user.clear(date);
      await user.type(date, "2030-01-07");
    }
    await user.type(screen.getByLabelText("Motivo (opcional)"), "Feriado");
    await user.click(screen.getByRole("button", { name: "Bloquear" }));

    await waitFor(() => {
      expect(api.calls.find((call) => call.method === "POST")?.body).toEqual({
        resource: 1,
        starts_at: "2030-01-07T05:00:00.000Z",
        ends_at: "2030-01-08T05:00:00.000Z",
        reason: "Feriado",
      });
    });
    // The form closes once it is done.
    expect(await screen.findByRole("button", { name: "Nuevo bloqueo" })).toBeInTheDocument();
  });

  it("only offers the resources that are in use", async () => {
    open([]);
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByRole("button", { name: "Nuevo bloqueo" }));
    await screen.findByRole("option", { name: "Cancha 2" });

    expect(screen.getByRole("option", { name: "Todo el negocio" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Cancha vieja" })).not.toBeInTheDocument();
  });

  it("refuses an end that is not after the start, without calling the server", async () => {
    const api = open([]);
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByRole("button", { name: "Nuevo bloqueo" }));
    for (const [label, value] of [
      ["Desde el día", "2030-01-07"],
      ["Hora de inicio", "16:00"],
      ["Hasta el día", "2030-01-07"],
      ["Hora de fin", "14:00"],
    ] as const) {
      const input = screen.getByLabelText(label);
      await user.clear(input);
      await user.type(input, value);
    }
    await user.click(screen.getByRole("button", { name: "Bloquear" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("El cierre debe terminar después de empezar.");
    expect(api.calls.some((call) => call.method === "POST")).toBe(false);
  });

  it("warns about the bookings that were already there, and does not cancel them", async () => {
    const created: CreatedBlock = {
      ...block({ id: 11 }),
      conflicting_bookings: [
        {
          id: 70,
          status: "confirmed",
          starts_at: "2030-01-07T19:00:00Z",
          ends_at: "2030-01-07T20:00:00Z",
          resource: { id: 1, name: "Cancha 1" },
          customer_name: "Ana Pérez",
        },
      ],
    };
    const api = open([], { "POST /panel/blocks/": { status: 201, body: created } });
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByRole("button", { name: "Nuevo bloqueo" }));
    await user.click(screen.getByRole("button", { name: "Bloquear" }));

    const warning = await screen.findByRole("status", { name: "Reservas en conflicto" });
    expect(warning).toHaveTextContent("Ya había 1 reserva en ese horario");
    expect(screen.getByRole("link", { name: /Ana Pérez/ })).toHaveAttribute("href", "/panel/reservas/70");
    expect(api.calls.some((call) => call.path.includes("/cancel/"))).toBe(false);
  });

  it("shows the server's message when it refuses", async () => {
    open([], { "POST /panel/blocks/": { status: 400, body: { code: "invalid", detail: "Ese recurso no existe." } } });
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByRole("button", { name: "Nuevo bloqueo" }));
    await user.click(screen.getByRole("button", { name: "Bloquear" }));

    expect(await screen.findByText("Ese recurso no existe.")).toBeInTheDocument();
  });
});

describe("removing a block", () => {
  it("asks first, then removes it", async () => {
    const api = open([block()], { "DELETE /panel/blocks/9/": { status: 204, body: null } });
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByRole("button", { name: "Quitar bloqueo" }));
    expect(api.calls.some((call) => call.method === "DELETE")).toBe(false);

    await user.click(screen.getByRole("button", { name: "Sí, quitar" }));

    await waitFor(() => {
      expect(api.calls.some((call) => call.method === "DELETE" && call.path === "/panel/blocks/9/")).toBe(true);
    });
  });
});
