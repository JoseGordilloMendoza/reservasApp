/** A placeholder with the shape of what is loading. Hatched, not pulsing, to stay in the system. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`hatch rounded-box border-[3px] border-dashed border-line/50 ${className}`.trim()}
    />
  );
}
