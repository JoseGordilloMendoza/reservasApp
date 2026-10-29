import { OWNER } from "./helpers";
import type { PlatformBusiness, PlatformBusinessRow } from "../lib/platformTypes";

/** Someone from the platform team: no business of their own. */
export const TEAM = { ...OWNER, name: "Jose Gordillo", email: "equipo@example.com", is_platform_admin: true, memberships: [] };

export const row = (overrides: Partial<PlatformBusinessRow> = {}): PlatformBusinessRow => ({
  slug: "canchas-los-andes",
  name: "Canchas Los Andes",
  business_type: "court",
  status: "active",
  created_at: "2030-01-01T00:00:00Z",
  standing: { state: "active", valid_until: "2030-03-31", grace_ends_on: "2030-04-05", days_left: 30 },
  plan_name: "Mensual",
  price: "80.00",
  users_count: 2,
  bookings_30d: 41,
  ...overrides,
});

export const businessPage = (overrides: Partial<PlatformBusiness> = {}): PlatformBusiness => ({
  ...row(),
  subscription: {
    plan_name: "Mensual",
    price: "80.00",
    started_on: "2030-01-01",
    valid_until: "2030-03-31",
    notes: "",
    updated_at: "2030-01-01T00:00:00Z",
  },
  suspended_reason: "",
  timezone: "America/Lima",
  accent: "lime",
  description: "",
  address: "",
  phone: "",
  whatsapp: "",
  ...overrides,
});
