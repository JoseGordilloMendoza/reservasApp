// Shapes of the business panel API (see /api/docs/ on the backend).
import type { Accent, BookingStatus } from "./types";

export type Role = "owner" | "staff";

export interface Membership {
  business: { name: string; slug: string; status: "active" | "suspended" };
  role: Role;
}

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  is_platform_admin: boolean;
  memberships: Membership[];
}

export interface Session {
  access: string;
  refresh: string;
  user: SessionUser;
}

export interface PanelBusiness {
  name: string;
  slug: string;
  description: string;
  address: string;
  phone: string;
  whatsapp: string;
  accent: Accent;
  business_type: string;
  timezone: string;
  status: "active" | "suspended";
  settings: Record<string, number | string>;
  suggested_service_duration_minutes: number;
  role: Role;
}

export interface PanelCustomer {
  id: number;
  name: string;
  phone: string;
  email: string;
  is_blocked: boolean;
}

export interface PanelBooking {
  id: number;
  status: BookingStatus;
  starts_at: string;
  ends_at: string;
  expires_at: string | null;
  source: "customer" | "business";
  resource: { id: number; name: string };
  service: { id: number; name: string };
  customer: PanelCustomer;
  price: string | null;
  duration_minutes: number;
  created_at: string;
}

export interface BookingEvent {
  from_status: BookingStatus | "";
  to_status: BookingStatus;
  actor: "customer" | "business" | "system";
  created_at: string;
}

export interface PanelBookingDetail extends PanelBooking {
  events: BookingEvent[];
}

export interface PanelCreatedBooking extends PanelBookingDetail {
  manage_token: string;
}

export interface PanelService {
  id: number;
  resource: { id: number; name: string };
  name: string;
  duration_minutes: number;
  reference_price: string | null;
  is_active: boolean;
}

export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type BookingAction = "confirm" | "reject" | "cancel" | "complete" | "no-show";

export interface BookingFilters {
  status?: BookingStatus[];
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  ordering?: "starts_at" | "-starts_at";
}

export interface NewPanelBooking {
  service: number;
  starts_at: string;
  customer: { name: string; phone: string; email: string };
}
