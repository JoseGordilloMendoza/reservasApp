import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BUSINESS, PANEL_BUSINESS, bookingDetails, mockApi, renderApp, signedInRoutes } from "../test/helpers";
import type { PublicBusiness } from "../lib/types";

afterEach(() => {
  vi.unstubAllGlobals();
});

function page(business: PublicBusiness) {
  mockApi({ "GET /public/businesses/canchas-los-andes/": { status: 200, body: business } });
  renderApp("/canchas-los-andes");
}

describe("what the business says about its place, on its page", () => {
  it("shows what it has, its rules, its networks and a way to get there", async () => {
    page({
      ...BUSINESS,
      features: ["parking", "wifi"],
      house_rules: "Llegar 10 minutos antes\nNo fumar",
      instagram: "https://www.instagram.com/canchas.andes",
      website: "https://canchaslosandes.pe",
      maps_url: "https://maps.app.goo.gl/AbCdEf123",
    });

    const about = within(await screen.findByRole("region", { name: "Sobre este lugar" }));

    expect(about.getByRole("list", { name: "Qué tiene" })).toHaveTextContent("Estacionamiento");
    expect(about.getByRole("list", { name: "Qué tiene" })).toHaveTextContent("Wifi");
    expect(about.getByRole("heading", { name: "Reglas de la casa" })).toBeInTheDocument();
    expect(about.getAllByRole("listitem").map((item) => item.textContent)).toEqual(
      expect.arrayContaining(["Llegar 10 minutos antes", "No fumar"]),
    );
    expect(about.getByRole("link", { name: /Cómo llegar/ })).toHaveAttribute("href", "https://maps.app.goo.gl/AbCdEf123");
    expect(about.getByRole("link", { name: /Instagram/ })).toHaveAttribute("href", "https://www.instagram.com/canchas.andes");
    expect(about.getByRole("link", { name: /Página web/ })).toHaveAttribute("href", "https://canchaslosandes.pe");
    expect(about.queryByRole("link", { name: /Facebook/ })).not.toBeInTheDocument();
  });

  it("opens every outside link in a new tab, safely, and says so to a screen reader", async () => {
    page({ ...BUSINESS, instagram: "https://www.instagram.com/canchas.andes" });

    const link = await screen.findByRole("link", { name: /Instagram/ });

    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
    expect(link).toHaveAccessibleName(/se abre en otra pestaña/);
  });

  it("searches the address on the map when the owner gave no map link", async () => {
    page(BUSINESS);

    const link = await screen.findByRole("link", { name: /Cómo llegar/ });

    expect(link.getAttribute("href")).toContain("https://www.google.com/maps/search/?api=1&query=");
    expect(decodeURIComponent(link.getAttribute("href")!)).toContain(BUSINESS.address);
  });

  it("is not on the page at all when the business filled in nothing", async () => {
    page({ ...BUSINESS, address: "" });
    await screen.findByRole("heading", { level: 1, name: BUSINESS.name });

    expect(screen.queryByRole("region", { name: "Sobre este lugar" })).not.toBeInTheDocument();
  });
});

describe("the ticket carries the way to the place and its rules", () => {
  const business = {
    name: BUSINESS.name,
    slug: BUSINESS.slug,
    address: "Av. Ejército 123",
    maps_url: "https://maps.app.goo.gl/AbCdEf123",
    house_rules: "Traer zapatillas\nLlegar temprano",
  };

  function ticket(overrides: Parameters<typeof bookingDetails>[0]) {
    mockApi({
      "GET /public/bookings/tok-123/": { status: 200, body: bookingDetails(overrides) },
      "GET /public/businesses/canchas-los-andes/": { status: 200, body: BUSINESS },
    });
    renderApp("/canchas-los-andes/reserva/tok-123");
  }

  it("shows the address, a link to get there and the rules", async () => {
    ticket({ business });

    const card = within(await screen.findByLabelText("Boleto de Canchas Los Andes"));

    expect(card.getByText("Av. Ejército 123")).toBeInTheDocument();
    expect(card.getByRole("link", { name: /Cómo llegar/ })).toHaveAttribute("href", "https://maps.app.goo.gl/AbCdEf123");
    expect(card.getByText("Antes de venir")).toBeInTheDocument();
    expect(card.getByText("Traer zapatillas")).toBeInTheDocument();
  });

  it("leaves them out of a cancelled booking, where nobody is going", async () => {
    ticket({ business, status: "cancelled" });

    const card = within(await screen.findByLabelText("Boleto de Canchas Los Andes"));

    expect(card.queryByText("Antes de venir")).not.toBeInTheDocument();
    expect(card.queryByRole("link", { name: /Cómo llegar/ })).not.toBeInTheDocument();
  });
});

describe("the owner fills in the page details", () => {
  const PATH = "/panel/ajustes/negocio";

  it("picks what the place has and sends it with the rest", async () => {
    const api = signedInRoutes({
      "PATCH /panel/business/": { status: 200, body: { ...PANEL_BUSINESS, features: ["parking", "wifi"] } },
    });
    const user = userEvent.setup();
    renderApp(PATH);

    const group = within(await screen.findByRole("group", { name: "Qué tiene tu lugar" }));
    await user.click(group.getByRole("checkbox", { name: "Estacionamiento" }));
    await user.click(group.getByRole("checkbox", { name: "Wifi" }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(api.calls.find((call) => call.method === "PATCH")?.body).toMatchObject({ features: ["parking", "wifi"] });
    });
  });

  it("can take back something it picked", async () => {
    const api = signedInRoutes({
      "GET /panel/business/": { status: 200, body: { ...PANEL_BUSINESS, features: ["parking", "wifi"] } },
      "PATCH /panel/business/": { status: 200, body: { ...PANEL_BUSINESS, features: ["wifi"] } },
    });
    const user = userEvent.setup();
    renderApp(PATH);

    const parking = await screen.findByRole("checkbox", { name: "Estacionamiento" });
    expect(parking).toBeChecked();
    await user.click(parking);
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(api.calls.find((call) => call.method === "PATCH")?.body).toMatchObject({ features: ["wifi"] });
    });
  });

  it("sends the networks, the map link and the rules as typed, trimmed", async () => {
    const api = signedInRoutes({ "PATCH /panel/business/": { status: 200, body: PANEL_BUSINESS } });
    const user = userEvent.setup();
    renderApp(PATH);

    await user.type(await screen.findByLabelText("Instagram"), " @canchas.andes ");
    await user.type(screen.getByLabelText("Página web"), "canchaslosandes.pe");
    await user.type(screen.getByLabelText("Link de Google Maps"), "https://maps.app.goo.gl/AbCdEf123");
    await user.type(screen.getByLabelText("Reglas de la casa"), "No fumar");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(api.calls.find((call) => call.method === "PATCH")?.body).toMatchObject({
        instagram: "@canchas.andes",
        website: "canchaslosandes.pe",
        maps_url: "https://maps.app.goo.gl/AbCdEf123",
        house_rules: "No fumar",
      });
    });
  });

  it("says what to fix next to the link that was not accepted", async () => {
    signedInRoutes({
      "PATCH /panel/business/": {
        status: 400,
        body: { instagram: ["Escribe tu usuario de Instagram (por ejemplo @minegocio) o pega el link de tu perfil."] },
      },
    });
    const user = userEvent.setup();
    renderApp(PATH);

    await user.type(await screen.findByLabelText("Instagram"), "https://otro.example/x");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText(/Escribe tu usuario de Instagram/)).toBeInTheDocument();
  });
});
