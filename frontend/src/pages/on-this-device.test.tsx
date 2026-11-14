import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BUSINESS, TZ, bookingDetails, mockApi, renderApp, slotAt } from "../test/helpers";
import { addFavorite, listFavorites } from "../lib/favorites";
import { readRemembered, saveRemembered } from "../lib/remembered";

afterEach(() => {
  vi.unstubAllGlobals();
});

const PATH = "/canchas-los-andes";
const AVAILABILITY = "GET /public/businesses/canchas-los-andes/availability/";

function api(extra: Parameters<typeof mockApi>[0] = {}, business = BUSINESS) {
  return mockApi({
    "GET /public/businesses/canchas-los-andes/": { status: 200, body: business },
    [AVAILABILITY]: { status: 200, body: { timezone: TZ, slots: [slotAt(1, 17), slotAt(1, 18)] } },
    "GET /public/directory/": { status: 200, body: { results: [] } },
    ...extra,
  });
}

describe("favorites", () => {
  it("saves a business from its page and shows it on the home page", async () => {
    api();
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByRole("button", { name: "Guardar en favoritos" }));

    expect(screen.getByRole("button", { name: "En tus favoritos" })).toBeInTheDocument();
    expect(screen.getByText("Guardado en tus favoritos.")).toBeInTheDocument();
    expect(listFavorites().map((item) => item.slug)).toEqual(["canchas-los-andes"]);
  });

  it("takes it back with the same button", async () => {
    addFavorite({ slug: BUSINESS.slug, name: BUSINESS.name, accent: "brand", kind: "court", address: BUSINESS.address });
    api();
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByRole("button", { name: "En tus favoritos" }));

    expect(screen.getByRole("button", { name: "Guardar en favoritos" })).toBeInTheDocument();
    expect(listFavorites()).toEqual([]);
  });

  it("lists them on the home page, each one leading to its page, and lets them be removed", async () => {
    addFavorite({ slug: BUSINESS.slug, name: BUSINESS.name, accent: "brand", kind: "court", address: BUSINESS.address });
    api();
    const user = userEvent.setup();
    renderApp("/");

    const section = within(await screen.findByRole("region", { name: "Tus favoritos" }));
    expect(section.getByRole("link", { name: /Canchas Los Andes/ })).toHaveAttribute("href", "/canchas-los-andes");
    expect(section.getByText("Cancha deportiva")).toBeInTheDocument();

    await user.click(section.getByRole("button", { name: "Quitar Canchas Los Andes de tus favoritos" }));

    expect(screen.queryByRole("region", { name: "Tus favoritos" })).not.toBeInTheDocument();
  });

  it("is not on the home page until something is saved", async () => {
    api();
    renderApp("/");

    await screen.findByRole("heading", { level: 1 });

    expect(screen.queryByRole("region", { name: "Tus favoritos" })).not.toBeInTheDocument();
  });

  it("keeps a saved business as it is now when its page is opened", async () => {
    addFavorite({ slug: BUSINESS.slug, name: "Nombre viejo", accent: "rose", kind: "court", address: "" });
    api();
    renderApp(PATH);

    await screen.findByRole("heading", { level: 1, name: BUSINESS.name });

    await waitFor(() => expect(listFavorites()[0]).toMatchObject({ name: BUSINESS.name, accent: "brand", address: BUSINESS.address }));
  });
});

describe("remember my data", () => {
  it("starts the form filled in with what was kept, but asks for the terms again", async () => {
    saveRemembered({ name: "Rosa Quispe", phone: "987 111 222", email: "rosa@example.com" });
    api();
    renderApp(PATH);

    // The nearest free slot is already chosen, so the form is there.
    expect(await screen.findByLabelText("Tu nombre")).toHaveValue("Rosa Quispe");
    expect(screen.getByLabelText("Tu celular")).toHaveValue("987 111 222");
    expect(screen.getByLabelText("Correo (opcional)")).toHaveValue("rosa@example.com");
    expect(screen.getByLabelText(/Acepto que/)).not.toBeChecked();
    expect(screen.getByText("Usamos los datos que guardaste en este celular.")).toBeInTheDocument();
  });

  it("keeps the data after a booking, when the box is left marked", async () => {
    api({ "POST /public/businesses/canchas-los-andes/bookings/": { status: 201, body: { ...bookingDetails(), manage_token: "tok-1" } } });
    const user = userEvent.setup();
    renderApp(PATH);

    await user.type(await screen.findByLabelText("Tu nombre"), "Rosa Quispe");
    await user.type(screen.getByLabelText("Tu celular"), "987 111 222");
    expect(screen.getByLabelText(/Recordar mis datos/)).toBeChecked();
    await user.click(screen.getByLabelText(/Acepto que/));
    await user.click(screen.getAllByRole("button", { name: /Reservar/ }).at(-1)!);

    await waitFor(() => expect(readRemembered()).toEqual({ name: "Rosa Quispe", phone: "987 111 222", email: "" }));
  });

  it("keeps nothing when the box is unmarked, and forgets what was kept before", async () => {
    saveRemembered({ name: "Rosa Quispe", phone: "987 111 222", email: "" });
    api({ "POST /public/businesses/canchas-los-andes/bookings/": { status: 201, body: { ...bookingDetails(), manage_token: "tok-1" } } });
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByLabelText(/Recordar mis datos/));
    await user.click(screen.getByLabelText(/Acepto que/));
    await user.click(screen.getAllByRole("button", { name: /Reservar/ }).at(-1)!);

    await waitFor(() => expect(readRemembered()).toBeNull());
  });

  it("clears the form and the memory with one tap on 'Usar otros datos'", async () => {
    saveRemembered({ name: "Rosa Quispe", phone: "987 111 222", email: "" });
    api();
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByRole("button", { name: "Usar otros datos" }));

    expect(screen.getByLabelText("Tu nombre")).toHaveValue("");
    expect(screen.getByLabelText("Tu celular")).toHaveValue("");
    expect(readRemembered()).toBeNull();
    expect(screen.queryByText("Usamos los datos que guardaste en este celular.")).not.toBeInTheDocument();
  });

  it("shows what is kept in 'Mis reservas', where it can be forgotten", async () => {
    saveRemembered({ name: "Rosa Quispe", phone: "987 111 222", email: "rosa@example.com" });
    const user = userEvent.setup();
    renderApp("/mis-reservas");

    const card = within(await screen.findByRole("region", { name: "Mis datos" }));
    expect(card.getByText("Rosa Quispe")).toBeInTheDocument();
    expect(card.getByText("987 111 222")).toBeInTheDocument();

    await user.click(card.getByRole("button", { name: "Olvidar mis datos" }));

    expect(screen.queryByRole("region", { name: "Mis datos" })).not.toBeInTheDocument();
    expect(readRemembered()).toBeNull();
  });

  it("shows no data card when nothing was kept", async () => {
    renderApp("/mis-reservas");

    await screen.findByRole("heading", { level: 1, name: "Mis reservas" });

    expect(screen.queryByRole("region", { name: "Mis datos" })).not.toBeInTheDocument();
  });
});
