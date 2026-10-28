import type { ScheduleRule } from "./panelTypes";

// A week of opening hours as the editor holds it: one list of windows per weekday,
// Monday first, the same order as the API (0 = Monday ... 6 = Sunday).

export interface Window {
  start: string;
  end: string;
}

export type Week = Window[][];

export const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/** The hours a day gets when the owner opens it for the first time. */
export const DEFAULT_WINDOW: Window = { start: "08:00", end: "22:00" };

const hhmm = (time: string) => time.slice(0, 5);

export function emptyWeek(): Week {
  return WEEKDAYS.map(() => []);
}

export function weekFromRules(rules: ScheduleRule[]): Week {
  const week = emptyWeek();
  for (const rule of rules) {
    week[rule.weekday]?.push({ start: hhmm(rule.start_time), end: hhmm(rule.end_time) });
  }
  for (const windows of week) windows.sort((a, b) => a.start.localeCompare(b.start));
  return week;
}

export function rulesFromWeek(week: Week): ScheduleRule[] {
  return week.flatMap((windows, weekday) =>
    windows.map((window) => ({ weekday, start_time: window.start, end_time: window.end })),
  );
}

/** "24:00" is how a window that runs until midnight is written for comparing. */
const minutesOf = (time: string, isEnd: boolean) => {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  const total = hours * 60 + minutes;
  // An end of 00:00 means midnight, the end of the day.
  return isEnd && total === 0 ? 24 * 60 : total;
};

/** One complaint per weekday that has a problem. Empty when the week can be saved. */
export function weekErrors(week: Week): Record<number, string> {
  const errors: Record<number, string> = {};

  week.forEach((windows, weekday) => {
    const name = WEEKDAYS[weekday]!.toLowerCase();
    const blank = windows.some((window) => !window.start || !window.end);
    if (blank) {
      errors[weekday] = `Completa las horas del ${name}.`;
      return;
    }

    // 00:00 to 00:00 means open all day, which is the one case where end is not after start.
    const spans = windows.map((window) =>
      window.start === "00:00" && window.end === "00:00"
        ? { start: 0, end: 24 * 60 }
        : { start: minutesOf(window.start, false), end: minutesOf(window.end, true) },
    );

    if (spans.some((span) => span.end <= span.start)) {
      errors[weekday] = `El ${name} debe terminar después de empezar (00:00 es medianoche).`;
      return;
    }

    const sorted = [...spans].sort((a, b) => a.start - b.start);
    if (sorted.some((span, index) => index > 0 && span.start < sorted[index - 1]!.end)) {
      errors[weekday] = `Los horarios del ${name} se solapan.`;
    }
  });

  return errors;
}

/** The week with `from`'s windows copied onto every day. */
export function copyDayToAll(week: Week, from: number): Week {
  return week.map((_, weekday) => week[from]!.map((window) => ({ ...window })));
}
