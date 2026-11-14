import { describe, expect, it } from "vitest";

import { directionsLink, networksOf, rulesOf } from "./places";

describe("directionsLink", () => {
  it("prefers the map link the owner pasted", () => {
    expect(directionsLink({ address: "Av. Ejército 123", maps_url: "https://maps.app.goo.gl/abc" })).toBe("https://maps.app.goo.gl/abc");
  });

  it("searches the address when there is no map link", () => {
    expect(directionsLink({ address: "Av. Ejército 123, Arequipa", maps_url: "" })).toBe(
      "https://www.google.com/maps/search/?api=1&query=Av.%20Ej%C3%A9rcito%20123%2C%20Arequipa",
    );
  });

  it("has nowhere to send them without either", () => {
    expect(directionsLink({ address: "  ", maps_url: "" })).toBeNull();
  });
});

describe("rulesOf", () => {
  it("makes one rule per line and drops the empty ones", () => {
    expect(rulesOf("Llegar 10 minutos antes\n\n  No fumar  \n")).toEqual(["Llegar 10 minutos antes", "No fumar"]);
    expect(rulesOf("")).toEqual([]);
  });
});

describe("networksOf", () => {
  it("lists only the links that are filled in, in a fixed order", () => {
    const list = networksOf({ instagram: "https://instagram.com/a", facebook: "", tiktok: "https://tiktok.com/@a", website: "" });

    expect(list.map((network) => network.key)).toEqual(["instagram", "tiktok"]);
  });
});
