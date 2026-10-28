import type {
  Availability,
  BookingDetails,
  CreatedBooking,
  NewBooking,
  PublicBusiness,
} from "./types";

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api/v1";

/** A failed API call. `code` is stable; `detail` is already in Spanish when it comes from a rule. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const GENERIC = "Algo salió mal. Inténtalo de nuevo en un momento.";

/** Flatten DRF validation errors ({customer: {phone: ["..."]}}) into {"customer.phone": "..."}. */
export function flattenFieldErrors(body: unknown, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  if (!body || typeof body !== "object") return result;

  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(value) && typeof value[0] === "string") {
      result[path] = value[0];
    } else if (typeof value === "string") {
      result[path] = value;
    } else if (value && typeof value === "object") {
      Object.assign(result, flattenFieldErrors(value, path));
    }
  }
  return result;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(0, "network", "No hay conexión. Revisa tu internet e inténtalo otra vez.");
  }

  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (response.ok) return body as T;

  const data = (body ?? {}) as { code?: string; detail?: string };
  if (response.status === 429) {
    throw new ApiError(429, "throttled", "Hiciste muchos intentos seguidos. Espera un momento.");
  }
  if (data.code) {
    throw new ApiError(response.status, data.code, data.detail ?? GENERIC);
  }
  if (response.status === 400) {
    const fields = flattenFieldErrors(body);
    throw new ApiError(400, "invalid", "Revisa los datos marcados.", fields);
  }
  throw new ApiError(response.status, "unknown", data.detail ?? GENERIC);
}

export const api = {
  business: (slug: string) => request<PublicBusiness>(`/public/businesses/${slug}/`),

  availability: (slug: string, params: { resource: number; service: number; from: string; to: string }) =>
    request<Availability>(
      `/public/businesses/${slug}/availability/?resource=${params.resource}&service=${params.service}` +
        `&date=${params.from}&to_date=${params.to}`,
    ),

  createBooking: (slug: string, booking: NewBooking) =>
    request<CreatedBooking>(`/public/businesses/${slug}/bookings/`, {
      method: "POST",
      body: JSON.stringify(booking),
    }),

  booking: (token: string) => request<BookingDetails>(`/public/bookings/${encodeURIComponent(token)}/`),

  cancelBooking: (token: string) =>
    request<BookingDetails>(`/public/bookings/${encodeURIComponent(token)}/cancel/`, {
      method: "POST",
    }),
};
