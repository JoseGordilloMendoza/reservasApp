import { describe, expect, it } from "vitest";

import { buildBlock, describePeriod } from "./blocks";
import type { BlockForm } from "./blocks";

const LIMA = "America/Lima";

const form = (overrides: Partial<BlockForm> = {}): BlockForm => ({
  resource: "",
  allDay: false,
  fromDate: "2030-01-07",
  fromTime: "14:00",
  toDate: "2030-01-07",
  toTime: "16:00",
  reason: "",
  ...overrides,
});

describe("building a block", () => {
  it("converts local times to instants", () => {
    const result = buildBlock(form(), LIMA);
    expect(result).toEqual({
      block: { resource: null, starts_at: "2030-01-07T19:00:00.000Z", ends_at: "2030-01-07T21:00:00.000Z", reason: "" },
    });
  });

  it("closes one resource when it is chosen", () => {
    expect(buildBlock(form({ resource: "3" }), LIMA)).toMatchObject({ block: { resource: 3 } });
  });

  it("trims the reason", () => {
    expect(buildBlock(form({ reason: "  Mantenimiento " }), LIMA)).toMatchObject({ block: { reason: "Mantenimiento" } });
  });

  it("runs an all day block until midnight after the last day", () => {
    const result = buildBlock(form({ allDay: true, toDate: "2030-01-08" }), LIMA);
    expect(result).toMatchObject({
      block: { starts_at: "2030-01-07T05:00:00.000Z", ends_at: "2030-01-09T05:00:00.000Z" },
    });
  });

  it("ignores the times of an all day block", () => {
    expect(buildBlock(form({ allDay: true, fromTime: "", toTime: "" }), LIMA)).toHaveProperty("block");
  });

  it("asks for the missing dates", () => {
    expect(buildBlock(form({ fromDate: "" }), LIMA)).toEqual({ error: "Elige desde cuándo y hasta cuándo." });
    expect(buildBlock(form({ toTime: "" }), LIMA)).toEqual({ error: "Elige desde cuándo y hasta cuándo." });
  });

  it("refuses an end that is not after the start", () => {
    expect(buildBlock(form({ toTime: "14:00" }), LIMA)).toEqual({ error: "El cierre debe terminar después de empezar." });
    expect(buildBlock(form({ toTime: "13:00" }), LIMA)).toHaveProperty("error");
  });
});

describe("describing a block", () => {
  const at = (date: string, time: string) => new Date(`${date}T${time}:00-05:00`).toISOString();

  it("gives the hours when it is within a day", () => {
    const text = describePeriod({ starts_at: at("2030-01-07", "14:00"), ends_at: at("2030-01-07", "16:00") }, LIMA);
    expect(text).toMatch(/· 14:00 a 16:00$/);
  });

  it("says all day for a whole day", () => {
    const text = describePeriod({ starts_at: at("2030-01-07", "00:00"), ends_at: at("2030-01-08", "00:00") }, LIMA);
    expect(text).toMatch(/· todo el día$/);
    expect(text).not.toContain(" al ");
  });

  it("gives the first and the last day of several", () => {
    const text = describePeriod({ starts_at: at("2030-01-07", "00:00"), ends_at: at("2030-01-10", "00:00") }, LIMA);
    expect(text).toMatch(/ al .*9 ene.* · todo el día$/);
  });

  it("gives both ends when it crosses midnight", () => {
    const text = describePeriod({ starts_at: at("2030-01-07", "22:00"), ends_at: at("2030-01-08", "02:00") }, LIMA);
    expect(text).toContain("22:00");
    expect(text).toContain("02:00");
    expect(text).toContain(" a ");
  });
});
