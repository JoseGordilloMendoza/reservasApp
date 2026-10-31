import { describe, expect, it } from "vitest";

import type { PanelBooking } from "./panelTypes";
import { attendanceIsDue, quickMessages } from "./quickMessages";
import { panelBooking } from "../test/helpers";

const NOW = new Date("2030-01-07T15:00:00Z"); // 10:00 in Lima
const context = { business: "Canchas Los Andes", timeZone: "America/Lima", paymentInstructions: "", now: NOW };
const booking = (overrides: Partial<PanelBooking> = {}) =>
  panelBooking({ starts_at: "2030-01-08T00:00:00Z", ends_at: "2030-01-08T01:00:00Z", status: "confirmed", ...overrides });

const decoded = (href: string | null) => decodeURIComponent((href ?? "").split("text=")[1] ?? "");
const labels = (messages: ReturnType<typeof quickMessages>) => messages.map((message) => message.label);

describe("what is offered for each situation", () => {
  it("a confirmed booking can be reminded, asking the customer to confirm", () => {
    const messages = quickMessages(booking(), context);

    expect(labels(messages)).toEqual(["Recordar y pedir que confirme"]);
    expect(decoded(messages[0]!.href)).toBe(
      "Hola Ana, te recordamos tu reserva de Alquiler 1 hora hoy a las 19:00 en Canchas Los Andes. Tu código es K7M-42X. ¿Nos confirmas que vienes?",
    );
  });

  it("does not ask again for what the customer already confirmed", () => {
    const messages = quickMessages(booking({ customer_confirmed_at: "2030-01-07T14:00:00Z" }), context);

    expect(labels(messages)).toEqual(["Recordar la reserva"]);
  });

  it("does not remind someone who is already there", () => {
    expect(quickMessages(booking({ arrived_at: "2030-01-08T00:05:00Z" }), context)).toEqual([]);
  });

  it("a pending booking can be answered that it could not be confirmed", () => {
    const messages = quickMessages(booking({ status: "pending" }), context);

    expect(labels(messages)).toEqual(["Avisar que no pude confirmar"]);
    expect(decoded(messages[0]!.href)).toContain("no pudimos confirmar tu reserva de Alquiler 1 hora hoy a las 19:00");
  });

  it("offers how to pay only when the owner wrote it, and until it is paid", () => {
    expect(labels(quickMessages(booking(), context))).not.toContain("Enviar cómo pagar");

    const withInstructions = { ...context, paymentInstructions: "  Yape al 987 654 321  " };
    const messages = quickMessages(booking(), withInstructions);

    expect(labels(messages)).toContain("Enviar cómo pagar");
    expect(decoded(messages.find((message) => message.id === "payment")!.href)).toContain("pagar así: Yape al 987 654 321. Cuando lo hagas");
    expect(labels(quickMessages(booking({ payment_status: "paid" }), withInstructions))).not.toContain("Enviar cómo pagar");
  });

  it("offers nothing for a booking that is over or turned down", () => {
    for (const status of ["cancelled", "expired", "completed", "no_show"] as const) {
      expect(quickMessages(booking({ status }), { ...context, paymentInstructions: "Yape" })).toEqual([]);
    }
  });

  it("has no link when the phone cannot be reached", () => {
    const messages = quickMessages(booking({ customer: { ...booking().customer, phone: "123" } }), context);

    expect(messages[0]!.href).toBeNull();
  });

  it("greets by first name only", () => {
    const messages = quickMessages(booking({ customer: { ...booking().customer, name: "María Fernanda Núñez" } }), context);

    expect(decoded(messages[0]!.href)).toMatch(/^Hola María, /);
  });
});

describe("attendanceIsDue", () => {
  it("is true for a confirmed booking in the day before it starts", () => {
    expect(attendanceIsDue(booking(), NOW)).toBe(true);
  });

  it("is false earlier, once it started, for another status, or once the customer is there", () => {
    expect(attendanceIsDue(booking({ starts_at: "2030-01-10T00:00:00Z" }), NOW)).toBe(false);
    expect(attendanceIsDue(booking({ starts_at: "2030-01-07T14:00:00Z" }), NOW)).toBe(false);
    expect(attendanceIsDue(booking({ status: "pending" }), NOW)).toBe(false);
    expect(attendanceIsDue(booking({ arrived_at: "2030-01-08T00:01:00Z" }), NOW)).toBe(false);
  });
});
