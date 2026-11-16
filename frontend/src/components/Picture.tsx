import { useState } from "react";
import type { ReactNode } from "react";

interface PictureProps {
  /** Where the picture is; null or empty shows the fallback. */
  src: string | null | undefined;
  className?: string;
  /** What to show when there is no picture or it cannot be loaded. Nothing by default. */
  fallback?: ReactNode;
  /** Empty (the default) when the text next to it already says what it is. */
  alt?: string;
}

/**
 * A business picture that never leaves a broken-image icon: when the address is missing or fails
 * to load, the fallback takes its place. The address is part of the key, so a new picture is a new
 * address and starts clean.
 */
export function Picture({ src, className, fallback = null, alt = "" }: PictureProps) {
  const [failed, setFailed] = useState<string | null>(null);

  if (!src || failed === src) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => setFailed(src)}
    />
  );
}
