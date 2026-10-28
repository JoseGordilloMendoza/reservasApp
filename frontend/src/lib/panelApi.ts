import { ApiError, request } from "./http";
import type {
  BookingAction,
  BookingFilters,
  BusinessChanges,
  CustomerDetail,
  CustomerFilters,
  CustomerSummary,
  CreatedBlock,
  NewBlock,
  PanelBlock,
  PanelResource,
  ScheduleRule,
  ServiceInput,
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

function customerQuery(filters: CustomerFilters, page: number): string {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.blocked !== undefined) params.set("blocked", String(filters.blocked));
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

  customers: (filters: CustomerFilters = {}, page = 1) =>
    authed<Page<CustomerSummary>>(`/panel/customers/${customerQuery(filters, page)}`),

  customer: (id: number) => authed<CustomerDetail>(`/panel/customers/${id}/`),

  updateCustomer: (id: number, changes: { name?: string; email?: string; is_blocked?: boolean }) =>
    authed<CustomerDetail>(`/panel/customers/${id}/`, { method: "PATCH", body: JSON.stringify(changes) }),

  updateBusiness: (changes: BusinessChanges) =>
    authed<PanelBusiness>("/panel/business/", { method: "PATCH", body: JSON.stringify(changes) }),

  createResource: (name: string) =>
    authed<PanelResource>("/panel/resources/", { method: "POST", body: JSON.stringify({ name }) }),

  updateResource: (id: number, changes: { name?: string; is_active?: boolean }) =>
    authed<PanelResource>(`/panel/resources/${id}/`, { method: "PATCH", body: JSON.stringify(changes) }),

  deleteResource: (id: number) => authed<null>(`/panel/resources/${id}/`, { method: "DELETE" }),

  schedule: (resourceId: number) =>
    authed<{ rules: ScheduleRule[] }>(`/panel/resources/${resourceId}/schedule/`),

  saveSchedule: (resourceId: number, rules: ScheduleRule[]) =>
    authed<{ rules: ScheduleRule[] }>(`/panel/resources/${resourceId}/schedule/`, {
      method: "PUT",
      body: JSON.stringify({ rules }),
    }),

  createService: (service: ServiceInput) =>
    authed<PanelService>("/panel/services/", { method: "POST", body: JSON.stringify(service) }),

  updateService: (id: number, changes: ServiceInput) =>
    authed<PanelService>(`/panel/services/${id}/`, { method: "PATCH", body: JSON.stringify(changes) }),

  deleteService: (id: number) => authed<null>(`/panel/services/${id}/`, { method: "DELETE" }),

  resources: () => authed<Page<PanelResource>>("/panel/resources/?page_size=200"),

  blocks: () => authed<Page<PanelBlock>>("/panel/blocks/?page_size=200"),

  createBlock: (block: NewBlock) =>
    authed<CreatedBlock>("/panel/blocks/", { method: "POST", body: JSON.stringify(block) }),

  deleteBlock: (id: number) => authed<null>(`/panel/blocks/${id}/`, { method: "DELETE" }),

  services: () => authed<Page<PanelService>>("/panel/services/?page_size=200"),
};
