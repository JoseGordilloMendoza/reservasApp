// Shapes of the platform API, the one only the team uses (see /api/docs/ on the backend).
import type { Page } from "./panelTypes";

export type { Page };

export type StandingState = "none" | "active" | "grace" | "expired";

export interface Standing {
  state: StandingState;
  /** Last covered day, "YYYY-MM-DD". Null when the business has no subscription. */
  valid_until: string | null;
  grace_ends_on: string | null;
  /** Days until valid_until; negative once it passed. */
  days_left: number | null;
}

export type BusinessKind = "generic" | "court" | "psychologist";

export interface PlatformBusinessRow {
  slug: string;
  name: string;
  business_type: BusinessKind;
  status: "active" | "suspended";
  created_at: string;
  standing: Standing;
  plan_name: string | null;
  price: string | null;
  users_count: number;
  bookings_30d: number;
}

export interface PlatformSubscription {
  plan_name: string;
  price: string;
  started_on: string;
  valid_until: string;
  notes: string;
  updated_at: string;
}

export interface PlatformBusiness extends PlatformBusinessRow {
  subscription: PlatformSubscription | null;
  suspended_reason: string;
  timezone: string;
  accent: string;
  description: string;
  address: string;
  phone: string;
  whatsapp: string;
}

export type BusinessFilter = "active" | "suspended" | "past_due" | "expiring" | "no_subscription";

export interface BusinessFilters {
  q?: string;
  filter?: BusinessFilter;
}

export interface AttentionItem {
  slug: string;
  name: string;
  state: StandingState;
  valid_until: string | null;
  days_left: number | null;
  suspended: boolean;
}

export interface Dashboard {
  businesses: { total: number; active: number; suspended: number };
  subscriptions: { active: number; expiring_soon: number; grace: number; expired: number; without_subscription: number };
  revenue: { received_this_month: number | string; expected_monthly: number | string };
  bookings_30d: number;
  busiest: { slug: string; name: string; bookings: number }[];
  attention: AttentionItem[];
}

export type PaymentMethod = "yape" | "plin" | "transfer" | "cash" | "other";

export interface Payment {
  id: number;
  amount: string;
  method: PaymentMethod;
  paid_on: string;
  months: number;
  period_start: string;
  period_end: string;
  reference: string;
  note: string;
  recorded_by: string | null;
  created_at: string;
}

export interface NewPayment {
  amount: string;
  method: PaymentMethod;
  months: number;
  paid_on?: string;
  reference?: string;
  note?: string;
}

export interface SubscriptionChanges {
  plan_name?: string;
  price?: string;
  valid_until?: string;
  notes?: string;
  /** Required when valid_until moves. */
  reason?: string;
}

export interface Member {
  id: number;
  email: string;
  name: string;
  role: "owner" | "staff";
  is_active: boolean;
  last_login: string | null;
  has_password: boolean;
  uses_google: boolean;
  created_at: string;
}

/** How a new account gets in: an email to choose a password, or a temporary one the team hands over. */
export type Delivery = "email" | "credentials";

export interface NewMember {
  email: string;
  first_name?: string;
  last_name?: string;
  role: "owner" | "staff";
  delivery?: Delivery;
}

export interface AddedMember extends Member {
  account_created: boolean;
  /** Only when a temporary password was asked for and the account is new. Shown once. */
  temporary_password: string | null;
}

export interface ActivityEntry {
  id: number;
  actor_email: string;
  business_slug: string;
  action: string;
  detail: Record<string, unknown>;
  created_at: string;
}

export type ActivityKind = "business" | "subscription" | "payment" | "user" | "support";

export interface ActivityFilters {
  business?: string;
  kind?: ActivityKind;
}

export interface NewPlatformBusiness {
  name: string;
  slug?: string;
  business_type: BusinessKind;
  owner: { email: string; first_name?: string; last_name?: string };
  subscription: { plan_name?: string; price: string; trial_days?: number; valid_until?: string };
  delivery?: Delivery;
}

export interface CreatedBusiness extends PlatformBusiness {
  owner: { email: string; account_created: boolean; temporary_password: string | null };
}

export interface SupportSession {
  id: number;
  business: string;
  reason: string;
  started_at: string;
  expires_at: string;
}
