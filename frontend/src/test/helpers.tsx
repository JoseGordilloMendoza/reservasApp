import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

import { App } from "../App";
import { AuthProvider } from "../lib/auth";
import { upcomingDays } from "../lib/dates";
import type { PanelBooking, PanelBookingDetail, PanelBusiness, SessionUser } from "../lib/panelTypes";
import { setTokens } from "../lib/session";
import type { BookingDetails, PublicBusiness, Slot } from "../lib/types";

export const TZ = "America/Lima";

export const BUSINESS: PublicBusiness = {
  name: "Canchas Los Andes",
  slug: "canchas-los-andes",
  description: "Grass sintético y luces LED.",
  address: "Av. Ejército 123, Cayma",
  phone: "+51987654321",
  whatsapp: "+51987654321",
  accent: "lime",
  business_type: "court",
  timezone: TZ,
  accepting_bookings: true,
  resources: [
    { id: 1, name: "Cancha 1", services: [{ id: 11, name: "Alquiler 1 hora", duration_minutes: 60, reference_price: "60.00" }] },
    { id: 2, name: "Cancha 2", services: [{ id: 22, name: "Alquiler 1 hora", duration_minutes: 60, reference_price: "70.00" }] },
  ],
};

/** A business that offers a single thing: the "what" step is skipped. */
export const SINGLE_BUSINESS: PublicBusiness = {
  ...BUSINESS,
  resources: [BUSINESS.resources[0]!],
};

/** The slot starting at `hour` (Lima time) on the `index`-th upcoming day. Lima is UTC-5, all year. */
export function slotAt(index: number, hour: number): Slot {
  const day = upcomingDays(TZ, 14)[index]!;
  const start = new Date(`${day}T${String(hour + 5).padStart(2, "0")}:00:00Z`);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { starts_at: start.toISOString().replace(".000", ""), ends_at: end.toISOString().replace(".000", "") };
}

export function bookingDetails(overrides: Partial<BookingDetails> = {}): BookingDetails {
  const slot = slotAt(1, 17);
  return {
    status: "pending",
    starts_at: slot.starts_at,
    ends_at: slot.ends_at,
    expires_at: null,
    business: { name: BUSINESS.name, slug: BUSINESS.slug },
    resource: { id: 1, name: "Cancha 1" },
    service: { id: 11, name: "Alquiler 1 hora" },
    customer_name: "Rosa Quispe",
    price: "60.00",
    duration_minutes: 60,
    can_cancel: true,
    cancel_deadline: slot.starts_at,
    ...overrides,
  };
}

type Reply = { status: number; body: unknown };
/** A responder can look at the request and at its query string. */
type Responder = Reply | ((init: RequestInit | undefined, query: URLSearchParams) => Reply);

/**
 * Stand-in for the API. Keys look like "GET /public/bookings/abc/"; query strings are ignored.
 * Every call is recorded in `calls`.
 */
export function mockApi(routes: Record<string, Responder>) {
  const calls: { method: string; path: string; body: unknown }[] = [];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace(/^\/api\/v1/, "");
    const path = url.split("?")[0]!;
    const method = init?.method ?? "GET";
    calls.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined });

    const route = routes[`${method} ${path}`];
    if (!route) return { ok: false, status: 404, text: async () => JSON.stringify({ code: "not_found", detail: "No existe" }) };

    const query = new URLSearchParams(url.split("?")[1] ?? "");
    const reply = typeof route === "function" ? route(init, query) : route;
    return { ok: reply.status < 400, status: reply.status, text: async () => JSON.stringify(reply.body) };
  });

  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock };
}

export function renderApp(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="always">
        <MemoryRouter initialEntries={[path]}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MemoryRouter>
      </MotionConfig>
    </QueryClientProvider>,
  );
}


// --- business panel ----------------------------------------------------------------

export const OWNER: SessionUser = {
  id: 1,
  email: "rosa@example.com",
  name: "Rosa Quispe",
  is_platform_admin: false,
  memberships: [{ business: { name: BUSINESS.name, slug: BUSINESS.slug, status: "active" }, role: "owner" }],
};

export const PANEL_BUSINESS: PanelBusiness = {
  name: BUSINESS.name,
  slug: BUSINESS.slug,
  description: BUSINESS.description,
  address: BUSINESS.address,
  phone: BUSINESS.phone,
  whatsapp: BUSINESS.whatsapp,
  accent: "lime",
  business_type: "court",
  timezone: TZ,
  status: "active",
  subscription: null,
  support: null,
  settings: {},
  suggested_service_duration_minutes: 60,
  role: "owner",
};

let nextId = 100;

export function panelBooking(overrides: Partial<PanelBooking> = {}): PanelBooking {
  const slot = slotAt(1, 17);
  const id = overrides.id ?? nextId++;
  return {
    id,
    status: "pending",
    starts_at: slot.starts_at,
    ends_at: slot.ends_at,
    expires_at: null,
    source: "customer",
    resource: { id: 1, name: "Cancha 1" },
    service: { id: 11, name: "Alquiler 1 hora" },
    customer: { id: 5, name: "Ana Pérez", phone: "+51987654321", email: "", is_blocked: false },
    price: "60.00",
    duration_minutes: 60,
    created_at: slotAt(0, 10).starts_at,
    ...overrides,
  };
}

export function panelDetail(overrides: Partial<PanelBookingDetail> = {}): PanelBookingDetail {
  const booking = panelBooking(overrides);
  return {
    ...booking,
    events: [{ from_status: "", to_status: booking.status, actor: "customer", created_at: booking.created_at }],
    ...overrides,
  };
}

export function page<T>(results: T[], extra: { next?: string | null; count?: number } = {}) {
  return { count: extra.count ?? results.length, next: extra.next ?? null, previous: null, results };
}

/** An owner who is already signed in: the tokens exist and the account and business answer. */
export function signedInRoutes(extra: Parameters<typeof mockApi>[0] = {}) {
  setTokens("access-token", "refresh-token");
  localStorage.setItem("separa.panel.refresh.v1", "refresh-token");
  return mockApi({
    "GET /auth/me/": { status: 200, body: OWNER },
    "GET /panel/business/": { status: 200, body: PANEL_BUSINESS },
    ...extra,
  });
}
