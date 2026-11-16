import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { addFavorite, listFavorites } from "../lib/favorites";
import { BUSINESS, PANEL_BUSINESS, mockApi, renderApp, signedInRoutes } from "../test/helpers";

afterEach(() => {
  vi.unstubAllGlobals();
});

const LOGO = "https://images.example.dev/b1/logo-0123456789abcdef.webp";
const COVER = "https://images.example.dev/b1/cover-0123456789abcdef.webp";
const png = (name = "logo.png", type = "image/png", size = 1000) => {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

describe("the owner's pictures, in the panel", () => {
  const PATH = "/panel/ajustes/negocio";

  it("says there is none and offers to upload", async () => {
    signedInRoutes();
    renderApp(PATH);

    const logo = within(await screen.findByRole("group", { name: "Logo" }));
    expect(logo.getByText("Sin logo")).toBeInTheDocument();
    expect(logo.getByRole("button", { name: "Subir logo" })).toBeInTheDocument();
    expect(logo.queryByRole("button", { name: "Quitar" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Portada" })).getByRole("button", { name: "Subir portada" })).toBeInTheDocument();
  });

  it("sends the chosen file by itself, without the form's button, and shows the new picture", async () => {
    const api = signedInRoutes({
      "PUT /panel/business/logo/": { status: 200, body: { ...PANEL_BUSINESS, logo_url: LOGO } },
    });
    const user = userEvent.setup();
    renderApp(PATH);
    const logo = within(await screen.findByRole("group", { name: "Logo" }));
    const file = png();

    await user.upload(logo.getByLabelText("Archivo para logo"), file);

    expect(await logo.findByText("Logo guardado")).toBeInTheDocument();
    const call = api.calls.find((item) => item.method === "PUT");
    expect(call?.path).toBe("/panel/business/logo/");
    expect((call?.body as FormData).get("file")).toBe(file);
    expect(logo.getByRole("img", { name: "Logo actual" })).toHaveAttribute("src", LOGO);
    expect(logo.getByRole("button", { name: "Cambiar logo" })).toBeInTheDocument();
    expect(logo.getByRole("button", { name: "Quitar" })).toBeInTheDocument();
  });

  it("does not send a file that is not a JPG, PNG or WebP, and says why", async () => {
    const api = signedInRoutes();
    const user = userEvent.setup({ applyAccept: false });
    renderApp(PATH);
    const logo = within(await screen.findByRole("group", { name: "Logo" }));

    await user.upload(logo.getByLabelText("Archivo para logo"), png("foto.gif", "image/gif"));

    expect(await logo.findByRole("alert")).toHaveTextContent("Usa una imagen JPG, PNG o WebP.");
    expect(api.calls.some((call) => call.method === "PUT")).toBe(false);
  });

  it("does not send a file over 8 MB", async () => {
    const api = signedInRoutes();
    const user = userEvent.setup();
    renderApp(PATH);
    const cover = within(await screen.findByRole("group", { name: "Portada" }));

    await user.upload(cover.getByLabelText("Archivo para portada"), png("grande.png", "image/png", 9 * 1024 * 1024));

    expect(await cover.findByRole("alert")).toHaveTextContent("más de 8 MB");
    expect(api.calls.some((call) => call.method === "PUT")).toBe(false);
  });

  it("shows what the server said when it refuses the picture", async () => {
    signedInRoutes({
      "PUT /panel/business/cover/": { status: 400, body: { code: "invalid_image", detail: "No pudimos leer ese archivo como imagen. Prueba con otro." } },
    });
    const user = userEvent.setup();
    renderApp(PATH);
    const cover = within(await screen.findByRole("group", { name: "Portada" }));

    await user.upload(cover.getByLabelText("Archivo para portada"), png("falsa.png"));

    expect(await cover.findByRole("alert")).toHaveTextContent("No pudimos leer ese archivo como imagen");
    expect(cover.queryByText("Portada guardada")).not.toBeInTheDocument();
  });

  it("says so when the pictures cannot be kept for now", async () => {
    signedInRoutes({
      "PUT /panel/business/logo/": { status: 503, body: { code: "images_unavailable", detail: "No pudimos guardar la imagen ahora. Intenta de nuevo en un rato." } },
    });
    const user = userEvent.setup();
    renderApp(PATH);
    const logo = within(await screen.findByRole("group", { name: "Logo" }));

    await user.upload(logo.getByLabelText("Archivo para logo"), png());

    expect(await logo.findByRole("alert")).toHaveTextContent("Intenta de nuevo en un rato");
  });

  it("removes a picture", async () => {
    const api = signedInRoutes({
      "GET /panel/business/": { status: 200, body: { ...PANEL_BUSINESS, cover_url: COVER } },
      "DELETE /panel/business/cover/": { status: 200, body: { ...PANEL_BUSINESS, cover_url: null } },
    });
    const user = userEvent.setup();
    renderApp(PATH);
    const cover = within(await screen.findByRole("group", { name: "Portada" }));
    expect(cover.getByRole("img", { name: "Portada actual" })).toHaveAttribute("src", COVER);

    await user.click(cover.getByRole("button", { name: "Quitar" }));

    expect(await cover.findByText("Portada quitada")).toBeInTheDocument();
    expect(api.calls.some((call) => call.method === "DELETE" && call.path === "/panel/business/cover/")).toBe(true);
    expect(cover.getByText("Sin portada")).toBeInTheDocument();
  });
});

describe("the pictures on the business page", () => {
  const PATH = "/canchas-los-andes";
  const page = (overrides = {}) => {
    mockApi({
      "GET /public/businesses/canchas-los-andes/": { status: 200, body: { ...BUSINESS, ...overrides } },
      "GET /public/directory/": { status: 200, body: { results: [] } },
    });
    return renderApp(PATH);
  };

  /** The pictures inside the business's own poster (the page also has a site header). */
  const posterOf = (heading: HTMLElement) => heading.closest("header")!;

  it("puts the cover in a strip of its own, above the name, and the logo with the name", async () => {
    page({ logo_url: LOGO, cover_url: COVER });
    const heading = await screen.findByRole("heading", { level: 1, name: BUSINESS.name });

    const images = Array.from(posterOf(heading).querySelectorAll("img"));
    expect(images.map((image) => image.getAttribute("src"))).toEqual([COVER, LOGO]);
    // Both are decoration next to the name: they say nothing a screen reader would repeat.
    expect(images.every((image) => image.getAttribute("alt") === "")).toBe(true);
    // The name is text on the color block, not on the picture.
    expect(posterOf(heading).contains(heading)).toBe(true);
    expect(images[0]?.compareDocumentPosition(heading)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("shows no picture at all when the business has none", async () => {
    page();
    const heading = await screen.findByRole("heading", { level: 1, name: BUSINESS.name });

    expect(posterOf(heading).querySelectorAll("img")).toHaveLength(0);
  });

  it("drops a cover that cannot be loaded instead of leaving a broken image", async () => {
    page({ cover_url: COVER });
    const heading = await screen.findByRole("heading", { level: 1, name: BUSINESS.name });

    fireEvent.error(posterOf(heading).querySelector("img")!);

    await waitFor(() => expect(posterOf(heading).querySelectorAll("img")).toHaveLength(0));
  });

  it("keeps the logo with the favorite, and refreshes it when the page opens", async () => {
    addFavorite({ slug: BUSINESS.slug, name: BUSINESS.name, accent: "brand", kind: "court", address: BUSINESS.address });
    page({ logo_url: LOGO });
    await screen.findByRole("heading", { level: 1, name: BUSINESS.name });

    await waitFor(() => expect(listFavorites()[0]?.logo).toBe(LOGO));
  });
});

describe("the logo on the home page", () => {
  const ANDES = { name: "Canchas Los Andes", slug: "canchas-los-andes", business_type: "court", accent: "brand", address: "Av. Ejército 123", description: "Grass", logo_url: null, cover_url: null };
  /** The drawing a card shows when the business has no cover. */
  const drawing = (card: HTMLElement) => card.querySelector('svg[viewBox="0 0 160 120"]');

  it("uses the cover as the picture of the card and puts the logo on its edge", async () => {
    mockApi({
      "GET /public/directory/": {
        status: 200,
        body: { results: [{ ...ANDES, logo_url: LOGO, cover_url: COVER }, { ...ANDES, name: "Consultorio Lucía", slug: "consultorio-lucia", business_type: "psychologist" }] },
      },
    });
    renderApp("/");

    const cards = await screen.findAllByRole("link", { name: /Canchas Los Andes|Consultorio Lucía/ });
    expect(Array.from(cards[0]!.querySelectorAll("img")).map((image) => image.getAttribute("src"))).toEqual([COVER, LOGO]);
    expect(drawing(cards[0]!)).toBeNull();
    // Without pictures: the drawing in place of the cover, and the initial in place of the logo.
    expect(cards[1]!.querySelector("img")).toBeNull();
    expect(drawing(cards[1]!)).not.toBeNull();
    expect(cards[1]!).toHaveTextContent("C");
  });

  it("goes back to the drawing and the initial when the pictures cannot be loaded", async () => {
    mockApi({ "GET /public/directory/": { status: 200, body: { results: [{ ...ANDES, logo_url: LOGO, cover_url: COVER }] } } });
    renderApp("/");
    const card = await screen.findByRole("link", { name: /Canchas Los Andes/ });

    for (const image of Array.from(card.querySelectorAll("img"))) fireEvent.error(image);

    await waitFor(() => expect(card.querySelector("img")).toBeNull());
    expect(drawing(card)).not.toBeNull();
  });

  it("shows the saved logo on a favorite, and the initial when it has none", async () => {
    addFavorite({ slug: "con-logo", name: "Con Logo", accent: "brand", kind: "court", address: "", logo: LOGO });
    addFavorite({ slug: "sin-logo", name: "Sin Logo", accent: "brand", kind: "court", address: "" });
    mockApi({ "GET /public/directory/": { status: 200, body: { results: [] } } });
    renderApp("/");

    const section = within(await screen.findByRole("region", { name: "Tus favoritos" }));
    const withLogo = section.getByRole("link", { name: /Con Logo/ });
    const without = section.getByRole("link", { name: /Sin Logo/ });

    expect(withLogo.querySelector("img")).toHaveAttribute("src", LOGO);
    expect(without.querySelector("img")).toBeNull();
    expect(without).toHaveTextContent("S");
  });
});
