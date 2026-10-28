import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { saveBooking } from "../lib/storage";
import { bookingDetails, mockApi, renderApp, slotAt } from "../test/helpers";

afterEach(() => {
  vi.unstubAllGlobals();
});

const saved = (token: string) => ({
  slug: "canchas-los-andes",
  token,
  businessName: "Canchas Los Andes",
  timeZone: "America/Lima",
});

describe("my bookings", () => {
  it("explains where tickets are kept when there are none", () => {
    mockApi({});
    renderApp("/mis-reservas");

    expect(screen.getByText("Aquí aparecerán tus boletos.")).toBeInTheDocument();
    expect(screen.getByText(/solo en este celular/)).toBeInTheDocument();
  });

  it("lists the saved tickets with their current state", async () => {
    saveBooking(saved("a"));
    saveBooking(saved("b"));
    mockApi({
      "GET /public/bookings/a/": { status: 200, body: bookingDetails({ status: "confirmed" }) },
      "GET /public/bookings/b/": { status: 200, body: bookingDetails({ status: "cancelled" }) },
    });
    renderApp("/mis-reservas");

    expect(await screen.findByText("Confirmada")).toBeInTheDocument();
    expect(screen.getByText("Cancelada")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Canchas Los Andes/ })).toHaveLength(2);
  });

  it("puts the upcoming bookings first, soonest on top", async () => {
    saveBooking(saved("later"));
    saveBooking(saved("soon"));
    saveBooking(saved("done"));
    const soon = slotAt(1, 17);
    const later = slotAt(3, 17);
    mockApi({
      "GET /public/bookings/later/": {
        status: 200,
        body: bookingDetails({ status: "confirmed", starts_at: later.starts_at, ends_at: later.ends_at }),
      },
      "GET /public/bookings/soon/": {
        status: 200,
        body: bookingDetails({ status: "pending", starts_at: soon.starts_at, ends_at: soon.ends_at }),
      },
      "GET /public/bookings/done/": {
        status: 200,
        body: bookingDetails({ status: "cancelled", starts_at: slotAt(0, 17).starts_at, ends_at: slotAt(0, 18).starts_at }),
      },
    });
    renderApp("/mis-reservas");

    await screen.findByText("Pendiente");
    const hrefs = screen.getAllByRole("link", { name: /Canchas Los Andes/ }).map((link) => link.getAttribute("href"));

    expect(hrefs).toEqual([
      "/canchas-los-andes/reserva/soon",
      "/canchas-los-andes/reserva/later",
      "/canchas-los-andes/reserva/done",
    ]);
  });

  it("links each ticket to its page", async () => {
    saveBooking(saved("a"));
    mockApi({ "GET /public/bookings/a/": { status: 200, body: bookingDetails() } });
    renderApp("/mis-reservas");

    expect(await screen.findByRole("link", { name: /Canchas Los Andes/ })).toHaveAttribute(
      "href",
      "/canchas-los-andes/reserva/a",
    );
  });

  it("lets the customer remove a ticket from this device", async () => {
    saveBooking(saved("a"));
    mockApi({ "GET /public/bookings/a/": { status: 200, body: bookingDetails() } });
    renderApp("/mis-reservas");
    const user = userEvent.setup();

    await screen.findByText("Pendiente");
    await user.click(screen.getByRole("button", { name: /Quitar de este celular/ }));

    expect(screen.getByText("Aquí aparecerán tus boletos.")).toBeInTheDocument();
    expect(localStorage.getItem("separa.bookings.v1")).not.toContain('"a"');
  });

  it("says when a saved booking no longer exists", async () => {
    saveBooking(saved("gone"));
    mockApi({ "GET /public/bookings/gone/": { status: 404, body: { detail: "No encontrado." } } });
    renderApp("/mis-reservas");

    const entry = await screen.findByText("Esta reserva ya no existe.");

    expect(within(entry.closest("li")!).getByRole("button", { name: /Quitar/ })).toBeInTheDocument();
  });
});
