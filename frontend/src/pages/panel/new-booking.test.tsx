import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PanelCreatedBooking, PanelService } from "../../lib/panelTypes";
import { page, panelDetail, renderApp, signedInRoutes } from "../../test/helpers";

afterEach(() => {
  vi.unstubAllGlobals();
});

const PATH = "/panel/reservas/nueva";
const ONE_SERVICE: PanelService[] = [
  { id: 11, resource: { id: 1, name: "Cancha 1" }, name: "Alquiler 1 hora", duration_minutes: 60, reference_price: "60.00", is_active: true },
];
const TWO_SERVICES: PanelService[] = [
  ...ONE_SERVICE,
  { id: 22, resource: { id: 2, name: "Cancha 2" }, name: "Alquiler 1 hora", duration_minutes: 60, reference_price: "70.00", is_active: true },
];

function open(services: PanelService[], extra: Parameters<typeof signedInRoutes>[0] = {}) {
  return signedInRoutes({ "GET /panel/services/": { status: 200, body: page(services) }, ...extra });
}

const created = (overrides: Partial<PanelCreatedBooking> = {}): PanelCreatedBooking => ({
  ...panelDetail({ id: 9, status: "confirmed", source: "business" }),
  manage_token: "tok-abc",
  ...overrides,
});

async function fill(user: ReturnType<typeof userEvent.setup>, day: string, time: string) {
  const date = await screen.findByLabelText("Día");
  await user.clear(date);
  await user.type(date, day);
  const hour = screen.getByLabelText("Hora");
  await user.clear(hour);
  await user.type(hour, time);
  await user.type(screen.getByLabelText("Nombre"), "Marta Díaz");
  await user.type(screen.getByLabelText("Celular"), "955 111 222");
}

describe("writing down a booking", () => {
  it("proposes today and the next whole hour", async () => {
    open(ONE_SERVICE);
    renderApp(PATH);

    const day = (await screen.findByLabelText("Día")) as HTMLInputElement;
    const hour = screen.getByLabelText("Hora") as HTMLInputElement;

    expect(day.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(hour.value).toMatch(/^\d{2}:00$/);
  });

  it("does not ask which service when there is only one", async () => {
    open(ONE_SERVICE);
    renderApp(PATH);

    await screen.findByLabelText("Día");
    expect(screen.queryByRole("radiogroup", { name: "Servicio" })).not.toBeInTheDocument();
  });

  it("asks which one when there are several", async () => {
    open(TWO_SERVICES);
    renderApp(PATH);

    expect(await screen.findByRole("radiogroup", { name: "Servicio" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Cancha 1/ })).toBeChecked();
  });

  it("converts the business clock time into the instant the server expects", async () => {
    const { calls } = open(ONE_SERVICE, { "POST /panel/bookings/": { status: 201, body: created() } });
    renderApp(PATH);
    const user = userEvent.setup();

    await fill(user, "2030-01-07", "19:00");
    await user.click(screen.getByRole("button", { name: "Anotar reserva" }));

    await screen.findByRole("heading", { name: "Reserva anotada" });
    const post = calls.find((call) => call.method === "POST");
    expect(post?.body).toEqual({
      service: 11,
      starts_at: "2030-01-08T00:00:00.000Z", // 19:00 in Lima
      customer: { name: "Marta Díaz", phone: "955 111 222", email: "" },
    });
  });

  it("books the service that was chosen", async () => {
    const { calls } = open(TWO_SERVICES, { "POST /panel/bookings/": { status: 201, body: created() } });
    renderApp(PATH);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("radio", { name: /Cancha 2/ }));
    await fill(user, "2030-01-07", "19:00");
    await user.click(screen.getByRole("button", { name: "Anotar reserva" }));

    await screen.findByRole("heading", { name: "Reserva anotada" });
    expect(calls.find((call) => call.method === "POST")?.body).toMatchObject({ service: 22 });
  });

  it("asks for the name and the phone before sending", async () => {
    const { calls } = open(ONE_SERVICE);
    renderApp(PATH);
    const user = userEvent.setup();

    await screen.findByLabelText("Día");
    await user.click(screen.getByRole("button", { name: "Anotar reserva" }));

    expect(screen.getByText("Escribe tu nombre.")).toBeInTheDocument();
    expect(screen.getByText("Escribe tu celular para avisarte.")).toBeInTheDocument();
    expect(calls.some((call) => call.method === "POST")).toBe(false);
  });

  it("shows the server's message when the slot is taken", async () => {
    open(ONE_SERVICE, {
      "POST /panel/bookings/": {
        status: 409,
        body: { code: "slot_unavailable", detail: "Ese horario ya no está disponible. Elige otro." },
      },
    });
    renderApp(PATH);
    const user = userEvent.setup();

    await fill(user, "2030-01-07", "19:00");
    await user.click(screen.getByRole("button", { name: "Anotar reserva" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ese horario ya no está disponible.");
    expect(screen.queryByRole("heading", { name: "Reserva anotada" })).not.toBeInTheDocument();
  });

  it("explains a block in the schedule", async () => {
    open(ONE_SERVICE, {
      "POST /panel/bookings/": {
        status: 409,
        body: { code: "slot_blocked", detail: "Ese horario está bloqueado. Quita el bloqueo para poder reservarlo." },
      },
    });
    renderApp(PATH);
    const user = userEvent.setup();

    await fill(user, "2030-01-07", "19:00");
    await user.click(screen.getByRole("button", { name: "Anotar reserva" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ese horario está bloqueado");
  });

  it("says there is nothing to book when the business has no services", async () => {
    open([]);
    renderApp(PATH);

    expect(await screen.findByText("Tu negocio todavía no tiene servicios para reservar.")).toBeInTheDocument();
  });

  it("ignores services that are switched off", async () => {
    open([{ ...ONE_SERVICE[0]!, is_active: false }]);
    renderApp(PATH);

    expect(await screen.findByText("Tu negocio todavía no tiene servicios para reservar.")).toBeInTheDocument();
  });
});

describe("after writing it down", () => {
  async function finish() {
    const { calls } = open(ONE_SERVICE, { "POST /panel/bookings/": { status: 201, body: created() } });
    renderApp(PATH);
    const user = userEvent.setup();
    await fill(user, "2030-01-07", "19:00");
    await user.click(screen.getByRole("button", { name: "Anotar reserva" }));
    await screen.findByRole("heading", { name: "Reserva anotada" });
    return { calls, user };
  }

  it("gives the customer's link, built on this site", async () => {
    await finish();

    const link = screen.getByLabelText("Enlace de la reserva") as HTMLInputElement;

    expect(link.value).toBe(`${window.location.origin}/canchas-los-andes/reserva/tok-abc`);
  });

  it("offers to send it by WhatsApp with the message already written", async () => {
    await finish();

    const chat = screen.getByRole("link", { name: /Enviar por WhatsApp/ });
    const text = decodeURIComponent(chat.getAttribute("href") ?? "");

    expect(text).toContain("https://wa.me/51987654321");
    expect(text).toContain("tok-abc");
    expect(text).toContain("Canchas Los Andes");
  });

  it("copies the link", async () => {
    const { user } = await finish();

    await user.click(screen.getByRole("button", { name: "Copiar enlace" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Copiado" })).toBeInTheDocument());
    await expect(navigator.clipboard.readText()).resolves.toContain("/canchas-los-andes/reserva/tok-abc");
  });

  it("links to the booking and lets the owner write another", async () => {
    const { user } = await finish();

    expect(screen.getByRole("link", { name: "Ver la reserva" })).toHaveAttribute("href", "/panel/reservas/9");

    await user.click(screen.getByRole("button", { name: "Anotar otra" }));

    expect(await screen.findByRole("heading", { name: "Anotar reserva" })).toBeInTheDocument();
    expect((screen.getByLabelText("Nombre") as HTMLInputElement).value).toBe("");
  });
});
