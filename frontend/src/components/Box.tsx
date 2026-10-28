import type { HTMLAttributes } from "react";

interface BoxProps extends HTMLAttributes<HTMLDivElement> {
  /** Drop the shadow for boxes nested inside another box. */
  flat?: boolean;
}

export function Box({ flat = false, className = "", ...props }: BoxProps) {
  const shadow = flat ? "" : "shadow-hard";
  return (
    <div
      className={`rounded-box border-[3px] border-line bg-surface text-text ${shadow} ${className}`.trim()}
      {...props}
    />
  );
}
