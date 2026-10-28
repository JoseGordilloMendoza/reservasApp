import { describe, expect, it } from "vitest";

import { validateCustomer } from "./customer";

const valid = { name: "Ana Pérez", phone: "987 654 321", email: "", accepted: true };

describe("validateCustomer", () => {
  it("accepts a complete, valid customer", () => {
    expect(validateCustomer(valid)).toEqual({});
  });

  it.each(["987654321", "987 654 321", "987-654-321", "51987654321", "+51 987 654 321", "(987) 654 321"])(
    "accepts the Peruvian mobile %s",
    (phone) => {
      expect(validateCustomer({ ...valid, phone }).phone).toBeUndefined();
    },
  );

  it("accepts an international number with its country code", () => {
    expect(validateCustomer({ ...valid, phone: "+57 300 123 4567" }).phone).toBeUndefined();
  });

  it.each(["12345", "887654321", "9876543210", "abc"])("rejects the number %s", (phone) => {
    expect(validateCustomer({ ...valid, phone }).phone).toMatch(/válido/);
  });

  it("asks for a phone and a name", () => {
    const errors = validateCustomer({ ...valid, name: " ", phone: "" });

    expect(errors.name).toBeDefined();
    expect(errors.phone).toMatch(/Escribe/);
  });

  it("treats the email as optional but checks it when given", () => {
    expect(validateCustomer({ ...valid, email: "" }).email).toBeUndefined();
    expect(validateCustomer({ ...valid, email: "ana@example.com" }).email).toBeUndefined();
    expect(validateCustomer({ ...valid, email: "ana@" }).email).toBeDefined();
  });

  it("requires accepting the terms", () => {
    expect(validateCustomer({ ...valid, accepted: false }).accepted).toBeDefined();
  });
});
