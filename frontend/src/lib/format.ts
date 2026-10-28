/** "60.00" -> "S/ 60", "75.50" -> "S/ 75.50". Nothing when there is no price. */
export function formatPrice(price: string | null | undefined): string | null {
  if (price === null || price === undefined || price === "") return null;
  const amount = Number(price);
  if (Number.isNaN(amount)) return null;
  const text = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `S/ ${text}`;
}

/** 60 -> "60 min", 90 -> "1 h 30 min", 120 -> "2 h". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (minutes === 60) return "60 min";
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
