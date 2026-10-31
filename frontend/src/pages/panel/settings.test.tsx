import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PANEL_BUSINESS, renderApp, signedInRoutes } from "../../test/helpers";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the settings menu", () => {
  it("leads to every settings section", async () => {
    signedInRoutes();
    renderApp("/panel/ajustes");

    // The tab bar and the sidebar share the page in jsdom; the menu itself lives in <main>.
    const menu = within(await screen.findByRole("main"));
    expect(menu.getByRole("link", { name: /Mi página/ })).toHaveAttribute("href", "/panel/ajustes/negocio");
    expect(menu.getByRole("link", { name: /Reglas de reserva/ })).toHaveAttribute("href", "/panel/ajustes/reglas");
    expect(menu.getByRole("link", { name: /Espacios y horarios/ })).toHaveAttribute("href", "/panel/ajustes/espacios");
    expect(menu.getByRole("link", { name: /Servicios/ })).toHaveAttribute("href", "/panel/ajustes/servicios");
  });

  it("shows the link customers book with", async () => {
    signedInRoutes();
    renderApp("/panel/ajustes");

    const link = (await screen.findByLabelText("Enlace de tu página")) as HTMLInputElement;
    expect(link.value).toBe(`${window.location.origin}/${PANEL_BUSINESS.slug}`);
  });
});

describe("the business page settings", () => {
  const PATH = "/panel/ajustes/negocio";

  it("starts from what the business has today", async () => {
    signedInRoutes();
    renderApp(PATH);

    expect(await screen.findByLabelText("Nombre")).toHaveValue(PANEL_BUSINESS.name);
    expect(screen.getByLabelText("Descripción")).toHaveValue(PANEL_BUSINESS.description);
    expect(screen.getByRole("radio", { name: "Amapola" })).toBeChecked();
  });

  it("saves the changes and says so", async () => {
    const api = signedInRoutes({
      "PATCH /panel/business/": { status: 200, body: { ...PANEL_BUSINESS, name: "Canchas El Sol", accent: "sky" } },
    });
    const user = userEvent.setup();
    renderApp(PATH);

    const name = await screen.findByLabelText("Nombre");
    await user.clear(name);
    await user.type(name, "  Canchas El Sol ");
    await user.click(screen.getByRole("radio", { name: "Cielo" }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(api.calls.find((call) => call.method === "PATCH")?.body).toMatchObject({ name: "Canchas El Sol", accent: "sky" });
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Cambios guardados");
  });

  it("saves how customers pay, so it reaches their ticket and email", async () => {
    const api = signedInRoutes({
      "PATCH /panel/business/": { status: 200, body: { ...PANEL_BUSINESS, payment_instructions: "Yape al 987 654 321" } },
    });
    const user = userEvent.setup();
    renderApp(PATH);

    expect(await screen.findByLabelText("Cómo te pagan")).toHaveValue("");
    await user.type(screen.getByLabelText("Cómo te pagan"), " Yape al 987 654 321 ");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(api.calls.find((call) => call.method === "PATCH")?.body).toMatchObject({ payment_instructions: "Yape al 987 654 321" });
    });
  });

  it("repaints the panel with the new color once it is saved", async () => {
    signedInRoutes({ "PATCH /panel/business/": { status: 200, body: { ...PANEL_BUSINESS, accent: "rose" } } });
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByRole("radio", { name: "Rosa" }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(document.documentElement.dataset.accent).toBe("rose"));
  });

  it("does not ask the server for a business without a name", async () => {
    const api = signedInRoutes();
    const user = userEvent.setup();
    renderApp(PATH);

    await user.clear(await screen.findByLabelText("Nombre"));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("Escribe el nombre de tu negocio.")).toBeInTheDocument();
    expect(api.calls.some((call) => call.method === "PATCH")).toBe(false);
  });

  it("puts the server's complaint under the field it is about", async () => {
    signedInRoutes({ "PATCH /panel/business/": { status: 400, body: { phone: ["El número de teléfono no es válido."] } } });
    const user = userEvent.setup();
    renderApp(PATH);

    await user.type(await screen.findByLabelText("Teléfono"), "123");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("El número de teléfono no es válido.")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows what the server kept, such as a tidied phone number", async () => {
    signedInRoutes({ "PATCH /panel/business/": { status: 200, body: { ...PANEL_BUSINESS, phone: "+51987654321" } } });
    const user = userEvent.setup();
    renderApp(PATH);

    const phone = await screen.findByLabelText("Teléfono");
    await user.clear(phone);
    await user.type(phone, "987 654 321");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(phone).toHaveValue("+51987654321"));
  });
});

describe("the booking rules", () => {
  const PATH = "/panel/ajustes/reglas";
  const SETTINGS = {
    confirmation_mode: "manual",
    pending_hold_minutes: 120,
    cancellation_notice_minutes: 1440,
    min_booking_notice_minutes: 60,
    booking_horizon_days: 30,
    slot_interval_minutes: 60,
    buffer_minutes: 0,
    max_active_bookings_per_customer: 3,
  };
  const business = (settings: Record<string, number | string> = {}) => ({
    ...PANEL_BUSINESS,
    settings: { ...SETTINGS, ...settings },
  });

  function open(settings: Record<string, number | string> = {}, extra: Parameters<typeof signedInRoutes>[0] = {}) {
    return signedInRoutes({ "GET /panel/business/": { status: 200, body: business(settings) }, ...extra });
  }

  it("shows the current value of every option, with a readable echo", async () => {
    open();
    renderApp(PATH);

    expect(await screen.findByLabelText("Tiempo para confirmar")).toHaveValue("120");
    expect(screen.getByLabelText("Anticipación para cancelar")).toHaveValue("1440");
    expect(screen.getByText(/^1 día\./)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Yo confirmo cada reserva/ })).toBeChecked();
  });

  it("does not ask how long to hold a booking when they confirm themselves", async () => {
    open({ confirmation_mode: "automatic" });
    renderApp(PATH);

    await screen.findByLabelText("Anticipación para cancelar");
    expect(screen.queryByLabelText("Tiempo para confirmar")).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Se confirman solas/ })).toBeChecked();
  });

  it("sends only the options that changed", async () => {
    const api = open({}, { "PATCH /panel/business/": { status: 200, body: business({ buffer_minutes: 15 }) } });
    const user = userEvent.setup();
    renderApp(PATH);

    const buffer = await screen.findByLabelText("Descanso entre reservas");
    await user.clear(buffer);
    await user.type(buffer, "15");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(api.calls.find((call) => call.method === "PATCH")?.body).toEqual({ settings: { buffer_minutes: 15 } });
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Cambios guardados");
  });

  it("switches to automatic confirmation", async () => {
    const api = open({}, { "PATCH /panel/business/": { status: 200, body: business({ confirmation_mode: "automatic" }) } });
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByRole("radio", { name: /Se confirman solas/ }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(api.calls.find((call) => call.method === "PATCH")?.body).toEqual({ settings: { confirmation_mode: "automatic" } });
    });
  });

  it("does not call the server when nothing changed", async () => {
    const api = open();
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Cambios guardados");
    expect(api.calls.some((call) => call.method === "PATCH")).toBe(false);
  });

  it("marks a value outside the limits without calling the server", async () => {
    const api = open();
    const user = userEvent.setup();
    renderApp(PATH);

    const horizon = await screen.findByLabelText("Días hacia adelante");
    await user.clear(horizon);
    await user.type(horizon, "400");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("Debe ser como máximo 365.")).toBeInTheDocument();
    expect(api.calls.some((call) => call.method === "PATCH")).toBe(false);
  });

  it("shows the server's complaint when it refuses", async () => {
    open({}, { "PATCH /panel/business/": { status: 400, body: { settings: ["buffer_minutes: must be at most 240"] } } });
    const user = userEvent.setup();
    renderApp(PATH);

    const buffer = await screen.findByLabelText("Descanso entre reservas");
    await user.clear(buffer);
    await user.type(buffer, "15");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("buffer_minutes: must be at most 240");
  });
});

describe("appearing in the home page search", () => {
  const PATH = "/panel/ajustes/negocio";

  it("is off until the owner asks for it, and explains what it does", async () => {
    signedInRoutes();
    renderApp(PATH);

    expect(await screen.findByLabelText("Aparecer en el buscador de la página de inicio")).not.toBeChecked();
    expect(screen.getByText(/solo entran tus clientes que tengan tu link/)).toBeInTheDocument();
  });

  it("reflects a business that already appears", async () => {
    signedInRoutes({ "GET /panel/business/": { status: 200, body: { ...PANEL_BUSINESS, listed: true } } });
    renderApp(PATH);

    expect(await screen.findByLabelText("Aparecer en el buscador de la página de inicio")).toBeChecked();
  });

  it("asks to appear when it is ticked and saved", async () => {
    const api = signedInRoutes({
      "PATCH /panel/business/": { status: 200, body: { ...PANEL_BUSINESS, listed: true } },
    });
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByLabelText("Aparecer en el buscador de la página de inicio"));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(api.calls.find((call) => call.method === "PATCH")?.body).toMatchObject({ listed: true });
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Cambios guardados");
  });

  it("can be withdrawn again", async () => {
    const api = signedInRoutes({
      "GET /panel/business/": { status: 200, body: { ...PANEL_BUSINESS, listed: true } },
      "PATCH /panel/business/": { status: 200, body: { ...PANEL_BUSINESS, listed: false } },
    });
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByLabelText("Aparecer en el buscador de la página de inicio"));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(api.calls.find((call) => call.method === "PATCH")?.body).toMatchObject({ listed: false });
    });
  });
});
