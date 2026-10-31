// Shapes of the public API (see /api/docs/ on the backend).

export type Accent = "poppy" | "tangerine" | "sunflower" | "mint" | "sky" | "rose";

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "expired"
  | "no_show";

export interface PublicService {
  id: number;
  name: string;
  duration_minutes: number;
  reference_price: string | null;
}

export interface PublicResource {
  id: number;
  name: string;
  services: PublicService[];
}

export interface PublicBusiness {
  name: string;
  slug: string;
  description: string;
  address: string;
  phone: string;
  whatsapp: string;
  accent: Accent;
  business_type: string;
  timezone: string;
  /** False when the business is suspended or past due: it offers nothing to book. */
  accepting_bookings: boolean;
  resources: PublicResource[];
}

/** One business in the home page search: only what helps someone recognize it. */
export interface SearchResult {
  name: string;
  slug: string;
  business_type: string;
  accent: Accent;
  address: string;
}

/** One business in the home page showcase: the search result plus a line about it. */
export interface DirectoryEntry extends SearchResult {
  description: string;
}

export interface Slot {
  starts_at: string;
  ends_at: string;
}

export interface Availability {
  timezone: string;
  slots: Slot[];
}

export interface BookingDetails {
  /** What to show at the business: six characters, ABC-DEF when written. */
  code: string;
  payment_status: "unpaid" | "deposit" | "paid";
  payment_instructions: string;
  status: BookingStatus;
  starts_at: string;
  ends_at: string;
  expires_at: string | null;
  business: { name: string; slug: string };
  resource: { id: number; name: string };
  service: { id: number; name: string };
  customer_name: string;
  price: string | null;
  duration_minutes: number;
  can_cancel: boolean;
  cancel_deadline: string;
}

export interface CreatedBooking extends BookingDetails {
  manage_token: string;
}

export interface NewBooking {
  service: number;
  starts_at: string;
  customer: { name: string; phone: string; email: string };
  accepted_terms: boolean;
}
