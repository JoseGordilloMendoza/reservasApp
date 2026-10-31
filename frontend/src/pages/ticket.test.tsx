import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BUSINESS, bookingDetails, mockApi, renderApp } from "../test/helpers";
import type { BookingDetails } from "../lib/types";

afterEach(() => {
  vi.unstubAllGlobals();
});

const PATH = "/canchas-los-andes/reserva/tok-123";

function api(booking: BookingDetails, extra: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    "GET /public/bookings/tok-123/": { status: 200, body: booking },
    "GET /public/businesses/canchas-los-andes/": { status: 200, body: BUSINESS },
    ...extra,
  });
}

describe("the ticket", () => {
  it("shows what was booked", async () => {
    api(bookingDetails());
    renderApp(PATH);

    const ticket = await screen.findByLabelText("Boleto de Canchas Los Andes");
    expect(ticket).toHaveTextContent("Alquiler 1 hora");
    expect(ticket).toHaveTextContent("17:00");
    expect(ticket).toHaveTextContent("18:00");
    expect(ticket).toHaveTextContent("Cancha 1");
    expect(ticket).toHaveTextContent("Rosa Quispe");
    expect(ticket).toHaveTextContent("S/ 60");
    expect(ticket).toHaveTextContent("Pendiente");
  });

  it("shows the code the business will ask for, as it is read aloud", async () => {
    api(bookingDetails({ code: "K7M42X" }));
    renderApp(PATH);

    const ticket = await screen.findByLabelText("Boleto de Canchas Los Andes");

    expect(ticket).toHaveTextContent("K7M-42X");
    expect(ticket).toHaveTextContent("muestra este código o di tu nombre");
    expect(ticket).toHaveTextContent("No reemplaza un comprobante de pago");
  });

  it("says how to pay while something is owed, and stops once it is paid", async () => {
    api(bookingDetails({ payment_instructions: "Yape al 987 654 321 a nombre de Rosa" }));
    renderApp(PATH);

    const ticket = await screen.findByLabelText("Boleto de Canchas Los Andes");
    expect(ticket).toHaveTextContent("Cómo pagar");
    expect(ticket).toHaveTextContent("Yape al 987 654 321 a nombre de Rosa");
  });

  it("tells the customer when the business registered their payment", async () => {
    api(bookingDetails({ payment_status: "paid", payment_instructions: "Yape al 987 654 321" }));
    renderApp(PATH);

    const ticket = await screen.findByLabelText("Boleto de Canchas Los Andes");

    expect(ticket).toHaveTextContent("El negocio registró tu pago.");
    expect(ticket).not.toHaveTextContent("Cómo pagar");
  });

  it("does not print the secret token on the ticket", async () => {
    api(bookingDetails());
    renderApp(PATH);

    const ticket = await screen.findByLabelText("Boleto de Canchas Los Andes");

    expect(ticket).not.toHaveTextContent("tok-123");
  });

  it("explains each state in its own words", async () => {
    const cases: [BookingDetails["status"], string, string][] = [
      ["pending", "Casi lista", "El negocio tiene que confirmarla"],
      ["confirmed", "Reserva lista", "Todo en orden"],
      ["cancelled", "Reserva cancelada", "El horario ya quedó libre"],
      ["expired", "Esta reserva venció", "Nadie la confirmó a tiempo"],
    ];

    for (const [status, headline, note] of cases) {
      api(bookingDetails({ status, can_cancel: false }));
      const { unmount } = renderApp(PATH);

      expect(await screen.findByRole("heading", { level: 1, name: headline })).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent(note);
      unmount();
    }
  });

  it("says until when a pending booking is held", async () => {
    api(bookingDetails({ expires_at: "2030-01-08T03:00:00Z" })); // 22:00 in Lima
    renderApp(PATH);

    expect(await screen.findByRole("status")).toHaveTextContent("antes de las 22:00");
  });

  it("opens a WhatsApp chat with the booking already written", async () => {
    api(bookingDetails());
    renderApp(PATH);

    const link = await screen.findByRole("link", { name: /Avisar por WhatsApp/ });
    const href = decodeURIComponent(link.getAttribute("href") ?? "");

    expect(href).toContain("https://wa.me/51987654321");
    expect(href).toContain("Rosa Quispe");
    expect(href).toContain("Alquiler 1 hora");
    expect(href).toContain("17:00");
  });

  it("says when the booking does not exist", async () => {
    mockApi({
      "GET /public/bookings/tok-123/": { status: 404, body: { detail: "No encontrado." } },
      "GET /public/businesses/canchas-los-andes/": { status: 200, body: BUSINESS },
    });
    renderApp(PATH);

    expect(await screen.findByText("No encontramos esta reserva")).toBeInTheDocument();
  });

  it("remembers the ticket on this device when its link is opened", async () => {
    api(bookingDetails());
    renderApp(PATH);

    await screen.findByLabelText("Boleto de Canchas Los Andes");

    await waitFor(() => expect(localStorage.getItem("separa.bookings.v1")).toContain("tok-123"));
  });
});

describe("cancelling", () => {
  it("asks before cancelling, and can be backed out of", async () => {
    const { calls } = api(bookingDetails());
    renderApp(PATH);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Cancelar reserva" }));
    expect(screen.getByText("¿Cancelar esta reserva?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mantenerla" }));

    expect(screen.queryByText("¿Cancelar esta reserva?")).not.toBeInTheDocument();
    expect(calls.some((call) => call.method === "POST")).toBe(false);
  });

  it("cancels and shows the new state", async () => {
    // Like the real server: once cancelled, every later read says so too.
    let current = bookingDetails();
    const { calls } = mockApi({
      "GET /public/bookings/tok-123/": () => ({ status: 200, body: current }),
      "GET /public/businesses/canchas-los-andes/": { status: 200, body: BUSINESS },
      "POST /public/bookings/tok-123/cancel/": () => {
        current = bookingDetails({ status: "cancelled", can_cancel: false });
        return { status: 200, body: current };
      },
    });
    renderApp(PATH);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Cancelar reserva" }));
    await user.click(screen.getByRole("button", { name: "Sí, cancelar" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Reserva cancelada" })).toBeInTheDocument();
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Reservar de nuevo" })).toHaveAttribute("href", "/canchas-los-andes");
    expect(screen.queryByRole("button", { name: "Cancelar reserva" })).not.toBeInTheDocument();
  });

  it("shows the server's message when it is too late", async () => {
    api(bookingDetails({ status: "confirmed" }), {
      "POST /public/bookings/tok-123/cancel/": {
        status: 403,
        body: { code: "cancellation_window_closed", detail: "Ya no es posible cancelar en línea. Contacta directamente al negocio." },
      },
    });
    renderApp(PATH);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Cancelar reserva" }));
    await user.click(screen.getByRole("button", { name: "Sí, cancelar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ya no es posible cancelar en línea");
  });

  it("does not offer to cancel a confirmed booking past the deadline", async () => {
    api(bookingDetails({ status: "confirmed", can_cancel: false }));
    renderApp(PATH);

    expect(await screen.findByText(/Ya pasó el plazo para cancelar por aquí/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar reserva" })).not.toBeInTheDocument();
  });
});
