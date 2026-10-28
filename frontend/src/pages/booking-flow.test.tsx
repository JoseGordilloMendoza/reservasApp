import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BUSINESS, SINGLE_BUSINESS, TZ, bookingDetails, mockApi, renderApp, slotAt } from "../test/helpers";
import { upcomingDays } from "../lib/dates";

afterEach(() => {
  vi.unstubAllGlobals();
});

const PATH = "/canchas-los-andes";
const AVAILABILITY = `GET /public/businesses/canchas-los-andes/availability/`;

function api(extra: Parameters<typeof mockApi>[0] = {}, business = BUSINESS) {
  return mockApi({
    "GET /public/businesses/canchas-los-andes/": { status: 200, body: business },
    [AVAILABILITY]: {
      status: 200,
      body: { timezone: TZ, slots: [slotAt(1, 17), slotAt(1, 18), slotAt(2, 19)] },
    },
    ...extra,
  });
}

async function fillCustomer(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText("Tu nombre"), "Rosa Quispe");
  await user.type(screen.getByLabelText("Tu celular"), "987 111 222");
  await user.click(screen.getByLabelText(/Acepto que/));
}

describe("the business page", () => {
  it("shows the business, its contact details and the booking steps", async () => {
    api();
    renderApp(PATH);

    expect(await screen.findByRole("heading", { level: 1, name: "Canchas Los Andes" })).toBeInTheDocument();
    expect(screen.getByText("Av. Ejército 123, Cayma")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /987 654 321/ })).toHaveAttribute("href", "tel:+51987654321");
    expect(screen.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute(
      "href",
      expect.stringContaining("https://wa.me/51987654321"),
    );
    expect(screen.getByText("¿Qué reservas?")).toBeInTheDocument();
    expect(screen.getByText("¿Cuándo?")).toBeInTheDocument();
  });

  it("paints the page with the business accent", async () => {
    api();
    renderApp(PATH);

    await screen.findByRole("heading", { level: 1 });
    expect(document.documentElement.dataset.accent).toBe("lime");
  });

  it("says so when the business does not exist", async () => {
    mockApi({ "GET /public/businesses/canchas-los-andes/": { status: 404, body: { detail: "No encontrado." } } });
    renderApp(PATH);

    expect(await screen.findByText("No encontramos ese negocio")).toBeInTheDocument();
  });

  it("skips the first step when there is only one thing to book", async () => {
    api({}, SINGLE_BUSINESS);
    renderApp(PATH);

    await screen.findByText("¿Cuándo?");
    expect(screen.queryByText("¿Qué reservas?")).not.toBeInTheDocument();
  });
});

describe("choosing when", () => {
  it("has the nearest free slot already chosen and tagged", async () => {
    api();
    renderApp(PATH);

    const nearest = await screen.findByRole("radio", { name: "17:00, el más cercano" });
    expect(nearest).toBeChecked();
    expect(screen.getByRole("radio", { name: "18:00" })).not.toBeChecked();
  });

  it("shows only the free days as pressable", async () => {
    api();
    renderApp(PATH);

    await screen.findByRole("radio", { name: "17:00, el más cercano" });
    const days = within(screen.getByRole("radiogroup", { name: "Día" })).getAllByRole("radio");

    expect(days).toHaveLength(14);
    expect(days.filter((day) => !(day as HTMLButtonElement).disabled)).toHaveLength(2);
  });

  it("lets the customer pick another slot", async () => {
    api();
    renderApp(PATH);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("radio", { name: "18:00" }));

    expect(screen.getByRole("radio", { name: "18:00" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "17:00, el más cercano" })).not.toBeChecked();
  });

  it("shows the slots of another day and asks to pick one", async () => {
    api();
    renderApp(PATH);
    const user = userEvent.setup();
    await screen.findByRole("radio", { name: "17:00, el más cercano" });

    const [, , third] = within(screen.getByRole("radiogroup", { name: "Día" })).getAllByRole("radio");
    await user.click(third!);

    expect(screen.getByRole("radio", { name: "19:00" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: /Reservar/ })).toBeDisabled();
    expect(screen.queryByLabelText("Tu nombre")).not.toBeInTheDocument();
  });

  it("changes the availability when another service is chosen", async () => {
    const { calls } = api();
    renderApp(PATH);
    const user = userEvent.setup();
    await screen.findByRole("radio", { name: "17:00, el más cercano" });

    await user.click(screen.getByRole("radio", { name: /Cancha 2/ }));

    await waitFor(() => expect(calls.filter((call) => call.path.endsWith("/availability/")).length).toBe(2));
  });

  it("explains when nothing is free and offers WhatsApp", async () => {
    api({ [AVAILABILITY]: { status: 200, body: { timezone: TZ, slots: [] } } });
    renderApp(PATH);

    expect(await screen.findByText(/No hay horarios libres en los próximos 14 días/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Preguntar por WhatsApp" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Tu nombre")).not.toBeInTheDocument();
  });

  it("offers a retry when the slots cannot be loaded", async () => {
    api({ [AVAILABILITY]: { status: 500, body: { detail: "boom" } } });
    renderApp(PATH);

    expect(await screen.findByText("No pudimos cargar los horarios.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Intentar otra vez" })).toBeInTheDocument();
  });
});

describe("booking", () => {
  it("asks for what is missing before sending anything", async () => {
    const { calls } = api();
    renderApp(PATH);
    const user = userEvent.setup();

    await screen.findByLabelText("Tu nombre");
    await user.click(screen.getByRole("button", { name: /Reservar/ }));

    expect(screen.getByText("Escribe tu nombre.")).toBeInTheDocument();
    expect(screen.getByText("Escribe tu celular para avisarte.")).toBeInTheDocument();
    expect(screen.getByText("Marca la casilla para poder reservar.")).toBeInTheDocument();
    expect(calls.some((call) => call.method === "POST")).toBe(false);
    expect(screen.getByLabelText("Tu nombre")).toHaveFocus();
  });

  it("rejects a phone that cannot be a mobile", async () => {
    api();
    renderApp(PATH);
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Tu nombre"), "Rosa");
    await user.type(screen.getByLabelText("Tu celular"), "12345");
    await user.click(screen.getByLabelText(/Acepto que/));
    await user.click(screen.getByRole("button", { name: /Reservar/ }));

    expect(screen.getByText(/no parece válido/)).toBeInTheDocument();
  });

  it("sends the booking and lands on the ticket", async () => {
    const slot = slotAt(1, 17);
    const { calls } = api({
      "POST /public/businesses/canchas-los-andes/bookings/": {
        status: 201,
        body: { ...bookingDetails({ starts_at: slot.starts_at, ends_at: slot.ends_at }), manage_token: "tok-123" },
      },
    });
    renderApp(PATH);
    const user = userEvent.setup();

    await fillCustomer(user);
    await user.click(screen.getByRole("button", { name: "Reservar S/ 60" }));

    const post = calls.find((call) => call.method === "POST");
    expect(post?.body).toEqual({
      service: 11,
      starts_at: slot.starts_at,
      customer: { name: "Rosa Quispe", phone: "987 111 222", email: "" },
      accepted_terms: true,
    });
    expect(await screen.findByRole("heading", { level: 1, name: "Casi lista" })).toBeInTheDocument();
    expect(screen.getByLabelText("Boleto de Canchas Los Andes")).toBeInTheDocument();
  });

  it("keeps the ticket on this device", async () => {
    api({
      "POST /public/businesses/canchas-los-andes/bookings/": {
        status: 201,
        body: { ...bookingDetails(), manage_token: "tok-123" },
      },
    });
    renderApp(PATH);
    const user = userEvent.setup();

    await fillCustomer(user);
    await user.click(screen.getByRole("button", { name: /Reservar/ }));
    await screen.findByRole("heading", { level: 1, name: "Casi lista" });

    expect(localStorage.getItem("separa.bookings.v1")).toContain("tok-123");
  });

  it("books the service that was chosen, not the first one", async () => {
    const { calls } = api({
      "POST /public/businesses/canchas-los-andes/bookings/": {
        status: 201,
        body: { ...bookingDetails(), manage_token: "tok-123" },
      },
    });
    renderApp(PATH);
    const user = userEvent.setup();
    await screen.findByLabelText("Tu nombre");

    await user.click(screen.getByRole("radio", { name: /Cancha 2/ }));
    await fillCustomer(user);
    await user.click(screen.getByRole("button", { name: "Reservar S/ 70" }));

    await waitFor(() => expect(calls.find((call) => call.method === "POST")?.body).toMatchObject({ service: 22 }));
  });

  it("shows the server's message when the slot was just taken, and refreshes the slots", async () => {
    const { calls } = api({
      "POST /public/businesses/canchas-los-andes/bookings/": {
        status: 409,
        body: { code: "slot_unavailable", detail: "Ese horario ya no está disponible. Elige otro." },
      },
    });
    renderApp(PATH);
    const user = userEvent.setup();

    await fillCustomer(user);
    await user.click(screen.getByRole("button", { name: /Reservar/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ese horario ya no está disponible. Elige otro.");
    await waitFor(() => expect(calls.filter((call) => call.path.endsWith("/availability/")).length).toBeGreaterThan(1));
    expect(screen.getByRole("heading", { level: 1, name: "Canchas Los Andes" })).toBeInTheDocument();
  });

  it("puts a server validation error under its field", async () => {
    api({
      "POST /public/businesses/canchas-los-andes/bookings/": {
        status: 400,
        body: { customer: { phone: ["El número de celular no es válido."] } },
      },
    });
    renderApp(PATH);
    const user = userEvent.setup();

    await fillCustomer(user);
    await user.click(screen.getByRole("button", { name: /Reservar/ }));

    const phone = screen.getByLabelText("Tu celular");
    await waitFor(() => expect(phone).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByText("El número de celular no es válido.")).toBeInTheDocument();
  });

  it("does not reveal why a booking was refused", async () => {
    api({
      "POST /public/businesses/canchas-los-andes/bookings/": {
        status: 403,
        body: { code: "booking_not_allowed", detail: "No es posible completar la reserva. Contacta directamente al negocio." },
      },
    });
    renderApp(PATH);
    const user = userEvent.setup();

    await fillCustomer(user);
    await user.click(screen.getByRole("button", { name: /Reservar/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Contacta directamente al negocio");
  });

  it("shows a summary of what is about to be booked", async () => {
    api();
    renderApp(PATH);

    await screen.findByLabelText("Tu nombre");

    const summary = screen.getByText(/17:00/, { selector: "span.font-mono" });
    expect(summary).toHaveTextContent(`${Number(upcomingDays(TZ, 14)[1]!.slice(8))}`);
    expect(screen.getByRole("button", { name: "Reservar S/ 60" })).toBeEnabled();
  });
});
