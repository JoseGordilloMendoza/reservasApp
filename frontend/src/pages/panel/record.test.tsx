import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PanelBookingDetail } from "../../lib/panelTypes";
import { page, panelBooking, panelDetail, renderApp, signedInRoutes } from "../../test/helpers";

afterEach(() => {
  vi.unstubAllGlobals();
});

const PATH = "/panel/reservas/7";

/** A booking that answers its PATCH with whatever the test says the server would return. */
function open(booking: PanelBookingDetail, afterPatch?: Partial<PanelBookingDetail>) {
  return signedInRoutes({
    "GET /panel/bookings/7/": { status: 200, body: booking },
    "PATCH /panel/bookings/7/": { status: 200, body: { ...booking, ...afterPatch } },
    "GET /panel/bookings/": { status: 200, body: page([]) },
  });
}

const patches = (api: ReturnType<typeof open>) => api.calls.filter((call) => call.method === "PATCH");

describe("the code of a booking", () => {
  it("is shown the way it is read aloud", async () => {
    open(panelDetail({ id: 7, code: "K7M42X" }));
    renderApp(PATH);

    expect(await screen.findByText("K7M-42X")).toBeInTheDocument();
  });
});

describe("arrival", () => {
  it("marks that the customer arrived", async () => {
    const api = open(panelDetail({ id: 7, status: "confirmed" }), { arrived_at: "2030-01-08T00:05:00Z" });
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByRole("button", { name: "Llegó" }));

    await waitFor(() => expect(patches(api)).toHaveLength(1));
    expect(patches(api)[0]!.body).toEqual({ arrived: true });
    expect(await screen.findByText(/Llegó a las/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deshacer llegada" })).toBeInTheDocument();
  });

  it("does not offer it for a cancelled booking", async () => {
    open(panelDetail({ id: 7, status: "cancelled" }));
    renderApp(PATH);

    await screen.findByText("Aún no llega");
    expect(screen.queryByRole("button", { name: "Llegó" })).not.toBeInTheDocument();
  });
});

describe("payment", () => {
  it("says where it stands", async () => {
    open(panelDetail({ id: 7, payment_status: "deposit", amount_paid: "20.00", balance: "40.00", payment_method: "yape" }));
    renderApp(PATH);

    expect(await screen.findByText("Adelanto S/ 20 por Yape · Falta S/ 40")).toBeInTheDocument();
  });

  it("registers that the customer paid everything, and how", async () => {
    const api = open(panelDetail({ id: 7 }), { payment_status: "paid", amount_paid: "60.00", balance: "0.00", payment_method: "plin" });
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByRole("radio", { name: "Plin" }));
    await user.click(screen.getByRole("button", { name: "Pagó todo" }));

    await waitFor(() => expect(patches(api)).toHaveLength(1));
    expect(patches(api)[0]!.body).toEqual({ payment_status: "paid", payment_method: "plin" });
    expect(await screen.findByText("Pagada S/ 60 por Plin")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pagó todo" })).not.toBeInTheDocument();
  });

  it("registers a deposit with its amount", async () => {
    const api = open(panelDetail({ id: 7 }), { payment_status: "deposit", amount_paid: "20.00", balance: "40.00" });
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByRole("button", { name: "Dejó un adelanto" }));
    expect(screen.getByRole("button", { name: "Guardar adelanto" })).toBeDisabled();
    await user.type(screen.getByLabelText("Monto del adelanto (S/)"), "20");
    await user.click(screen.getByRole("button", { name: "Guardar adelanto" }));

    await waitFor(() => expect(patches(api)).toHaveLength(1));
    expect(patches(api)[0]!.body).toEqual({ payment_status: "deposit", amount_paid: "20", payment_method: "" });
    expect(await screen.findByText("Adelanto S/ 20 · Falta S/ 40")).toBeInTheDocument();
  });

  it("can take the payment back", async () => {
    const api = open(panelDetail({ id: 7, payment_status: "paid", amount_paid: "60.00", balance: "0.00" }), {
      payment_status: "unpaid",
      amount_paid: "0.00",
      balance: "60.00",
    });
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByRole("button", { name: "Quitar el pago" }));

    await waitFor(() => expect(patches(api)).toHaveLength(1));
    expect(patches(api)[0]!.body).toEqual({ payment_status: "unpaid" });
  });

  it("shows what the server refused", async () => {
    signedInRoutes({
      "GET /panel/bookings/7/": { status: 200, body: panelDetail({ id: 7 }) },
      "PATCH /panel/bookings/7/": { status: 400, body: { amount_paid: ["Indica cuánto adelantó."] } },
      "GET /panel/bookings/": { status: 200, body: page([]) },
    });
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByRole("button", { name: "Dejó un adelanto" }));
    await user.type(screen.getByLabelText("Monto del adelanto (S/)"), "0");
    await user.click(screen.getByRole("button", { name: "Guardar adelanto" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Indica cuánto adelantó.");
  });
});

describe("the private note", () => {
  it("is saved only when it changed", async () => {
    const api = open(panelDetail({ id: 7, internal_note: "" }), { internal_note: "Me paga el viernes" });
    const user = userEvent.setup();
    renderApp(PATH);

    const save = await screen.findByRole("button", { name: "Guardar nota" });
    expect(save).toBeDisabled();

    await user.type(screen.getByLabelText("Nota privada"), "Me paga el viernes");
    await user.click(save);

    await waitFor(() => expect(patches(api)).toHaveLength(1));
    expect(patches(api)[0]!.body).toEqual({ internal_note: "Me paga el viernes" });
  });
});

describe("checking a customer who walks in", () => {
  const ANA = panelBooking({ id: 7, status: "confirmed", code: "K7M42X" });

  function home(found: ReturnType<typeof panelBooking>[]) {
    return signedInRoutes({
      "GET /panel/bookings/": (_init, query) => ({ status: 200, body: page(query.get("q") ? found : []) }),
      "PATCH /panel/bookings/7/": { status: 200, body: { ...ANA, arrived_at: "2030-01-08T00:05:00Z" } },
    });
  }

  it("finds the booking by its code and marks the arrival in one tap", async () => {
    const api = home([ANA]);
    const user = userEvent.setup();
    renderApp("/panel");

    await user.type(await screen.findByLabelText("Código o nombre de quien llegó"), "k7m-42x");

    const section = await screen.findByRole("region", { name: "Verificar una reserva" });
    expect(await within(section).findByRole("link", { name: "Ana Pérez" })).toBeInTheDocument();
    expect(within(section).getByText("K7M-42X")).toBeInTheDocument();
    expect(within(section).getByText("Sin pagar · Falta S/ 60")).toBeInTheDocument();
    expect(api.calls.some((call) => call.path === "/panel/bookings/" && call.method === "GET")).toBe(true);

    await user.click(within(section).getByRole("button", { name: "Llegó" }));

    await waitFor(() => expect(patches(api)).toHaveLength(1));
    expect(patches(api)[0]!.body).toEqual({ arrived: true });
  });

  it("says so when nothing matches", async () => {
    home([]);
    const user = userEvent.setup();
    renderApp("/panel");

    await user.type(await screen.findByLabelText("Código o nombre de quien llegó"), "k7m-42x");

    expect(await screen.findByText(/No encontramos esa reserva/)).toBeInTheDocument();
  });
});
