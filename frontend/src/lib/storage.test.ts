import { describe, expect, it, vi } from "vitest";

import { forgetBooking, listSavedBookings, saveBooking } from "./storage";

const booking = (token: string) => ({ slug: "cancha-los-andes", token, businessName: "Cancha Los Andes" });

describe("saved bookings", () => {
  it("starts empty", () => {
    expect(listSavedBookings()).toEqual([]);
  });

  it("keeps what was saved, newest first", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T10:00:00Z"));
    saveBooking(booking("a"));
    vi.setSystemTime(new Date("2030-01-02T10:00:00Z"));
    saveBooking(booking("b"));
    vi.useRealTimers();

    expect(listSavedBookings().map((item) => item.token)).toEqual(["b", "a"]);
  });

  it("does not duplicate a booking saved twice", () => {
    saveBooking(booking("a"));
    saveBooking(booking("a"));

    expect(listSavedBookings()).toHaveLength(1);
  });

  it("forgets one booking only", () => {
    saveBooking(booking("a"));
    saveBooking(booking("b"));

    forgetBooking("a");

    expect(listSavedBookings().map((item) => item.token)).toEqual(["b"]);
  });

  it("survives corrupted data", () => {
    localStorage.setItem("separa.bookings.v1", "{not json");

    expect(listSavedBookings()).toEqual([]);
  });

  it("ignores entries of the wrong shape", () => {
    localStorage.setItem("separa.bookings.v1", JSON.stringify([{ nope: true }, null, "x"]));

    expect(listSavedBookings()).toEqual([]);
  });

  it("keeps working when storage is blocked", () => {
    const blocked = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => saveBooking(booking("a"))).not.toThrow();

    blocked.mockRestore();
  });
});
