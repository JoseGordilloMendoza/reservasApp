import { ApiError, request } from "./http";
import type {
  BookingAction,
  BookingFilters,
  NewPanelBooking,
  Page,
  PanelBooking,
  PanelBookingDetail,
  PanelBusiness,
  PanelCreatedBooking,
  PanelService,
  Session,
  SessionUser,
} from "./panelTypes";
import { getAccessToken, getBusinessSlug, refreshAccess } from "./session";

const SIGNED_OUT = "Tu sesión terminó. Entra otra vez.";

/**
 * A call that needs the owner's token. If the token is missing or expired it is renewed once and
 * the call is repeated; if that fails too the session is over and the error says so.
 */
export async function authed<T>(path: string, init: RequestInit = {}): Promise<T> {
  const attempt = (token: string) => {
    const business = getBusinessSlug();
    return request<T>(path, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${token}`,
        ...(business ? { "X-Business": business } : {}),
      },
    });
  };

  const token = getAccessToken() ?? (await refreshAccess());
  if (!token) throw new ApiError(401, "not_signed_in", SIGNED_OUT);

  try {
    return await attempt(token);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    const fresh = await refreshAccess();
    if (!fresh) throw new ApiError(401, "not_signed_in", SIGNED_OUT);
    return attempt(fresh);
  }
}

function bookingQuery(filters: BookingFilters, page: number): string {
  const params = new URLSearchParams();
  if (filters.status?.length) params.set("status", filters.status.join(","));
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.ordering) params.set("ordering", filters.ordering);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `?${query}` : "";
}

export const panelApi = {
  // Signing in does not need a token yet.
  login: (email: string, password: string) =>
    request<Session>("/auth/login/", { method: "POST", body: JSON.stringify({ email, password }) }),

  loginWithGoogle: (credential: string) =>
    request<Session>("/auth/google/", { method: "POST", body: JSON.stringify({ credential }) }),

  me: () => authed<SessionUser>("/auth/me/"),

  logout: (refresh: string) =>
    request<unknown>("/auth/logout/", { method: "POST", body: JSON.stringify({ refresh }) }),

  business: () => authed<PanelBusiness>("/panel/business/"),

  bookings: (filters: BookingFilters = {}, page = 1) =>
    authed<Page<PanelBooking>>(`/panel/bookings/${bookingQuery(filters, page)}`),

  booking: (id: number) => authed<PanelBookingDetail>(`/panel/bookings/${id}/`),

  act: (id: number, action: BookingAction) =>
    authed<PanelBookingDetail>(`/panel/bookings/${id}/${action}/`, { method: "POST" }),

  createBooking: (booking: NewPanelBooking) =>
    authed<PanelCreatedBooking>("/panel/bookings/", { method: "POST", body: JSON.stringify(booking) }),

  services: () => authed<Page<PanelService>>("/panel/services/?page_size=200"),
};
