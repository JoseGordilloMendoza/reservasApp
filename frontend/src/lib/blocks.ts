import { addDays, dateKey, formatTime, relativeDay } from "./dates";
import type { NewBlock, PanelBlock } from "./panelTypes";
import { zonedToUtc } from "./time";

export interface BlockForm {
  /** A resource id, or "" for the whole business. */
  resource: string;
  allDay: boolean;
  fromDate: string;
  fromTime: string;
  toDate: string;
  toTime: string;
  reason: string;
}

export type BlockResult = { block: NewBlock } | { error: string };

/**
 * Turns what the owner typed (local dates and times) into the instants the API expects.
 * An all day block runs from midnight of the first day to midnight after the last one.
 */
export function buildBlock(form: BlockForm, timeZone: string): BlockResult {
  if (!form.fromDate || !form.toDate || (!form.allDay && (!form.fromTime || !form.toTime))) {
    return { error: "Elige desde cuándo y hasta cuándo." };
  }

  const starts = form.allDay
    ? zonedToUtc(form.fromDate, "00:00", timeZone)
    : zonedToUtc(form.fromDate, form.fromTime, timeZone);
  const ends = form.allDay
    ? zonedToUtc(addDays(form.toDate, 1), "00:00", timeZone)
    : zonedToUtc(form.toDate, form.toTime, timeZone);

  if (ends <= starts) return { error: "El cierre debe terminar después de empezar." };

  return {
    block: {
      resource: form.resource ? Number(form.resource) : null,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      reason: form.reason.trim(),
    },
  };
}

/** "Hoy · todo el día", "Mañana · 14:00 a 16:00", "Lun 7 ene al mié 9 ene · todo el día". */
export function describePeriod(block: Pick<PanelBlock, "starts_at" | "ends_at">, timeZone: string): string {
  const startTime = formatTime(block.starts_at, timeZone);
  const endTime = formatTime(block.ends_at, timeZone);
  const firstDay = relativeDay(block.starts_at, timeZone);

  if (startTime === "00:00" && endTime === "00:00") {
    // The end is midnight after the last closed day, so the last day is a minute earlier.
    const last = new Date(new Date(block.ends_at).getTime() - 60_000);
    const sameDay = dateKey(block.starts_at, timeZone) === dateKey(last, timeZone);
    return sameDay ? `${firstDay} · todo el día` : `${firstDay} al ${relativeDay(last.toISOString(), timeZone).toLowerCase()} · todo el día`;
  }

  if (dateKey(block.starts_at, timeZone) === dateKey(block.ends_at, timeZone)) {
    return `${firstDay} · ${startTime} a ${endTime}`;
  }
  return `${firstDay} ${startTime} a ${relativeDay(block.ends_at, timeZone).toLowerCase()} ${endTime}`;
}
