import { describe, expect, it } from "vitest";

import { needsCare, trustLine } from "./trust";

describe("trustLine", () => {
  it("says a stranger has nothing behind them yet", () => {
    expect(trustLine({ level: "new", completed: 0, no_shows: 0 })).toBe("Todavía no tiene reservas atendidas contigo");
  });

  it("counts what a known customer has done, in the singular and the plural", () => {
    expect(trustLine({ level: "known", completed: 1, no_shows: 0 })).toBe("1 reserva atendida");
    expect(trustLine({ level: "known", completed: 4, no_shows: 0 })).toBe("4 reservas atendidas");
  });

  it("says a verified one came in with Google, and what they did before", () => {
    expect(trustLine({ level: "verified", completed: 0, no_shows: 0 })).toBe("Entró con Google");
    expect(trustLine({ level: "verified", completed: 2, no_shows: 0 })).toBe("Entró con Google · 2 reservas atendidas");
  });

  it("says how many times a flagged one did not show up", () => {
    expect(trustLine({ level: "flagged", completed: 0, no_shows: 1 })).toBe("No se presentó 1 vez");
    expect(trustLine({ level: "flagged", completed: 3, no_shows: 2 })).toBe("No se presentó 2 veces · 3 reservas atendidas");
  });

  it("says so when the only reason is a block", () => {
    expect(trustLine({ level: "flagged", completed: 0, no_shows: 0 })).toBe("Está bloqueado en tu negocio");
  });
});

describe("needsCare", () => {
  it("is for those the owner knows nothing good about", () => {
    expect(needsCare({ level: "new", completed: 0, no_shows: 0 })).toBe(true);
    expect(needsCare({ level: "flagged", completed: 0, no_shows: 1 })).toBe(true);
  });

  it("is not for those they can trust", () => {
    expect(needsCare({ level: "verified", completed: 0, no_shows: 0 })).toBe(false);
    expect(needsCare({ level: "known", completed: 2, no_shows: 0 })).toBe(false);
  });
});
