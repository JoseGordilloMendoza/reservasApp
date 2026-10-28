import { describe, expect, it } from "vitest";

import { validateNewPassword } from "./password";

describe("checking a new password", () => {
  it("accepts a long enough password that matches", () => {
    expect(validateNewPassword("clave-segura-1", "clave-segura-1")).toEqual({});
    expect(validateNewPassword("12345678a", "12345678a")).toEqual({});
  });

  it("asks for at least eight characters", () => {
    expect(validateNewPassword("corta1", "corta1").password).toBe("Usa al menos 8 caracteres.");
    expect(validateNewPassword("", "").password).toBe("Usa al menos 8 caracteres.");
  });

  it("refuses a password made only of digits", () => {
    expect(validateNewPassword("12345678", "12345678").password).toBe("No uses solo números.");
  });

  it("asks for the same password twice", () => {
    expect(validateNewPassword("clave-segura-1", "clave-segura-2").confirm).toBe("Las contraseñas no coinciden.");
  });

  it("does not also complain about the confirmation while the password itself is wrong", () => {
    expect(validateNewPassword("corta", "otra")).toEqual({ password: "Usa al menos 8 caracteres." });
  });

  it("counts spaces: nothing is trimmed from a password", () => {
    expect(validateNewPassword("        ", "        ").password).toBeUndefined();
  });
});
