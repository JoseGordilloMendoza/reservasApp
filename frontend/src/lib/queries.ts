import { useEffect } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { ApiError, api } from "./api";
import { MIN_LETTERS } from "./search";
import type { Accent } from "./types";

/** Do not retry what a retry cannot fix (a wrong link, a rule that said no). The default for every query. */
export function retryUnlessClientError(failures: number, error: unknown) {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failures < 2;
}

export function useBusiness(slug: string) {
  return useQuery({
    queryKey: ["business", slug],
    queryFn: () => api.business(slug),
    staleTime: 60_000,
  });
}

/** The businesses the home page shows. */
export function useDirectory() {
  return useQuery({ queryKey: ["directory"], queryFn: () => api.directory(), staleTime: 60_000 });
}

/** Businesses that match what was typed. Asks nothing until there are enough letters. */
export function useBusinessSearch(typed: string) {
  const text = typed.trim();
  return useQuery({
    queryKey: ["search", text.toLowerCase()],
    queryFn: () => api.search(text),
    enabled: text.length >= MIN_LETTERS,
    // Keep the last list on screen while the next one loads, so it does not flicker with each letter.
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useAvailability(
  slug: string,
  params: { resource: number; service: number; from: string; to: string } | null,
) {
  return useQuery({
    queryKey: ["availability", slug, params],
    queryFn: () => api.availability(slug, params!),
    enabled: params !== null,
    staleTime: 15_000,
  });
}

export function useBooking(token: string) {
  return useQuery({
    queryKey: ["booking", token],
    queryFn: () => api.booking(token),
    // A pending booking is waiting for the business, so keep checking while it is open.
    refetchInterval: (query) => (query.state.data?.status === "pending" ? 30_000 : false),
  });
}

/** Paint the page with the business's accent color while it is on screen. */
export function useAccent(accent: Accent | undefined) {
  useEffect(() => {
    if (!accent) return;
    const root = document.documentElement;
    root.dataset.accent = accent;

    const meta = document.querySelector('meta[name="theme-color"]');
    const previous = meta?.getAttribute("content") ?? null;
    const swatch = getComputedStyle(root).getPropertyValue("--accent").trim();
    if (meta && swatch) meta.setAttribute("content", swatch);

    return () => {
      delete root.dataset.accent;
      if (meta && previous) meta.setAttribute("content", previous);
    };
  }, [accent]);
}
