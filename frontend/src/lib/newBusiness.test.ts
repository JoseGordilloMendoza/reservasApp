import { describe, expect, it } from "vitest";

import { emptyBusiness, toNewBusiness, validateNewBusiness } from "./newBusiness";
import type { NewBusinessValues } from "./newBusiness";

const valid = (overrides: Partial<NewBusinessValues> = {}): NewBusinessValues => ({
  ...emptyBusiness(),
  name: "Canchas El Sol",
  ownerEmail: "rosa@example.com",
  price: "80",
  ...overrides,
});

describe("checking the form to open a business", () => {
  it("accepts the minimum: name, owner email and price, with the default trial", () => {
    expect(validateNewBusiness(valid())).toEqual({});
  });

  it("asks for what is missing", () => {
    expect(validateNewBusiness(emptyBusiness())).toEqual({
      name: "Escribe el nombre del negocio.",
      ownerEmail: "Escribe el correo del dueño.",
      price: "Escribe el precio mensual acordado.",
    });
  });

  it("lets the link be empty, but not wrong", () => {
    expect(validateNewBusiness(valid({ slug: "" })).slug).toBeUndefined();
    expect(validateNewBusiness(valid({ slug: "canchas-el-sol" })).slug).toBeUndefined();
    for (const slug of ["Canchas", "con espacio", "-inicio", "fin-", "doble--guion", "ñandú"]) {
      expect(validateNewBusiness(valid({ slug })).slug).toMatch(/minúsculas/);
    }
  });

  it("checks the email looks like one", () => {
    for (const ownerEmail of ["rosa", "rosa@", "@example.com", "rosa@example", "ro sa@example.com"]) {
      expect(validateNewBusiness(valid({ ownerEmail })).ownerEmail).toMatch(/incompleto/);
    }
  });

  it("accepts prices with a comma or a dot, and refuses what is not an amount", () => {
    for (const price of ["0", "80", "79.90", "79,9", " 120 "]) {
      expect(validateNewBusiness(valid({ price })).price).toBeUndefined();
    }
    for (const price of ["S/ 80", "-5", "1.234", "mucho"]) {
      expect(validateNewBusiness(valid({ price })).price).toMatch(/precio en soles/);
    }
  });

  it("limits a trial to 1 through 365 days", () => {
    expect(validateNewBusiness(valid({ trialDays: "1" })).trialDays).toBeUndefined();
    expect(validateNewBusiness(valid({ trialDays: "365" })).trialDays).toBeUndefined();
    for (const trialDays of ["0", "366", "", "diez", "2.5"]) {
      expect(validateNewBusiness(valid({ trialDays })).trialDays).toBe("Entre 1 y 365 días.");
    }
  });

  it("asks for an end date only when the term is a date, and ignores the trial then", () => {
    expect(validateNewBusiness(valid({ term: "date", validUntil: "", trialDays: "x" }))).toEqual({
      validUntil: "Elige hasta qué día vale.",
    });
    expect(validateNewBusiness(valid({ term: "date", validUntil: "2030-06-30" }))).toEqual({});
  });
});

describe("what the API receives", () => {
  it("sends the minimum, leaving out what was not filled in", () => {
    expect(toNewBusiness(valid())).toEqual({
      name: "Canchas El Sol",
      business_type: "court",
      owner: { email: "rosa@example.com" },
      subscription: { price: "80.00", trial_days: 30 },
    });
  });

  it("trims and keeps everything that was filled in", () => {
    const result = toNewBusiness(
      valid({
        name: "  Canchas El Sol ",
        slug: " el-sol ",
        kind: "psychologist",
        ownerFirstName: " Rosa ",
        ownerLastName: "Quispe",
        plan: " Mensual ",
        price: "79,9",
      }),
    );

    expect(result).toEqual({
      name: "Canchas El Sol",
      slug: "el-sol",
      business_type: "psychologist",
      owner: { email: "rosa@example.com", first_name: "Rosa", last_name: "Quispe" },
      subscription: { plan_name: "Mensual", price: "79.90", trial_days: 30 },
    });
  });

  it("sends an end date instead of trial days when that is the term", () => {
    const { subscription } = toNewBusiness(valid({ term: "date", validUntil: "2030-06-30", trialDays: "10" }));

    expect(subscription).toEqual({ price: "80.00", valid_until: "2030-06-30" });
  });
});
