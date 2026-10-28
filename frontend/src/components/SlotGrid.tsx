import { formatTime } from "../lib/dates";
import type { Slot } from "../lib/types";

interface Props {
  slots: Slot[];
  timeZone: string;
  selected: string | null;
  onSelect: (startsAt: string) => void;
  /** Start of the earliest slot on offer, tagged so the nearest option is obvious. */
  nearest: string | null;
}

/** Free times as entries. The earliest one carries a small tag. */
export function SlotGrid({ slots, timeZone, selected, onSelect, nearest }: Props) {
  return (
    <div role="radiogroup" aria-label="Hora" className="grid grid-cols-3 gap-3 sm:grid-cols-4">
      {slots.map((slot) => {
        const active = slot.starts_at === selected;
        const time = formatTime(slot.starts_at, timeZone);
        const isNearest = slot.starts_at === nearest;

        return (
          <button
            key={slot.starts_at}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={isNearest ? `${time}, el más cercano` : time}
            onClick={() => onSelect(slot.starts_at)}
            className={
              "press relative min-h-[60px] rounded-box border-[3px] border-line font-mono text-xl font-bold " +
              (active ? "bg-accent text-on-accent shadow-hard" : "bg-surface text-text shadow-hard-sm")
            }
          >
            {time}
            {isNearest && (
              <span
                aria-hidden="true"
                className="absolute -right-2 -top-3 rotate-6 rounded-[6px] border-[3px] border-line bg-line px-1.5 py-0.5 font-sans text-[10px] font-extrabold uppercase leading-none tracking-wide text-paper"
              >
                Próximo
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
