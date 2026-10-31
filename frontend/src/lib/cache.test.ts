import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MAX_AGE_MS, MAX_ENTRIES, isSavable, keepCacheSaved, restoreCache, saveCache, snapshot } from "./cache";

const KEY = "separa.cache.v1";
const NOW = 1_900_000_000_000;

afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** A client with answers for the given keys, each marked as received at `at`. */
function clientWith(entries: [readonly unknown[], unknown][], at = NOW) {
  const client = new QueryClient();
  for (const [key, data] of entries) client.setQueryData(key, data, { updatedAt: at });
  return client;
}

const keysOf = (client: QueryClient) => client.getQueryCache().getAll().map((query) => JSON.stringify(query.queryKey));

describe("what is kept", () => {
  it("is the home page list and the page of a business", () => {
    expect(isSavable(["directory"])).toBe(true);
    expect(isSavable(["business", "canchas-los-andes"])).toBe(true);
  });

  it("is never availability, a booking, a search or anything of the panel", () => {
    expect(isSavable(["availability", "canchas", { resource: 1 }])).toBe(false);
    expect(isSavable(["booking", "secret-token"])).toBe(false);
    expect(isSavable(["search", "lucia"])).toBe(false);
    expect(isSavable(["panel", "canchas", "bookings", "list", {}])).toBe(false);
    expect(isSavable(["platform", "dashboard"])).toBe(false);
    expect(isSavable([])).toBe(false);
  });

  it("leaves private and fast-changing answers out of what is written", () => {
    const client = clientWith([
      [["directory"], { results: [] }],
      [["business", "canchas-los-andes"], { name: "Canchas" }],
      [["availability", "canchas", {}], { slots: [] }],
      [["booking", "secret-token"], { customer_name: "Ana" }],
      [["panel", "canchas", "bookings"], { results: [] }],
    ]);

    saveCache(client, NOW);

    const written = localStorage.getItem(KEY) ?? "";
    expect(written).toContain("directory");
    expect(written).toContain("canchas-los-andes");
    expect(written).not.toContain("availability");
    expect(written).not.toContain("secret-token");
    expect(written).not.toContain("Ana");
    expect(written).not.toContain("panel");
  });

  it("keeps only the most recent ones when there are many", () => {
    const client = new QueryClient();
    for (let index = 0; index < MAX_ENTRIES + 5; index += 1) {
      client.setQueryData(["business", `negocio-${index}`], { index }, { updatedAt: NOW + index });
    }

    const kept = snapshot(client).queries;

    expect(kept).toHaveLength(MAX_ENTRIES);
    expect(JSON.stringify(kept)).toContain(`negocio-${MAX_ENTRIES + 4}`);
    expect(JSON.stringify(kept)).not.toContain('"negocio-0"');
  });
});

describe("coming back", () => {
  it("puts the answers back with the time they were received, so they still count as old", () => {
    saveCache(clientWith([[["directory"], { results: [{ slug: "a" }] }]], NOW - 5 * 60_000), NOW);
    const fresh = new QueryClient();

    restoreCache(fresh, NOW);

    expect(fresh.getQueryData(["directory"])).toEqual({ results: [{ slug: "a" }] });
    expect(fresh.getQueryState(["directory"])?.dataUpdatedAt).toBe(NOW - 5 * 60_000);
  });

  it("does not show an answer older than a day", () => {
    saveCache(clientWith([[["directory"], { results: [] }]], NOW - MAX_AGE_MS - 1), NOW);
    const fresh = new QueryClient();

    restoreCache(fresh, NOW);

    expect(fresh.getQueryData(["directory"])).toBeUndefined();
  });

  it("does not trust what it did not write itself", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        savedAt: NOW,
        state: {
          mutations: [],
          queries: [
            { queryKey: ["booking", "token"], queryHash: "x", state: { data: { secret: 1 }, dataUpdatedAt: NOW, status: "success" } },
            { queryKey: ["directory"], queryHash: "y", state: { data: { results: [] }, dataUpdatedAt: "yesterday", status: "success" } },
            { queryHash: "z", state: { dataUpdatedAt: NOW } },
          ],
        },
      }),
    );
    const fresh = new QueryClient();

    restoreCache(fresh, NOW);

    expect(keysOf(fresh)).toEqual([]);
  });

  it("starts empty when there is nothing, or the copy is damaged", () => {
    const fresh = new QueryClient();
    restoreCache(fresh, NOW);
    localStorage.setItem(KEY, "{not json");
    restoreCache(fresh, NOW);
    localStorage.setItem(KEY, JSON.stringify({ state: { queries: "no" } }));
    restoreCache(fresh, NOW);

    expect(keysOf(fresh)).toEqual([]);
  });

  it("works when the storage refuses to be read or written", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    const client = clientWith([[["directory"], { results: [] }]]);

    expect(() => saveCache(client, NOW)).not.toThrow();
    expect(() => restoreCache(new QueryClient(), NOW)).not.toThrow();
  });
});

describe("saving as answers arrive", () => {
  it("waits a moment after a public answer, and saves once for several", () => {
    vi.useFakeTimers();
    const client = new QueryClient();
    const stop = keepCacheSaved(client);
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    client.setQueryData(["directory"], { results: [] });
    client.setQueryData(["business", "a"], { name: "A" });
    expect(setItem).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1100);

    expect(setItem).toHaveBeenCalledTimes(1);
    stop();
  });

  it("does not save because of something private changing", () => {
    vi.useFakeTimers();
    const client = new QueryClient();
    const stop = keepCacheSaved(client);
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    client.setQueryData(["panel", "x", "bookings"], { results: [] });
    client.setQueryData(["booking", "token"], {});
    vi.advanceTimersByTime(5000);

    expect(setItem).not.toHaveBeenCalled();
    stop();
  });

  it("saves when the page is closed, before the wait is over", () => {
    vi.useFakeTimers();
    const client = new QueryClient();
    const stop = keepCacheSaved(client);
    client.setQueryData(["directory"], { results: [] });

    window.dispatchEvent(new Event("pagehide"));

    expect(localStorage.getItem(KEY)).toContain("directory");
    stop();
  });

  it("stops saving once stopped", () => {
    vi.useFakeTimers();
    const client = new QueryClient();
    keepCacheSaved(client)();
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    client.setQueryData(["directory"], { results: [] });
    vi.advanceTimersByTime(5000);
    window.dispatchEvent(new Event("pagehide"));

    expect(setItem).not.toHaveBeenCalled();
  });
});
