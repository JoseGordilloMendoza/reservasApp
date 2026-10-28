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
      className={`inline-block -rotate-3 whitespace-nowrap rounded-[8px] border-[3px] border-current px-2 py-1 font-display text-sm font-extrabold uppercase leading-none tracking-wide ${TONE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
