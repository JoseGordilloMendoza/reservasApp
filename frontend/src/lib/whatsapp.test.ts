import { describe, expect, it } from "vitest";

import { displayPhone, telLink, whatsappLink } from "./whatsapp";

describe("whatsappLink", () => {
  it("builds a chat link with the message encoded", () => {
    const link = whatsappLink("+51 987 654 321", "Hola, reservé a las 19:00");

    expect(link).toBe("https://wa.me/51987654321?text=Hola%2C%20reserv%C3%A9%20a%20las%2019%3A00");
  });

  it("returns nothing without a usable number", () => {
    expect(whatsappLink("", "hola")).toBeNull();
    expect(whatsappLink("abc", "hola")).toBeNull();
  });
});

describe("telLink", () => {
  it("keeps the plus and drops the spaces", () => {
    expect(telLink("+51 987 654 321")).toBe("tel:+51987654321");
  });

  it("returns nothing for a short number", () => {
    expect(telLink("123")).toBeNull();
  });
});

describe("displayPhone", () => {
  it("groups Peruvian numbers in threes", () => {
    expect(displayPhone("+51987654321")).toBe("987 654 321");
  });

  it("leaves other numbers as they are", () => {
    expect(displayPhone("+573001234567")).toBe("+573001234567");
  });
});
