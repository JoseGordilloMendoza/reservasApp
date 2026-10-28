import { formatLongDate, formatTime } from "../lib/dates";
import { formatDuration, formatPrice } from "../lib/format";
import { STATUS_LABEL, shortCode } from "../lib/status";
import type { BookingDetails, BookingStatus } from "../lib/types";

/** Decorative bars derived from the code, like the stub of a real ticket. */
function Barcode({ code }: { code: string }) {
  let x = 0;
  const bars = [...code].flatMap((char, index) => {
    const value = char.charCodeAt(0);
    const width = 2 + (value % 4);
    const bar = { x, width, key: `${index}-${char}` };
    x += width + 2 + (value % 3);
    return [bar];
  });

  return (
    <svg aria-hidden="true" viewBox={`0 0 ${x} 40`} preserveAspectRatio="none" className="h-10 w-full max-w-[180px]">
      {bars.map((bar) => (
        <rect key={bar.key} x={bar.x} y={0} width={bar.width} height={40} fill="currentColor" />
      ))}
    </svg>
  );
}

/** The two half circles that make the perforation read as a tear-off line. */
function Perforation() {
  const notch =
    "absolute top-1/2 size-7 -translate-y-1/2 rounded-full border-[3px] border-line bg-paper";
  return (
    <div className="relative my-0 h-0 border-t-[3px] border-dashed border-line" aria-hidden="true">
      <span className={`${notch} -left-[17px]`} />
      <span className={`${notch} -right-[17px]`} />
    </div>
  );
}

const STAMP: Record<BookingStatus, string> = {
  // Inverted ink reads on any accent, in light and dark.
  confirmed: "bg-line text-paper border-solid",
  pending: "bg-surface text-text border-dashed",
  completed: "bg-surface text-text border-solid",
  cancelled: "bg-surface text-danger border-solid",
  expired: "bg-surface text-danger border-dashed",
  no_show: "bg-surface text-danger border-solid",
};

function Stamp({ status }: { status: BookingStatus }) {
  return (
    <span
      className={`inline-block -rotate-6 rounded-[8px] border-[3px] border-current px-3 py-1 font-display text-lg font-extrabold uppercase leading-none tracking-wide ${STAMP[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

interface Props {
  booking: BookingDetails;
  token: string;
  timeZone: string;
}

export function Ticket({ booking, token, timeZone }: Props) {
  const price = formatPrice(booking.price);
  const dead = booking.status === "cancelled" || booking.status === "expired";

  return (
    <article
      aria-label={`Boleto de ${booking.business.name}`}
      className={`relative overflow-hidden rounded-box border-[3px] border-line bg-surface text-text shadow-hard ${dead ? "opacity-80" : ""}`}
    >
      <div className="bg-accent p-5 pb-9 text-on-accent">
        <p className="font-display text-base font-bold uppercase tracking-wide">{booking.business.name}</p>
        <h2 className="mt-1 text-balance font-display text-4xl font-extrabold leading-[0.95]">
          {booking.service.name}
        </h2>
        <div className="mt-5">
          <Stamp status={booking.status} />
        </div>
      </div>

      <Perforation />

      <div className="grid gap-5 p-5">
        <div>
          <p className="font-display text-xl font-bold first-letter:uppercase">{formatLongDate(booking.starts_at, timeZone)}</p>
          <p className="mt-1 font-mono text-5xl font-bold leading-none">
            {formatTime(booking.starts_at, timeZone)}
            <span className="ml-2 text-2xl font-semibold text-muted">a {formatTime(booking.ends_at, timeZone)}</span>
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-muted">Lugar</dt>
            <dd className="font-semibold">{booking.resource.name}</dd>
          </div>
          <div>
            <dt className="text-muted">Duración</dt>
            <dd className="font-semibold">{formatDuration(booking.duration_minutes)}</dd>
          </div>
          <div>
            <dt className="text-muted">A nombre de</dt>
            <dd className="font-semibold">{booking.customer_name}</dd>
          </div>
          {price && (
            <div>
              <dt className="text-muted">Precio</dt>
              <dd className="font-mono font-bold">{price}</dd>
            </div>
          )}
        </dl>
      </div>

      <Perforation />

      <div className="flex items-center justify-between gap-4 p-5 pt-6">
        <Barcode code={shortCode(token)} />
        <p className="font-mono text-lg font-bold tracking-widest">{shortCode(token)}</p>
      </div>
    </article>
  );
}
