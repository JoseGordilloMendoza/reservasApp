import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PanelBookingDetail } from "../../lib/panelTypes";
import { panelDetail, renderApp, signedInRoutes, slotAt } from "../../test/helpers";

afterEach(() => {
  vi.unstubAllGlobals();
});

const PATH = "/panel/reservas/7";
// A booking that began an hour ago and is still running.
const started = { starts_at: new Date(Date.now() - 3_600_000).toISOString(), ends_at: new Date(Date.now() + 3_600_000).toISOString() };

function open(booking: PanelBookingDetail, extra: Parameters<typeof signedInRoutes>[0] = {}) {
  return signedInRoutes({ "GET /panel/bookings/7/": { status: 200, body: booking }, ...extra });
}

describe("a booking", () => {
  it("shows who booked, when, and what", async () => {
    open(panelDetail({ id: 7, customer: { id: 5, name: "Ana Pérez", phone: "+51987654321", email: "ana@example.com", is_blocked: false } }));
    renderApp(PATH);

    expect(await screen.findByRole("heading", { level: 1, name: "Ana Pérez" })).toBeInTheDocument();
    expect(screen.getByText("17:00")).toBeInTheDocument();
    expect(screen.getByText("Alquiler 1 hora")).toBeInTheDocument();
    expect(screen.getByText("Cancha 1")).toBeInTheDocument();
    expect(screen.getByText("S/ 60")).toBeInTheDocument();
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
    expect(screen.getByText("Reservada por el cliente")).toBeInTheDocument();
  });

  it("says when the business wrote it down itself", async () => {
    open(panelDetail({ id: 7, source: "business", status: "confirmed" }));
    renderApp(PATH);

    expect(await screen.findByText("Anotada por el negocio")).toBeInTheDocument();
  });

  it("lets the owner call or chat with the customer", async () => {
    open(panelDetail({ id: 7 }));
    renderApp(PATH);

    expect(await screen.findByRole("link", { name: /987 654 321/ })).toHaveAttribute("href", "tel:+51987654321");
    const chat = decodeURIComponent(screen.getByRole("link", { name: "WhatsApp" }).getAttribute("href") ?? "");
    expect(chat).toContain("Ana Pérez");
    expect(chat).toContain("Alquiler 1 hora");
  });

  it("tells the story of the booking", async () => {
    open(
      panelDetail({
        id: 7,
        status: "confirmed",
        events: [
          { from_status: "", to_status: "pending", actor: "customer", created_at: slotAt(0, 10).starts_at },
          { from_status: "pending", to_status: "confirmed", actor: "business", created_at: slotAt(0, 11).starts_at },
        ],
      }),
    );
    renderApp(PATH);

    expect(await screen.findByText(/Reservó/)).toBeInTheDocument();
    expect(screen.getByText(/Pasó a confirmada/)).toBeInTheDocument();
    expect(screen.getByText(/por el negocio/)).toBeInTheDocument();
  });

  it("says when the booking does not exist", async () => {
    signedInRoutes({ "GET /panel/bookings/7/": { status: 404, body: { detail: "No encontrado." } } });
    renderApp(PATH);

    expect(await screen.findByText("No encontramos esa reserva")).toBeInTheDocument();
  });
});

describe("what can be done with a booking", () => {
  it("confirms or rejects one that is pending", async () => {
    const { calls } = open(panelDetail({ id: 7, status: "pending" }), {
      "POST /panel/bookings/7/confirm/": { status: 200, body: panelDetail({ id: 7, status: "confirmed" }) },
    });
    renderApp(PATH);
    const user = userEvent.setup();

    expect(await screen.findByRole("button", { name: "Rechazar" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByRole("button", { name: "Cancelar reserva" })).toBeInTheDocument();
    expect(calls.filter((call) => call.method === "POST").map((call) => call.path)).toEqual([
      "/panel/bookings/7/confirm/",
    ]);
    expect(screen.queryByRole("button", { name: "Confirmar" })).not.toBeInTheDocument();
  });

  it("offers only to cancel a confirmed booking that has not started", async () => {
    open(panelDetail({ id: 7, status: "confirmed" }));
    renderApp(PATH);

    expect(await screen.findByRole("button", { name: "Cancelar reserva" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marcar como atendida" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "No asistió" })).not.toBeInTheDocument();
  });

  it("offers to close a confirmed booking once it has started", async () => {
    open(panelDetail({ id: 7, status: "confirmed", ...started }));
    renderApp(PATH);

    expect(await screen.findByRole("button", { name: "Marcar como atendida" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No asistió" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar reserva" })).toBeInTheDocument();
  });

  it("marks a booking as attended", async () => {
    const { calls } = open(panelDetail({ id: 7, status: "confirmed", ...started }), {
      "POST /panel/bookings/7/complete/": { status: 200, body: panelDetail({ id: 7, status: "completed" }) },
    });
    renderApp(PATH);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Marcar como atendida" }));

    expect(await screen.findAllByText("Atendida")).not.toHaveLength(0);
    expect(calls.some((call) => call.path === "/panel/bookings/7/complete/")).toBe(true);
    expect(screen.queryByRole("button", { name: "Cancelar reserva" })).not.toBeInTheDocument();
  });

  it("marks a no show", async () => {
    const { calls } = open(panelDetail({ id: 7, status: "confirmed", ...started }), {
      "POST /panel/bookings/7/no-show/": { status: 200, body: panelDetail({ id: 7, status: "no_show" }) },
    });
    renderApp(PATH);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "No asistió" }));

    expect(await screen.findAllByText("No asistió")).not.toHaveLength(0);
    expect(calls.some((call) => call.path === "/panel/bookings/7/no-show/")).toBe(true);
  });

  it("asks before cancelling", async () => {
    const { calls } = open(panelDetail({ id: 7, status: "confirmed" }), {
      "POST /panel/bookings/7/cancel/": { status: 200, body: panelDetail({ id: 7, status: "cancelled" }) },
    });
    renderApp(PATH);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Cancelar reserva" }));
    expect(calls.some((call) => call.method === "POST")).toBe(false);

    await user.click(screen.getByRole("button", { name: "Sí, cancelar" }));

    expect(await screen.findAllByText("Cancelada")).not.toHaveLength(0);
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(1);
  });

  it("offers nothing for a booking that is over", async () => {
    for (const status of ["cancelled", "expired", "completed", "no_show"] as const) {
      open(panelDetail({ id: 7, status, ...started }));
      const { unmount } = renderApp(PATH);

      await screen.findByRole("heading", { level: 1, name: "Ana Pérez" });
      expect(screen.queryByRole("button", { name: /Confirmar|Rechazar|Cancelar reserva|atendida/ })).not.toBeInTheDocument();
      unmount();
    }
  });

  it("shows the server's message when the action is refused", async () => {
    open(panelDetail({ id: 7, status: "confirmed", ...started }), {
      "POST /panel/bookings/7/complete/": {
        status: 409,
        body: { code: "not_started_yet", detail: "La reserva aún no ha comenzado." },
      },
    });
    renderApp(PATH);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Marcar como atendida" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("La reserva aún no ha comenzado.");
  });

  it("keeps a way back to the list", async () => {
    open(panelDetail({ id: 7 }));
    renderApp(PATH);

    expect(await screen.findByRole("link", { name: "Reservas" })).toHaveAttribute("href", "/panel/reservas");
  });
});

