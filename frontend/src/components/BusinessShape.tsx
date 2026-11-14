import type { BusinessKind } from "../lib/platformTypes";

/** Three looks for the picture area of a card, all inside the brand colors, taking turns down a list. */
export const TONES = [
  { panel: "bg-tint", first: "var(--accent)", second: "#48b8ff", ink: "var(--line)" },
  { panel: "bg-accent", first: "#ffffff", second: "#48b8ff", ink: "#172b4d" },
  { panel: "bg-surface", first: "var(--accent)", second: "#48b8ff", ink: "var(--line)" },
] as const;

export type Tone = (typeof TONES)[number];

/** A flat, rounded drawing for each kind of business: a ball, two speech bubbles, or a calendar with a check. */
export function BusinessShape({ kind, tone, className }: { kind: string; tone: Tone; className?: string }) {
  const { first, second, ink } = tone;
  const known = (["court", "psychologist"] as BusinessKind[]).includes(kind as BusinessKind) ? kind : "generic";

  return (
    <svg viewBox="0 0 160 120" aria-hidden="true" focusable="false" className={className}>
      {known === "court" && (
        <g strokeLinecap="round" strokeLinejoin="round">
          <circle cx="94" cy="62" r="40" fill={first} />
          <circle cx="40" cy="92" r="14" fill={second} />
          <g fill="none" stroke={ink} strokeWidth="2.5" strokeOpacity="0.85">
            <path d="M56 50 C76 68 108 68 130 48" />
            <path d="M94 22 L94 56" />
            <path d="M60 88 C76 76 84 70 94 56 C104 70 112 76 128 88" />
          </g>
        </g>
      )}
      {known === "psychologist" && (
        <g strokeLinejoin="round">
          <path d="M28 24 H92 A16 16 0 0 1 108 40 V68 A16 16 0 0 1 92 84 H58 L38 100 V84 H28 A16 16 0 0 1 12 68 V40 A16 16 0 0 1 28 24 Z" fill={first} />
          <path d="M70 52 H132 A16 16 0 0 1 148 68 V92 A16 16 0 0 1 132 108 H128 V120 L112 108 H86 A16 16 0 0 1 70 92 Z" fill={second} stroke={ink} strokeWidth="2.5" strokeOpacity="0.85" />
          <circle cx="40" cy="54" r="4" fill="#ffffff" />
          <circle cx="60" cy="54" r="4" fill="#ffffff" />
        </g>
      )}
      {known === "generic" && (
        <g strokeLinecap="round" strokeLinejoin="round">
          <rect x="32" y="22" width="96" height="84" rx="16" fill={first} />
          <path d="M32 44 H128" stroke={second} strokeWidth="10" />
          <rect x="52" y="12" width="8" height="22" rx="4" fill={second} />
          <rect x="100" y="12" width="8" height="22" rx="4" fill={second} />
          <path d="M58 74 L74 90 L104 58" fill="none" stroke={ink} strokeOpacity="0.9" strokeWidth="9" />
        </g>
      )}
    </svg>
  );
}
