import { ApiError, flattenFieldErrors, request } from "./http";
import type {
  Availability,
  BookingDetails,
  CreatedBooking,
  NewBooking,
  DirectoryEntry,
  PublicBusiness,
  SearchResult,
} from "./types";

// The HTTP core is shared with the business panel; these re-exports keep existing imports working.
export { ApiError, flattenFieldErrors };

export const api = {
  business: (slug: string) => request<PublicBusiness>(`/public/businesses/${slug}/`),

  search: (typed: string) =>
    request<{ results: SearchResult[] }>(`/public/search/?q=${encodeURIComponent(typed)}`),

  directory: () => request<{ results: DirectoryEntry[] }>("/public/directory/"),

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
