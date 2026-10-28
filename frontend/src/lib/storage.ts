// Customers have no account, so their booking tickets are kept on their own device.

const KEY = "separa.bookings.v1";

export interface SavedBooking {
  slug: string;
  token: string;
  businessName: string;
  /** Timezone of the business, so the saved list can show local times. */
  timeZone?: string;
  savedAt: string;
}

export const DEFAULT_TIME_ZONE = "America/Lima";

function read(): SavedBooking[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SavedBooking =>
        !!item && typeof item.token === "string" && typeof item.slug === "string",
    );
  } catch {
    return [];
  }
}

function write(items: SavedBooking[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Storage can be blocked (private mode); the ticket still works through its link.
  }
}

export function listSavedBookings(): SavedBooking[] {
  return read().sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function saveBooking(booking: Omit<SavedBooking, "savedAt">) {
  const others = read().filter((item) => item.token !== booking.token);
  write([...others, { ...booking, savedAt: new Date().toISOString() }]);
}

export function forgetBooking(token: string) {
  write(read().filter((item) => item.token !== token));
}
