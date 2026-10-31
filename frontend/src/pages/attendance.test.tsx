import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BookingDetails } from "../lib/types";
import { PANEL_BUSINESS, BUSINESS, bookingDetails, mockApi, page, panelBooking, panelDetail, renderApp, signedInRoutes } from "../test/helpers";

afterEach(() => {
  vi.unstubAllGlobals();
});

const PATH = "/canchas-los-andes/reserva/tok-123";
const GET = "GET /public/bookings/tok-123/";
const POST = "POST /public/bookings/tok-123/attendance/";

function ticket(booking: BookingDetails, extra: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    [GET]: { status: 200, body: booking },
    "GET /public/businesses/canchas-los-andes/": { status: 200, body: BUSINESS },
    ...extra,
  });
}

describe("saying I am coming, from the ticket", () => {
  it("offers it in the day before a confirmed booking", async () => {
    ticket(bookingDetails({ status: "confirmed", can_confirm_attendance: true }));
    renderApp(PATH);

    expect(await screen.findByRole("button", { name: "Confirmo que voy" })).toBeInTheDocument();
  });

  it("does not offer it earlier, or for a booking that is not confirmed", async () => {
    ticket(bookingDetails({ status: "confirmed", can_confirm_attendance: false }));
    renderApp(PATH);

    await screen.findByRole("heading", { level: 1, name: "Reserva lista" });
    expect(screen.queryByRole("button", { name: "Confirmo que voy" })).not.toBeInTheDocument();
  });

  it("tells the business with one tap and says so on the ticket", async () => {
    const before = bookingDetails({ status: "confirmed", can_confirm_attendance: true });
    const after = { ...before, attendance_confirmed: true };
    // The server remembers: once it was told, it answers with the confirmed ticket.
    let told = false;
    const api = ticket(before, {
      [GET]: () => ({ status: 200, body: told ? after : before }),
      [POST]: () => {
        told = true;
        return { status: 200, body: after };
      },
    });
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByRole("button", { name: "Confirmo que voy" }));

    expect(await screen.findByText(/Avisaste que vas/)).toBeInTheDocument();
    expect(api.calls.some((call) => call.method === "POST" && call.path === "/public/bookings/tok-123/attendance/")).toBe(true);
    expect(screen.queryByRole("button", { name: "Confirmo que voy" })).not.toBeInTheDocument();
  });

  it("shows that it was already said when the ticket is opened again", async () => {
    ticket(bookingDetails({ status: "confirmed", can_confirm_attendance: true, attendance_confirmed: true }));
    renderApp(PATH);

    expect(await screen.findByText(/Avisaste que vas/)).toBeInTheDocument();
  });

  it("says what went wrong when the server refuses", async () => {
    ticket(bookingDetails({ status: "confirmed", can_confirm_attendance: true }), {
      [POST]: { status: 409, body: { code: "invalid_transition", detail: "Esta reserva ya empezó." } },
    });
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByRole("button", { name: "Confirmo que voy" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Esta reserva ya empezó.");
  });
});

describe("what the owner sees", () => {
  const LATER = { starts_at: new Date(Date.now() + 5 * 24 * 3_600_000).toISOString(), ends_at: new Date(Date.now() + 5 * 24 * 3_600_000 + 3_600_000).toISOString() };
  const SOON = { starts_at: new Date(Date.now() + 5 * 3_600_000).toISOString(), ends_at: new Date(Date.now() + 6 * 3_600_000).toISOString() };

  it("on the booking: that the customer said they are coming, or that they have not", async () => {
    signedInRoutes({
      "GET /panel/bookings/7/": { status: 200, body: panelDetail({ id: 7, status: "confirmed", ...SOON, customer_confirmed_at: new Date().toISOString() }) },
      "GET /panel/bookings/8/": { status: 200, body: panelDetail({ id: 8, status: "confirmed", ...SOON }) },
    });
    const { unmount } = renderApp("/panel/reservas/7");

    expect(await screen.findByText(/Avisó que va/)).toBeInTheDocument();
    unmount();

    renderApp("/panel/reservas/8");

    expect(await screen.findByText("Todavía no avisa que va")).toBeInTheDocument();
  });

  it("in the list: who confirmed and who did not, only for bookings in the coming day", async () => {
    signedInRoutes({
      "GET /panel/bookings/": {
        status: 200,
        body: page([
          panelBooking({ id: 1, status: "confirmed", ...SOON, customer: { id: 1, name: "Ana Pérez", phone: "+51987654321", email: "", is_blocked: false }, customer_confirmed_at: new Date().toISOString() }),
          panelBooking({ id: 2, status: "confirmed", ...SOON, customer: { id: 2, name: "Luis Ramos", phone: "+51987000111", email: "", is_blocked: false } }),
          panelBooking({ id: 3, status: "confirmed", ...LATER, customer: { id: 3, name: "Rosa Díaz", phone: "+51987000222", email: "", is_blocked: false } }),
        ]),
      },
    });
    renderApp("/panel/reservas");

    const row = async (name: RegExp) => (await screen.findByRole("link", { name })).closest("li")!;

    expect(await row(/Ana Pérez/)).toHaveTextContent("Confirmó que va");
    expect(await row(/Luis Ramos/)).toHaveTextContent("Sin confirmar");
    expect(await row(/Rosa Díaz/)).not.toHaveTextContent(/Sin confirmar|Confirmó que va/);
  });
});

describe("quick WhatsApp messages on a booking", () => {
  const detail = (overrides = {}) => panelDetail({ id: 7, status: "confirmed", ...overrides });

  it("opens the chat with the reminder already written", async () => {
    signedInRoutes({ "GET /panel/bookings/7/": { status: 200, body: detail() } });
    renderApp("/panel/reservas/7");

    const reminder = await screen.findByRole("link", { name: /Recordar y pedir que confirme/ });

    expect(reminder.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/51987654321\?text=/);
    expect(decodeURIComponent(reminder.getAttribute("href") ?? "")).toContain("Hola Ana, te recordamos tu reserva de Alquiler 1 hora");
    expect(reminder).toHaveAttribute("target", "_blank");
  });

  it("offers how to pay once the owner has written it, with those very words", async () => {
    signedInRoutes({
      "GET /panel/business/": { status: 200, body: { ...PANEL_BUSINESS, payment_instructions: "Yape al 987 654 321 a nombre de Rosa" } },
      "GET /panel/bookings/7/": { status: 200, body: detail() },
    });
    renderApp("/panel/reservas/7");

    const pay = await screen.findByRole("link", { name: "Enviar cómo pagar" });

    expect(decodeURIComponent(pay.getAttribute("href") ?? "")).toContain("pagar así: Yape al 987 654 321 a nombre de Rosa");
  });

  it("is not there for a booking that is over", async () => {
    signedInRoutes({ "GET /panel/bookings/7/": { status: 200, body: detail({ status: "cancelled" }) } });
    renderApp("/panel/reservas/7");

    await screen.findByRole("heading", { level: 1, name: "Ana Pérez" });
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Escribirle por WhatsApp" })).not.toBeInTheDocument());
  });
});
