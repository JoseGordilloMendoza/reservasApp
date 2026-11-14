import { STATUS_LABEL } from "../lib/status";
import type { BookingStatus } from "../lib/types";

const TONE: Record<BookingStatus, string> = {
  pending: "border-dashed bg-surface text-text",
  confirmed: "bg-line text-paper",
  completed: "bg-surface text-text",
  cancelled: "bg-surface text-danger",
  expired: "border-dashed bg-surface text-danger",
  no_show: "bg-surface text-danger",
};

/** A small stamp with the state of a booking. Never relies on color alone: the word is always there. */
export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border border-current px-3 py-1 font-display text-xs font-semibold leading-none ${TONE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
