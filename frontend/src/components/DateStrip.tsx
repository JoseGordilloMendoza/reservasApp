import { useEffect, useRef } from "react";

import { dayNumber, monthShort, weekdayShort } from "../lib/dates";

interface Props {
  days: string[];
  /** Days that have at least one free slot. */
  available: Set<string>;
  selected: string | null;
  onSelect: (day: string) => void;
}

function dayLabel(index: number, day: string) {
  if (index === 0) return "HOY";
  if (index === 1) return "MAÑ";
  return weekdayShort(day);
}

/** Two weeks as chunky tiles. Closed days are hatched and cannot be pressed. */
export function DateStrip({ days, available, selected, onSelect }: Props) {
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [selected]);

  return (
    <div
      role="radiogroup"
      aria-label="Día"
      className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-4 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {days.map((day, index) => {
        const open = available.has(day);
        const active = day === selected;

        return (
          <button
            key={day}
            ref={active ? selectedRef : undefined}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${dayLabel(index, day)} ${dayNumber(day)} de ${monthShort(day)}${open ? "" : ", sin horarios"}`}
            disabled={!open}
            onClick={() => onSelect(day)}
            className={
              "press flex min-h-[88px] min-w-[68px] shrink-0 snap-center flex-col items-center justify-center gap-0.5 " +
              "rounded-box border-[3px] border-line " +
              (active
                ? "bg-accent text-on-accent shadow-hard"
                : open
                  ? "bg-surface text-text shadow-hard-sm"
                  : "hatch bg-surface text-muted opacity-70")
            }
          >
            <span className="text-xs font-bold tracking-wider">{dayLabel(index, day)}</span>
            <span className="font-display text-3xl font-extrabold leading-none">{dayNumber(day)}</span>
            <span className="text-[11px] font-semibold tracking-wide">{monthShort(day)}</span>
          </button>
        );
      })}
    </div>
  );
}
