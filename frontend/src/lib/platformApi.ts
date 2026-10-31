import { authed } from "./panelApi";
import type {
  ActivityEntry,
  ActivityFilters,
  BusinessFilters,
  AddedMember,
  CreatedBusiness,
  Dashboard,
  Member,
  NewMember,
  NewPayment,
  NewPlatformBusiness,
  Page,
  Payment,
  PlatformBusiness,
  PlatformBusinessRow,
  PlatformSubscription,
  SubscriptionChanges,
  SupportSession,
} from "./platformTypes";

function query(params: Record<string, string | undefined>, page: number): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value?.trim()) search.set(key, value.trim());
  if (page > 1) search.set("page", String(page));
  const text = search.toString();
  return text ? `?${text}` : "";
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

const base = (slug: string) => `/platform/businesses/${encodeURIComponent(slug)}`;

export const platformApi = {
  dashboard: () => authed<Dashboard>("/platform/dashboard/"),

  businesses: (filters: BusinessFilters = {}, page = 1) =>
    authed<Page<PlatformBusinessRow>>(`/platform/businesses/${query({ q: filters.q, filter: filters.filter }, page)}`),

  business: (slug: string) => authed<PlatformBusiness>(`${base(slug)}/`),

  createBusiness: (business: NewPlatformBusiness) =>
    authed<CreatedBusiness>("/platform/businesses/", json("POST", business)),

  suspend: (slug: string, reason: string) => authed<PlatformBusiness>(`${base(slug)}/suspend/`, json("POST", { reason })),

  reactivate: (slug: string) => authed<PlatformBusiness>(`${base(slug)}/reactivate/`, json("POST")),

  saveSubscription: (slug: string, changes: SubscriptionChanges) =>
    authed<PlatformSubscription>(`${base(slug)}/subscription/`, json("PUT", changes)),

  payments: (slug: string) => authed<Payment[]>(`${base(slug)}/payments/`),

  recordPayment: (slug: string, payment: NewPayment) => authed<Payment>(`${base(slug)}/payments/`, json("POST", payment)),

  members: (slug: string) => authed<Member[]>(`${base(slug)}/users/`),

  addMember: (slug: string, member: NewMember) =>
    authed<AddedMember>(`${base(slug)}/users/`, json("POST", member)),

  changeRole: (slug: string, id: number, role: Member["role"]) =>
    authed<Member>(`${base(slug)}/users/${id}/`, json("PATCH", { role })),

  removeMember: (slug: string, id: number) => authed<null>(`${base(slug)}/users/${id}/`, json("DELETE")),

  temporaryPassword: (slug: string, id: number) =>
    authed<{ temporary_password: string }>(`${base(slug)}/users/${id}/temporary-password/`, json("POST")),

  sendAccessLink: (slug: string, id: number) =>
    authed<{ detail: string }>(`${base(slug)}/users/${id}/send-link/`, json("POST")),

  startSupport: (slug: string, reason: string) =>
    authed<SupportSession>(`${base(slug)}/support-session/`, json("POST", { reason })),

  endSupport: (id: number) => authed<SupportSession>(`/platform/support-sessions/${id}/end/`, json("POST")),

  activity: (filters: ActivityFilters = {}, page = 1) =>
    authed<Page<ActivityEntry>>(`/platform/activity/${query({ business: filters.business, kind: filters.kind }, page)}`),
};
