// Turning a wall clock time in the business's timezone into the instant the API expects.

function offsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asIfUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asIfUtc - date.getTime()) / 60_000);
}

/** "2030-01-07" + "19:00" in America/Lima -> 2030-01-08T00:00:00Z. */
export function zonedToUtc(dateKey: string, time: string, timeZone: string): Date {
  const [year = 1970, month = 1, day = 1] = dateKey.split("-").map(Number);
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  const wallClock = Date.UTC(year, month - 1, day, hour, minute);

  const first = offsetMinutes(new Date(wallClock), timeZone);
  let instant = wallClock - first * 60_000;

  // Around a clock change the offset at the corrected instant can differ; settle on that one.
  const second = offsetMinutes(new Date(instant), timeZone);
  if (second !== first) instant = wallClock - second * 60_000;

  return new Date(instant);
}
