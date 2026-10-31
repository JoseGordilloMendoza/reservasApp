import type { BusinessKind } from "../lib/platformTypes";

/** Three flat colors from the palette, as the poster style asks: ink, red and butter. */
export const TONES = [
  { panel: "bg-line", first: "var(--accent)", second: "var(--paper)", ink: "var(--line)" },
  { panel: "bg-accent", first: "var(--paper)", second: "var(--line)", ink: "var(--line)" },
  { panel: "bg-paper", first: "var(--accent)", second: "var(--line)", ink: "var(--line)" },
] as const;

export type Tone = (typeof TONES)[number];

function Leaf({ d, vein, fill, ink }: { d: string; vein: string; fill: string; ink: string }) {
  return (
    <g stroke={ink} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
      <path d={d} fill={fill} />
      <path d={vein} fill="none" />
    </g>
  );
}

/** A flat drawing for each kind of business: a ball, leaves, or a ticket stub. */
export function BusinessShape({ kind, tone, className }: { kind: string; tone: Tone; className?: string }) {
  const { first, second, ink } = tone;
  const known = (["court", "psychologist"] as BusinessKind[]).includes(kind as BusinessKind) ? kind : "generic";

  return (
    <svg viewBox="0 0 160 120" aria-hidden="true" focusable="false" className={className}>
      {known === "court" && (
        <>
          <Leaf d="M16 104 C6 78 18 56 40 48 C50 70 42 94 16 104Z" vein="M16 104 C22 84 30 68 40 48" fill={second} ink={ink} />
          <circle cx="86" cy="60" r="40" fill={first} stroke={ink} strokeWidth="3" />
          <g fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round">
            <path d="M48 48 C70 66 100 66 124 46" />
            <path d="M86 20 L86 54" />
            <path d="M52 86 C68 74 76 68 86 54 C96 68 104 74 120 86" />
          </g>
        </>
      )}
      {known === "psychologist" && (
        <>
          <Leaf d="M70 108 C22 98 14 52 62 14 C108 38 118 84 70 108Z" vein="M70 108 C66 76 64 48 62 14" fill={first} ink={ink} />
          <Leaf d="M104 112 C84 92 92 62 124 52 C140 74 132 100 104 112Z" vein="M104 112 C112 90 118 72 124 52" fill={second} ink={ink} />
          <circle cx="132" cy="22" r="10" fill={second} stroke={ink} strokeWidth="3" />
        </>
      )}
      {known === "generic" && (
        <>
          <g stroke={ink} strokeWidth="3" strokeLinejoin="round">
            <path d="M22 30 H138 V50 A10 10 0 0 0 138 70 V90 H22 V70 A10 10 0 0 0 22 50 Z" fill={first} />
          </g>
          <path d="M100 34 V86" stroke={ink} strokeWidth="3" strokeDasharray="5 6" strokeLinecap="round" />
          <circle cx="58" cy="60" r="16" fill={second} stroke={ink} strokeWidth="3" />
          <path d="M58 50 V60 L65 64" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}
