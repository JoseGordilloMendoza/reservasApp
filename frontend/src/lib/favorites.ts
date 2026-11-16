import { useSyncExternalStore } from "react";

import type { Accent } from "./types";

// Favorites live on the customer's own device, like their tickets: no account, nothing sent anywhere.

const KEY = "separa.favorites.v1";
const CHANGED = "separa:favorites";
/** More than this is a list nobody reads; the oldest one is dropped. */
export const MAX_FAVORITES = 30;

export interface Favorite {
  slug: string;
  name: string;
  accent: Accent;
  /** The business type, to say what kind of place it is. */
  kind: string;
  address: string;
  /** Where its logo is, if it has one. Saved before logos existed, a favorite has none until its page is opened. */
  logo?: string | null;
  savedAt: string;
}

export type FavoriteInput = Omit<Favorite, "savedAt">;

const isFavorite = (item: unknown): item is Favorite =>
  !!item &&
  typeof item === "object" &&
  typeof (item as Favorite).slug === "string" &&
  typeof (item as Favorite).name === "string" &&
  typeof (item as Favorite).savedAt === "string";

function rawStored(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function parse(raw: string): Favorite[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isFavorite) : [];
  } catch {
    return [];
  }
}

function read(): Favorite[] {
  return parse(rawStored());
}

// useSyncExternalStore needs the very same array until the stored text changes, so the last one is kept
// together with the text it came from. That also makes a change made by another tab show up by itself.
let last: { raw: string; items: Favorite[] } | null = null;

function write(items: Favorite[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Storage can be blocked (private mode): the list simply does not survive a reload.
  }
  window.dispatchEvent(new Event(CHANGED));
}

/** Newest first: the list is stored in that order. */
export function listFavorites(): Favorite[] {
  const raw = rawStored();
  if (last?.raw !== raw) last = { raw, items: parse(raw) };
  return last.items;
}

export function isFavoriteBusiness(slug: string): boolean {
  return listFavorites().some((item) => item.slug === slug);
}

export function addFavorite(input: FavoriteInput) {
  const others = read().filter((item) => item.slug !== input.slug);
  // The new one goes first; what is past the limit is the oldest.
  write([{ ...input, savedAt: new Date().toISOString() }, ...others].slice(0, MAX_FAVORITES));
}

export function removeFavorite(slug: string) {
  write(read().filter((item) => item.slug !== slug));
}

/** Keeps a saved business current (it may have been renamed or recolored) without moving it in the list. */
export function refreshFavorite(input: FavoriteInput) {
  const items = read();
  const current = items.find((item) => item.slug === input.slug);
  if (!current) return;
  const same =
    current.name === input.name &&
    current.accent === input.accent &&
    current.kind === input.kind &&
    current.address === input.address &&
    (current.logo ?? null) === (input.logo ?? null);
  if (same) return;
  write(items.map((item) => (item.slug === input.slug ? { ...item, ...input } : item)));
}

function subscribe(onChange: () => void) {
  // "storage" fires when another tab changes the list.
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) onChange();
  };
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** The saved businesses, kept up to date on every screen that shows them. */
export function useFavorites(): Favorite[] {
  return useSyncExternalStore(subscribe, listFavorites, () => []);
}
