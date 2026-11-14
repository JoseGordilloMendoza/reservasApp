/**
 * The graphic elements of the brand, from the moodboard: a big check, a capsule and thin arcs. They sit behind
 * the text of a blue block at low strength, so they decorate without ever competing with what is written.
 */
export function HeroArt() {
  return (
    <svg
      viewBox="0 0 400 300"
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMaxYMax slice"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <circle cx="372" cy="14" r="120" fill="none" stroke="#ffffff" strokeOpacity="0.2" strokeWidth="1.5" />
      <circle cx="372" cy="14" r="165" fill="none" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="1.5" />
      <rect x="40" y="236" width="170" height="64" rx="32" transform="rotate(-28 125 268)" fill="#48b8ff" fillOpacity="0.4" />
      <path d="M236 176 L292 236 L402 92" fill="none" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="52" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
