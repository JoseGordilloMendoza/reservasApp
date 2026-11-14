import { describe, expect, it } from "vitest";

import { MAX_FAVORITES, addFavorite, isFavoriteBusiness, listFavorites, refreshFavorite, removeFavorite } from "./favorites";

const lucia = { slug: "consultorio-lucia", name: "Consultorio Lucía", accent: "sky", kind: "psychologist", address: "Calle Mercaderes 100" } as const;
const andes = { slug: "canchas-los-andes", name: "Canchas Los Andes", accent: "brand", kind: "court", address: "Av. Ejército 123" } as const;

describe("favorites", () => {
  it("starts empty", () => {
    expect(listFavorites()).toEqual([]);
    expect(isFavoriteBusiness(andes.slug)).toBe(false);
  });

  it("saves a business, newest first, and knows it is saved", () => {
    addFavorite(lucia);
    addFavorite(andes);

    expect(listFavorites().map((item) => item.slug)).toEqual(["canchas-los-andes", "consultorio-lucia"]);
    expect(isFavoriteBusiness(andes.slug)).toBe(true);
  });

  it("does not repeat a business saved twice", () => {
    addFavorite(andes);
    addFavorite(andes);

    expect(listFavorites()).toHaveLength(1);
  });

  it("removes one without touching the others", () => {
    addFavorite(lucia);
    addFavorite(andes);

    removeFavorite(lucia.slug);

    expect(listFavorites().map((item) => item.slug)).toEqual(["canchas-los-andes"]);
  });

  it("keeps a saved business current when it was renamed, without saving one that was not", () => {
    addFavorite(andes);

    refreshFavorite({ ...andes, name: "Canchas El Sol" });
    refreshFavorite({ ...lucia });

    expect(listFavorites().map((item) => item.name)).toEqual(["Canchas El Sol"]);
  });

  it("drops the oldest ones past the limit", () => {
    for (let n = 0; n < MAX_FAVORITES + 3; n++) addFavorite({ ...andes, slug: `negocio-${n}` });

    expect(listFavorites()).toHaveLength(MAX_FAVORITES);
    expect(isFavoriteBusiness("negocio-0")).toBe(false);
    expect(isFavoriteBusiness(`negocio-${MAX_FAVORITES + 2}`)).toBe(true);
  });

  it("ignores what it cannot read instead of failing", () => {
    localStorage.setItem("separa.favorites.v1", "{not json");
    expect(listFavorites()).toEqual([]);

    localStorage.setItem("separa.favorites.v1", JSON.stringify([{ slug: 3 }, null, "x"]));
    // The list was read before; adding forces a fresh read of the bad content.
    addFavorite(andes);
    expect(listFavorites().map((item) => item.slug)).toEqual(["canchas-los-andes"]);
  });
});
