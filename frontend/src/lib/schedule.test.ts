import { describe, expect, it } from "vitest";

import { copyDayToAll, emptyWeek, nextWindow, rulesFromWeek, weekErrors, weekFromRules } from "./schedule";
import type { Week } from "./schedule";

const week = (days: Record<number, [string, string][]>): Week => {
  const result = emptyWeek();
  for (const [day, windows] of Object.entries(days)) {
    result[Number(day)] = windows.map(([start, end]) => ({ start, end }));
  }
  return result;
};

describe("reading a schedule", () => {
  it("groups the rules by weekday and drops the seconds", () => {
    const result = weekFromRules([
      { weekday: 0, start_time: "08:00:00", end_time: "12:00:00" },
      { weekday: 0, start_time: "14:00:00", end_time: "22:00:00" },
      { weekday: 5, start_time: "09:00:00", end_time: "00:00:00" },
    ]);

    expect(result[0]).toEqual([
      { start: "08:00", end: "12:00" },
      { start: "14:00", end: "22:00" },
    ]);
    expect(result[1]).toEqual([]);
    expect(result[5]).toEqual([{ start: "09:00", end: "00:00" }]);
  });

  it("orders the windows of a day by start time", () => {
    const result = weekFromRules([
      { weekday: 2, start_time: "14:00:00", end_time: "18:00:00" },
      { weekday: 2, start_time: "08:00:00", end_time: "12:00:00" },
    ]);
    expect(result[2]!.map((window) => window.start)).toEqual(["08:00", "14:00"]);
  });

  it("is closed all week when there are no rules", () => {
    expect(weekFromRules([])).toEqual(emptyWeek());
  });
});

describe("writing a schedule", () => {
  it("turns each window into a rule with its weekday", () => {
    expect(rulesFromWeek(week({ 1: [["08:00", "12:00"]], 6: [["10:00", "14:00"]] }))).toEqual([
      { weekday: 1, start_time: "08:00", end_time: "12:00" },
      { weekday: 6, start_time: "10:00", end_time: "14:00" },
    ]);
  });

  it("round trips", () => {
    const original = week({ 0: [["08:00", "12:00"], ["14:00", "22:00"]], 4: [["08:00", "00:00"]] });
    expect(weekFromRules(rulesFromWeek(original))).toEqual(original);
  });
});

describe("checking a week", () => {
  it("accepts a normal week, midnight ends and all day", () => {
    expect(weekErrors(week({ 0: [["08:00", "22:00"]], 1: [["18:00", "00:00"]], 2: [["00:00", "00:00"]] }))).toEqual({});
    expect(weekErrors(emptyWeek())).toEqual({});
  });

  it("accepts windows that touch", () => {
    expect(weekErrors(week({ 0: [["08:00", "12:00"], ["12:00", "18:00"]] }))).toEqual({});
  });

  it("refuses an end that is not after the start", () => {
    expect(weekErrors(week({ 0: [["10:00", "10:00"]] }))[0]).toMatch(/lunes debe terminar después de empezar/);
    expect(weekErrors(week({ 2: [["10:00", "09:00"]] }))[2]).toMatch(/miércoles debe terminar/);
  });

  it("refuses windows that overlap, whatever their order", () => {
    expect(weekErrors(week({ 3: [["08:00", "12:00"], ["11:00", "15:00"]] }))[3]).toBe("Los horarios del jueves se solapan.");
    expect(weekErrors(week({ 3: [["11:00", "15:00"], ["08:00", "12:00"]] }))[3]).toBe("Los horarios del jueves se solapan.");
  });

  it("treats a midnight end as the end of the day when looking for overlaps", () => {
    expect(weekErrors(week({ 4: [["18:00", "00:00"], ["20:00", "22:00"]] }))[4]).toMatch(/se solapan/);
  });

  it("asks for blank hours", () => {
    expect(weekErrors(week({ 5: [["", "12:00"]] }))[5]).toBe("Completa las horas del sábado.");
  });

  it("reports each broken day on its own", () => {
    const errors = weekErrors(week({ 0: [["10:00", "09:00"]], 6: [["08:00", "12:00"], ["10:00", "14:00"]] }));
    expect(Object.keys(errors).sort()).toEqual(["0", "6"]);
  });
});

describe("copying a day", () => {
  it("gives every day the same windows, as independent copies", () => {
    const copied = copyDayToAll(week({ 0: [["08:00", "22:00"]] }), 0);

    expect(copied.every((windows) => windows.length === 1 && windows[0]!.start === "08:00")).toBe(true);
    copied[1]![0]!.start = "09:00";
    expect(copied[0]![0]!.start).toBe("08:00");
  });

  it("closes every day when the source is closed", () => {
    expect(copyDayToAll(week({ 3: [["08:00", "12:00"]] }), 0)).toEqual(emptyWeek());
  });
});

describe("offering another window", () => {
  it("opens a day with the usual hours", () => {
    expect(nextWindow([])).toEqual({ start: "08:00", end: "22:00" });
  });

  it("continues from where the last window ends", () => {
    expect(nextWindow([{ start: "08:00", end: "12:00" }])).toEqual({ start: "12:00", end: "14:00" });
  });

  it("never runs past the end of the day", () => {
    expect(nextWindow([{ start: "08:00", end: "22:30" }])).toEqual({ start: "22:30", end: "23:59" });
  });

  it("offers blank hours when the day has no room left", () => {
    expect(nextWindow([{ start: "08:00", end: "23:00" }])).toEqual({ start: "", end: "" });
    expect(nextWindow([{ start: "08:00", end: "00:00" }])).toEqual({ start: "", end: "" });
  });
});
