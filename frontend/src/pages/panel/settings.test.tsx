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
    expect(screen.getByRole("radio", { name: "Lima" })).toBeChecked();
  });

  it("saves the changes and says so", async () => {
    const api = signedInRoutes({
      "PATCH /panel/business/": { status: 200, body: { ...PANEL_BUSINESS, name: "Canchas El Sol", accent: "cobalt" } },
    });
    const user = userEvent.setup();
    renderApp(PATH);

    const name = await screen.findByLabelText("Nombre");
    await user.clear(name);
    await user.type(name, "  Canchas El Sol ");
    await user.click(screen.getByRole("radio", { name: "Cobalto" }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(api.calls.find((call) => call.method === "PATCH")?.body).toMatchObject({ name: "Canchas El Sol", accent: "cobalt" });
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Cambios guardados");
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
