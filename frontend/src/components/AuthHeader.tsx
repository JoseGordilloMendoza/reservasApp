import type { ReactNode } from "react";

import { BRAND } from "../lib/brand";
import { HeroArt } from "./HeroArt";

/** The blue block at the top of the pages where someone signs in or recovers their password. */
export function AuthHeader({ children }: { children: ReactNode }) {
  return (
    <header className="relative overflow-hidden rounded-box bg-[linear-gradient(135deg,#1238c9_0%,#052ff7_100%)] p-6 pb-8 text-white shadow-card">
      <HeroArt />
      <p className="relative font-display text-base font-semibold tracking-tight text-[#bfe3ff]">{BRAND}</p>
      <h1 className="relative mt-3 break-words font-display text-3xl font-bold leading-[1.15] tracking-[-0.02em] sm:text-4xl">{children}</h1>
    </header>
  );
}
