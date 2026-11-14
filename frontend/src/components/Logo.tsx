import { BRAND } from "../lib/brand";

/**
 * The mark of MiReserva: an M whose middle stroke is a check. Drawn in vector from the logo file the team
 * gave us; the two colors follow the theme (the ink turns light in dark mode).
 */
export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="430 360 340 336" aria-hidden="true" focusable="false" className={className}>
      <path
        fill="var(--logo-ink)"
        d="M437 525 L523 612 L514 658 C508 680 490 690 476 690 C453 690 437 672 437 650 Z M763 425 L763 640 C763 675 740 690 715 690 C694 690 677 677 670 658 L640 578 Z"
      />
      <path
        fill="var(--logo-blue)"
        d="M440 498 C455 480 470 467 495 467 C517 467 528 476 537 484 L570 520 L665 397 C685 372 712 365 735 372 C746 376 754 384 761 393 L572 636 Z"
      />
    </svg>
  );
}

/** The mark and the name, the way it is signed at the top of every page. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className="size-9" />
      <span className="font-display text-xl font-extrabold leading-none tracking-[-0.03em]">
        <span style={{ color: "var(--logo-ink)" }}>Mi</span>
        <span style={{ color: "var(--logo-blue)" }}>{BRAND.replace(/^Mi/, "")}</span>
      </span>
    </span>
  );
}
