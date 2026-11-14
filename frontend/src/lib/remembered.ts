// "Remember my data": the name, phone and email a customer typed, kept on their own device so the next booking
// starts filled in. It never goes anywhere else. Accepting the terms is NOT kept: it is asked on every booking.

const KEY = "separa.me.v1";

export interface RememberedData {
  name: string;
  phone: string;
  email: string;
}

export function readRemembered(): RememberedData | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!parsed || typeof parsed !== "object") return null;
    const { name, phone, email } = parsed as Partial<RememberedData>;
    if (typeof name !== "string" || typeof phone !== "string") return null;
    if (!name.trim() && !phone.trim()) return null;
    return { name, phone, email: typeof email === "string" ? email : "" };
  } catch {
    return null;
  }
}

export function saveRemembered(data: RememberedData) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ name: data.name.trim(), phone: data.phone.trim(), email: data.email.trim() }));
  } catch {
    // Storage can be blocked (private mode): the next booking just starts empty.
  }
}

export function forgetRemembered() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to forget if nothing could be kept.
  }
}
