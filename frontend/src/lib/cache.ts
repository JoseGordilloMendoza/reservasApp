import { dehydrate, hydrate } from "@tanstack/react-query";
import type { DehydratedState, QueryClient } from "@tanstack/react-query";

// The public pages are the first thing anyone sees, and the server may be asleep: on the free plan it takes a
// while to wake up. Keeping the last answer on the device lets the home page and a business page appear at
// once, while the fresh answer is fetched behind them and replaces it.

const KEY = "separa.cache.v1";
/** Older than this, a saved answer is not shown: prices and services may have changed too much. */
export const MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** A visitor who opens many businesses should not fill the storage. */
export const MAX_ENTRIES = 20;
const SAVE_DELAY_MS = 1000;

/**
 * Only what every visitor sees and changes slowly. Never availability (a free hour that is not free any more
 * would be offered), nor a booking (it has a person's data) nor anything of the panel.
 */
const SAVED = new Set(["directory", "business"]);

export function isSavable(queryKey: readonly unknown[]): boolean {
  return typeof queryKey[0] === "string" && SAVED.has(queryKey[0]);
}

interface Saved {
  savedAt: number;
  state: DehydratedState;
}

/** What would be written now: the successful answers of the public queries, the freshest ones. */
export function snapshot(client: QueryClient): DehydratedState {
  const state = dehydrate(client, {
    shouldDehydrateQuery: (query) => query.state.status === "success" && isSavable(query.queryKey),
  });
  const queries = [...state.queries].sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt).slice(0, MAX_ENTRIES);
  return { mutations: [], queries };
}

export function saveCache(client: QueryClient, now = Date.now()): void {
  try {
    const saved: Saved = { savedAt: now, state: snapshot(client) };
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    // Storage can be blocked or full (private mode); the app works the same, only a little slower to show.
  }
}

/** Puts back what was saved, leaving out anything old, malformed or not meant to be kept. */
export function restoreCache(client: QueryClient, now = Date.now()): void {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as Partial<Saved> | null;
    const queries = saved?.state?.queries;
    if (!Array.isArray(queries)) return;

    const fresh = queries.filter(
      (query) =>
        Array.isArray(query?.queryKey) &&
        isSavable(query.queryKey) &&
        typeof query.state?.dataUpdatedAt === "number" &&
        now - query.state.dataUpdatedAt <= MAX_AGE_MS,
    );
    hydrate(client, { mutations: [], queries: fresh });
  } catch {
    // A damaged copy is simply not used.
  }
}

/** Saves after the public answers change, not on every keystroke elsewhere. Returns how to stop. */
export function keepCacheSaved(client: QueryClient): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const unsubscribe = client.getQueryCache().subscribe((event) => {
    if (event.type !== "updated" || !isSavable(event.query.queryKey)) return;
    clearTimeout(timer);
    timer = setTimeout(() => saveCache(client), SAVE_DELAY_MS);
  });
  // A visitor who leaves right after the answer arrives would otherwise lose it.
  const flush = () => saveCache(client);
  window.addEventListener("pagehide", flush);

  return () => {
    clearTimeout(timer);
    unsubscribe();
    window.removeEventListener("pagehide", flush);
  };
}
