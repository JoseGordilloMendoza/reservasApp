import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "./http";
import { authed, panelApi } from "./panelApi";
import { clearSession, getAccessToken, getRefreshToken, onSessionLost, setBusinessSlug, setTokens } from "./session";

type Reply = { status: number; body: unknown };

/** Replies are consumed in order; every call is recorded with its headers. */
function serve(...replies: Reply[]) {
  const calls: { path: string; method: string; headers: Record<string, string>; body: unknown }[] = [];
  const queue = [...replies];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      calls.push({
        path: String(input).replace(/^\/api\/v1/, ""),
        method: init?.method ?? "GET",
        headers: (init?.headers ?? {}) as Record<string, string>,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      const reply = queue.shift() ?? { status: 500, body: { detail: "unexpected call" } };
      return { ok: reply.status < 400, status: reply.status, text: async () => JSON.stringify(reply.body) };
    }),
  );
  return calls;
}

beforeEach(() => {
  clearSession();
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearSession();
});

describe("authed", () => {
  it("sends the access token and the chosen business", async () => {
    setTokens("access-1", "refresh-1");
    setBusinessSlug("canchas-los-andes");
    const calls = serve({ status: 200, body: { ok: true } });

    await authed("/panel/business/");

    expect(calls[0]?.headers.Authorization).toBe("Bearer access-1");
    expect(calls[0]?.headers["X-Business"]).toBe("canchas-los-andes");
  });

  it("does not send a business header before one is chosen", async () => {
    setTokens("access-1", "refresh-1");
    setBusinessSlug(null);
    const calls = serve({ status: 200, body: {} });

    await authed("/panel/business/");

    expect(calls[0]?.headers["X-Business"]).toBeUndefined();
  });

  it("renews an expired token once and repeats the call", async () => {
    setTokens("old-access", "refresh-1");
    const calls = serve(
      { status: 401, body: { detail: "Token expired" } },
      { status: 200, body: { access: "new-access", refresh: "refresh-2" } },
      { status: 200, body: { name: "Canchas" } },
    );

    const result = await authed<{ name: string }>("/panel/business/");

    expect(result.name).toBe("Canchas");
    expect(calls.map((call) => call.path)).toEqual(["/panel/business/", "/auth/refresh/", "/panel/business/"]);
    expect(calls[2]?.headers.Authorization).toBe("Bearer new-access");
    expect(getAccessToken()).toBe("new-access");
  });

  it("keeps the rotated refresh token", async () => {
    setTokens("old-access", "refresh-1");
    serve(
      { status: 401, body: {} },
      { status: 200, body: { access: "new-access", refresh: "refresh-2" } },
      { status: 200, body: {} },
    );

    await authed("/panel/business/");

    expect(getRefreshToken()).toBe("refresh-2");
  });

  it("gets a token first when the page was just reloaded", async () => {
    // Only the refresh token survives a reload.
    localStorage.setItem("separa.panel.refresh.v1", "refresh-1");
    const calls = serve(
      { status: 200, body: { access: "fresh", refresh: "refresh-2" } },
      { status: 200, body: { name: "Canchas" } },
    );

    await authed("/panel/business/");

    expect(calls.map((call) => call.path)).toEqual(["/auth/refresh/", "/panel/business/"]);
  });

  it("ends the session when the refresh token is refused", async () => {
    setTokens("old-access", "refresh-1");
    const lost = vi.fn();
    onSessionLost(lost);
    serve({ status: 401, body: {} }, { status: 401, body: { detail: "Token is blacklisted" } });

    await expect(authed("/panel/business/")).rejects.toMatchObject({ code: "not_signed_in" });

    expect(lost).toHaveBeenCalled();
    expect(getRefreshToken()).toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it("does not sign anyone out because the connection dropped", async () => {
    setTokens("old-access", "refresh-1");
    const lost = vi.fn();
    onSessionLost(lost);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(authed("/panel/business/")).rejects.toMatchObject({ code: "network" });

    expect(lost).not.toHaveBeenCalled();
    expect(getRefreshToken()).toBe("refresh-1");
  });

  it("fails without calling the server when there is no session at all", async () => {
    const calls = serve();

    await expect(authed("/panel/business/")).rejects.toBeInstanceOf(ApiError);

    expect(calls).toHaveLength(0);
  });

  it("shares one renewal between simultaneous calls", async () => {
    setTokens("old-access", "refresh-1");
    const calls = serve(
      { status: 401, body: {} },
      { status: 401, body: {} },
      { status: 200, body: { access: "new-access", refresh: "refresh-2" } },
      { status: 200, body: { n: 1 } },
      { status: 200, body: { n: 2 } },
    );

    await Promise.all([authed("/panel/business/"), authed("/panel/services/")]);

    // A second renewal would present a refresh token that was already used.
    expect(calls.filter((call) => call.path === "/auth/refresh/")).toHaveLength(1);
  });

  it("passes other errors through untouched", async () => {
    setTokens("access-1", "refresh-1");
    serve({ status: 409, body: { code: "invalid_transition", detail: "No se puede." } });

    await expect(authed("/panel/bookings/1/confirm/", { method: "POST" })).rejects.toMatchObject({
      status: 409,
      code: "invalid_transition",
    });
  });
});

describe("panelApi", () => {
  it("builds the booking filters into the address", async () => {
    setTokens("access-1", "refresh-1");
    const calls = serve({ status: 200, body: { count: 0, next: null, previous: null, results: [] } });

    await panelApi.bookings(
      { status: ["pending", "confirmed"], dateFrom: "2030-01-07", q: " Rosa ", ordering: "-starts_at" },
      2,
    );

    const url = new URL(calls[0]!.path, "http://x");
    expect(url.pathname).toBe("/panel/bookings/");
    expect(url.searchParams.get("status")).toBe("pending,confirmed");
    expect(url.searchParams.get("date_from")).toBe("2030-01-07");
    expect(url.searchParams.get("q")).toBe("Rosa");
    expect(url.searchParams.get("ordering")).toBe("-starts_at");
    expect(url.searchParams.get("page")).toBe("2");
  });

  it("asks for no filters when there are none", async () => {
    setTokens("access-1", "refresh-1");
    const calls = serve({ status: 200, body: { results: [] } });

    await panelApi.bookings();

    expect(calls[0]?.path).toBe("/panel/bookings/");
  });

  it("posts the action to the booking", async () => {
    setTokens("access-1", "refresh-1");
    const calls = serve({ status: 200, body: { id: 7, status: "confirmed" } });

    await panelApi.act(7, "no-show");

    expect(calls[0]).toMatchObject({ path: "/panel/bookings/7/no-show/", method: "POST" });
  });

  it("signs in without a token", async () => {
    const calls = serve({ status: 200, body: { access: "a", refresh: "r", user: {} } });

    await panelApi.login("ana@example.com", "secret");

    expect(calls[0]?.headers.Authorization).toBeUndefined();
    expect(calls[0]?.body).toEqual({ email: "ana@example.com", password: "secret" });
  });
});
