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

export interface SubscriptionNotice {
  state: "active" | "grace" | "expired";
  /** Last covered day, "YYYY-MM-DD". */
  valid_until: string;
  /** Last day the business keeps working after the subscription ended. */
  grace_ends_on: string;
  /** Days until valid_until; negative once it passed. */
  days_left: number;
}

export interface PanelBusiness {
  name: string;
  slug: string;
  description: string;
  address: string;
  phone: string;
  whatsapp: string;
  accent: Accent;
  /** Whether the home page search may show this business. */
  listed: boolean;
  /** How a customer pays this business; it goes on their booking. */
  payment_instructions: string;
  business_type: string;
  timezone: string;
  status: "active" | "suspended";
  /** Null when the business has no subscription, which never expires. */
  subscription: SubscriptionNotice | null;
  /** Set only while the platform team is inside this business for support. */
  support: { session: number; reason: string; expires_at: string; user: string } | null;
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

/** A customer as the customer list shows it. */
export interface CustomerSummary extends PanelCustomer {
  created_at: string;
  bookings_count: number;
  last_booking_at: string | null;
}

export interface CustomerBooking {
  id: number;
  status: BookingStatus;
  starts_at: string;
  ends_at: string;
  resource: { id: number; name: string };
  service: { id: number; name: string };
}

export interface CustomerDetail extends CustomerSummary {
  bookings: CustomerBooking[];
}

export interface CustomerFilters {
  q?: string;
  /** Only blocked (true) or only allowed (false) customers. */
  blocked?: boolean;
}

export type PaymentStatus = "unpaid" | "deposit" | "paid";
export type PaymentMethod = "yape" | "plin" | "transfer" | "cash" | "other";

export interface PanelBooking {
  id: number;
  /** What the customer shows at the business: six characters, ABC-DEF when written. */
  code: string;
  status: BookingStatus;
  payment_status: PaymentStatus;
  amount_paid: string;
  payment_method: PaymentMethod | "";
  /** What is still owed; null when the service has no price. */
  balance: string | null;
  arrived_at: string | null;
  internal_note: string;
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

export interface PanelResource {
  id: number;
  name: string;
  is_active: boolean;
  position: number;
}

export interface PanelBlock {
  id: number;
  /** Null when the whole business is closed. */
  resource: { id: number; name: string } | null;
  starts_at: string;
  ends_at: string;
  reason: string;
}

export interface ConflictingBooking {
  id: number;
  status: BookingStatus;
  starts_at: string;
  ends_at: string;
  resource: { id: number; name: string };
  customer_name: string;
}

export interface CreatedBlock extends PanelBlock {
  conflicting_bookings: ConflictingBooking[];
}

export interface NewBlock {
  resource: number | null;
  starts_at: string;
  ends_at: string;
  reason: string;
}

export interface BusinessChanges {
  name?: string;
  description?: string;
  address?: string;
  phone?: string;
  whatsapp?: string;
  accent?: Accent;
  listed?: boolean;
  payment_instructions?: string;
  /** Only the options to change; the server keeps the rest. */
  settings?: Record<string, number | string>;
}

export interface ScheduleRule {
  /** 0 = Monday ... 6 = Sunday. */
  weekday: number;
  /** "HH:MM" or "HH:MM:SS", local time of the business. "00:00" as an end means midnight. */
  start_time: string;
  end_time: string;
}

export interface ServiceInput {
  /** Needed to create; a service cannot move to another resource. */
  resource_id?: number;
  name?: string;
  duration_minutes?: number;
  reference_price?: string | null;
  is_active?: boolean;
}

export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type BookingAction = "confirm" | "reject" | "cancel" | "complete" | "no-show";

/** What the owner writes down about a booking; only what is sent changes. */
export interface BookingRecordChanges {
  payment_status?: PaymentStatus;
  amount_paid?: string;
  payment_method?: PaymentMethod | "";
  internal_note?: string;
  arrived?: boolean;
}

export interface BookingFilters {
  /** Only what still stands or was attended and is not fully paid. */
  balance?: boolean;
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
