import type { Slot } from "./types";

// The API speaks UTC; people think in the business's local time.
// A "date key" is a plain local date, "2030-01-07".

const LOCALE = "es-PE";

function formatter(timeZone: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(LOCALE, { timeZone, ...options });
}

/** Local date of an instant, as "YYYY-MM-DD". */
export function dateKey(iso: string | Date, timeZone: string): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  const parts = formatter(timeZone, { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function todayKey(timeZone: string, now: Date = new Date()): string {
  return dateKey(now, timeZone);
}

/** Add days to a date key without touching time zones. */
export function addDays(key: string, days: number): string {
  const [year = 1970, month = 1, day = 1] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function keyToUtcDate(key: string): Date {
  const [year = 1970, month = 1, day = 1] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** "LUN" */
export function weekdayShort(key: string): string {
  return formatter("UTC", { weekday: "short" })
    .format(keyToUtcDate(key))
    .replace(".", "")
    .toUpperCase();
}

export function dayNumber(key: string): number {
  return keyToUtcDate(key).getUTCDate();
}

/** "ENE" */
export function monthShort(key: string): string {
  return formatter("UTC", { month: "short" }).format(keyToUtcDate(key)).replace(".", "").toUpperCase();
}

/** "14:30" */
export function formatTime(iso: string, timeZone: string): string {
  return formatter(timeZone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}

/** "miércoles 9 de enero" */
export function formatLongDate(iso: string, timeZone: string): string {
  return formatter(timeZone, { weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
}

/** "mié 9 ene" */
export function formatShortDate(iso: string, timeZone: string): string {
  return formatter(timeZone, { weekday: "short", day: "numeric", month: "short" })
    .format(new Date(iso))
    .replaceAll(".", "");
}

/** Slots grouped by local day, each day's slots in time order. */
export function groupSlotsByDay(slots: Slot[], timeZone: string): Map<string, Slot[]> {
  const days = new Map<string, Slot[]>();
  const ordered = [...slots].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  for (const slot of ordered) {
    const key = dateKey(slot.starts_at, timeZone);
    days.set(key, [...(days.get(key) ?? []), slot]);
  }
  return days;
}

/** The next whole hour on the business clock: a sensible guess for something that starts "now". */
export function nextWholeHour(timeZone: string, now: Date = new Date()): { date: string; time: string } {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(now),
  );
  const today = todayKey(timeZone, now);
  return hour >= 23
    ? { date: addDays(today, 1), time: "00:00" }
    : { date: today, time: `${String(hour + 1).padStart(2, "0")}:00` };
}

/** The `count` days starting today, as date keys. */
export function upcomingDays(timeZone: string, count: number, now: Date = new Date()): string[] {
  const first = todayKey(timeZone, now);
  return Array.from({ length: count }, (_, index) => addDays(first, index));
}

/** "Hoy", "Mañana" or "mié 9 ene", judged by the business's calendar. */
export function relativeDay(iso: string, timeZone: string, now: Date = new Date()): string {
  const day = dateKey(iso, timeZone);
  const today = todayKey(timeZone, now);
  if (day === today) return "Hoy";
  if (day === addDays(today, 1)) return "Mañana";
  return formatShortDate(iso, timeZone);
}

/**
 * A clock time for a deadline, with the day when it is not today: "las 21:05",
 * "las 00:45 de mañana", "las 09:00 del vie 3 ene". Without the day, a time just past
 * midnight would read as if it had already gone by.
 */
export function clockLabel(iso: string, timeZone: string, now: Date = new Date()): string {
  const time = `las ${formatTime(iso, timeZone)}`;
  const day = relativeDay(iso, timeZone, now);
  if (day === "Hoy") return time;
  return day === "Mañana" ? `${time} de mañana` : `${time} del ${day}`;
}
