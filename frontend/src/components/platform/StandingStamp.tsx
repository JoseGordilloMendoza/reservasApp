import { standingLabel } from "../../lib/standing";
import type { Tone } from "../../lib/standing";
import type { Standing } from "../../lib/platformTypes";

const TONE: Record<Tone, string> = {
  ok: "bg-line text-paper",
  soon: "bg-surface text-text",
  bad: "bg-surface text-danger",
  none: "border-dashed bg-surface text-muted",
};

/** A stamp with where the business stands. The word always says it, never only the color. */
export function StandingStamp({ standing, suspended = false }: { standing: Standing; suspended?: boolean }) {
  const { text, tone } = standingLabel(standing, suspended);
  return (
    <span
      className={`inline-block -rotate-3 whitespace-nowrap rounded-[8px] border-[3px] border-current px-2 py-1 font-display text-sm font-extrabold uppercase leading-none tracking-wide ${TONE[tone]}`}
    >
      {text}
    </span>
  );
}
