import { describe, expect, it } from "vitest";

import {
  addDays,
  clockLabel,
  dateKey,
  dayNumber,
  formatLongDate,
  formatShortDate,
  formatTime,
  groupSlotsByDay,
  monthShort,
  nextWholeHour,
  relativeDay,
  todayKey,
  upcomingDays,
  weekdayShort,
} from "./dates";

const LIMA = "America/Lima";
// 2030-01-08 00:00 UTC is still Monday 7 January, 19:00 in Lima.
const MONDAY_EVENING = "2030-01-08T00:00:00Z";

describe("local time of the business", () => {
  it("reads the date in the business timezone, not UTC", () => {
    expect(dateKey(MONDAY_EVENING, LIMA)).toBe("2030-01-07");
    expect(dateKey(MONDAY_EVENING, "UTC")).toBe("2030-01-08");
  });

  it("formats the time with a 24 hour clock", () => {
    expect(formatTime(MONDAY_EVENING, LIMA)).toBe("19:00");
    expect(formatTime("2030-01-08T17:05:00Z", LIMA)).toBe("12:05");
  });

  it("writes dates in Spanish", () => {
    expect(formatLongDate(MONDAY_EVENING, LIMA)).toMatch(/lunes.*7 de enero/);
    expect(formatShortDate(MONDAY_EVENING, LIMA)).toMatch(/lun.*7 ene/);
    expect(formatShortDate(MONDAY_EVENING, LIMA)).not.toContain(".");
  });

  it("knows what day it is for the business", () => {
    const lateMondayInLima = new Date("2030-01-08T03:00:00Z");

    expect(todayKey(LIMA, lateMondayInLima)).toBe("2030-01-07");
    expect(todayKey("UTC", lateMondayInLima)).toBe("2030-01-08");
  });
});

describe("date keys", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2030-01-31", 1)).toBe("2030-02-01");
    expect(addDays("2030-12-31", 1)).toBe("2031-01-01");
    expect(addDays("2032-02-28", 1)).toBe("2032-02-29");
    expect(addDays("2030-03-01", -1)).toBe("2030-02-28");
  });

  it("describes a day", () => {
    expect(weekdayShort("2030-01-07")).toBe("LUN");
    expect(weekdayShort("2030-01-13")).toBe("DOM");
    expect(dayNumber("2030-01-07")).toBe(7);
    expect(monthShort("2030-01-07")).toBe("ENE");
  });

  it("lists the upcoming days starting today", () => {
    const now = new Date("2030-01-08T03:00:00Z");

    expect(upcomingDays(LIMA, 3, now)).toEqual(["2030-01-07", "2030-01-08", "2030-01-09"]);
  });
});

describe("grouping slots by day", () => {
  const slot = (start: string) => ({ starts_at: start, ends_at: start });

  it("groups by the local day, even across the UTC midnight", () => {
    const groups = groupSlotsByDay(
      [
        slot("2030-01-08T05:00:00Z"), // Tuesday 00:00 in Lima
        slot("2030-01-08T00:00:00Z"), // Monday 19:00
        slot("2030-01-08T01:00:00Z"), // Monday 20:00
      ],
      LIMA,
    );

    expect([...groups.keys()]).toEqual(["2030-01-07", "2030-01-08"]);
    expect(groups.get("2030-01-07")?.map((s) => formatTime(s.starts_at, LIMA))).toEqual(["19:00", "20:00"]);
    expect(groups.get("2030-01-08")).toHaveLength(1);
  });

  it("returns nothing for no slots", () => {
    expect(groupSlotsByDay([], LIMA).size).toBe(0);
  });
});

describe("relativeDay", () => {
  const now = new Date("2030-01-08T15:00:00Z"); // Tuesday 8 January, 10:00 in Lima

  it("says today and tomorrow by the business calendar", () => {
    expect(relativeDay("2030-01-08T23:00:00Z", LIMA, now)).toBe("Hoy");
    expect(relativeDay("2030-01-09T23:00:00Z", LIMA, now)).toBe("Mañana");
  });

  it("uses the business day even when UTC is already on the next one", () => {
    // 02:00 UTC on the 9th is still the evening of the 8th in Lima.
    expect(relativeDay("2030-01-09T02:00:00Z", LIMA, now)).toBe("Hoy");
  });

  it("writes any other day out", () => {
    expect(relativeDay("2030-01-12T23:00:00Z", LIMA, now)).toMatch(/sáb.*12 ene/);
    expect(relativeDay("2030-01-05T23:00:00Z", LIMA, now)).toMatch(/sáb.*5 ene/);
  });
});

describe("clockLabel", () => {
  const now = new Date("2030-01-08T15:00:00Z"); // Tuesday 8 January, 10:00 in Lima

  it("is just the time when it is still today", () => {
    expect(clockLabel("2030-01-09T02:00:00Z", LIMA, now)).toBe("las 21:00");
  });

  it("says tomorrow when just past midnight", () => {
    expect(clockLabel("2030-01-09T05:45:00Z", LIMA, now)).toBe("las 00:45 de mañana");
  });

  it("names the day when it is further away", () => {
    expect(clockLabel("2030-01-12T14:00:00Z", LIMA, now)).toMatch(/^las 09:00 del sáb.*12 ene$/);
  });
});

describe("the next whole hour", () => {
  it("rounds up on the business clock", () => {
    // 19:00 in Lima is 00:00 UTC of the next day; 19:20 -> 20:00 the same Lima day.
    expect(nextWholeHour(LIMA, new Date("2030-01-08T00:20:00Z"))).toEqual({ date: "2030-01-07", time: "20:00" });
  });

  it("rolls over to the next day after 23:00", () => {
    // 23:30 in Lima.
    expect(nextWholeHour(LIMA, new Date("2030-01-08T04:30:00Z"))).toEqual({ date: "2030-01-08", time: "00:00" });
  });
});
