import { describe, expect, it } from "vitest";

import { priceText, serviceInput, validateService } from "./services";
import type { ServiceValues } from "./services";

const values = (overrides: Partial<ServiceValues> = {}): ServiceValues => ({
  resource: "1",
  name: "Alquiler 1 hora",
  duration: "60",
  price: "60",
  ...overrides,
});

describe("checking a service", () => {
  it("accepts a complete one", () => {
    expect(validateService(values(), { creating: true })).toEqual({});
  });

  it("asks for the space only when creating", () => {
    expect(validateService(values({ resource: "" }), { creating: true }).resource).toBe("Elige el espacio.");
    expect(validateService(values({ resource: "" }), { creating: false })).toEqual({});
  });

  it("asks for a name", () => {
    expect(validateService(values({ name: "  " }), { creating: false }).name).toBe("Escribe el nombre del servicio.");
  });

  it("keeps the duration within what the server allows", () => {
    expect(validateService(values({ duration: "5" }), { creating: false })).toEqual({});
    expect(validateService(values({ duration: "1440" }), { creating: false })).toEqual({});
    expect(validateService(values({ duration: "4" }), { creating: false }).duration).toMatch(/entre 5 y 1440/);
    expect(validateService(values({ duration: "1441" }), { creating: false }).duration).toMatch(/entre 5 y 1440/);
    for (const text of ["", "una hora", "1.5", "-60"]) {
      expect(validateService(values({ duration: text }), { creating: false }).duration).toMatch(/número entero/);
    }
  });

  it("lets the price be empty, or have a comma or a dot", () => {
    for (const price of ["", "0", "60", "45.5", "45,50", "  80 "]) {
      expect(validateService(values({ price }), { creating: false }).price).toBeUndefined();
    }
  });

  it("refuses a price that is not an amount in soles", () => {
    for (const price of ["S/ 60", "-5", "4.567", "1.000,00", "mucho"]) {
      expect(validateService(values({ price }), { creating: false }).price).toMatch(/precio en soles/);
    }
  });
});

describe("what the API receives", () => {
  it("sends the space only when creating", () => {
    expect(serviceInput(values(), { creating: true })).toHaveProperty("resource_id", 1);
    expect(serviceInput(values(), { creating: false })).not.toHaveProperty("resource_id");
  });

  it("trims, converts and formats", () => {
    expect(serviceInput(values({ name: "  Corte ", duration: " 45 ", price: "45,5" }), { creating: false })).toEqual({
      name: "Corte",
      duration_minutes: 45,
      reference_price: "45.50",
    });
  });

  it("sends no price when it is empty", () => {
    expect(serviceInput(values({ price: " " }), { creating: false }).reference_price).toBeNull();
  });
});

describe("showing a price in the form", () => {
  it("drops pointless decimals", () => {
    expect(priceText("60.00")).toBe("60");
    expect(priceText("45.50")).toBe("45.50");
    expect(priceText(null)).toBe("");
    expect(priceText("")).toBe("");
  });
});
