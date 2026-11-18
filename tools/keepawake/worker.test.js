import assert from "node:assert/strict";
import { test } from "node:test";

import { keepAwake, limaHour, pingUrl, shouldKeepAwake } from "./worker.js";

const URL_OK = "https://mireserva-api.onrender.com/api/ping/";

/** A moment given in Lima time (UTC-5). */
const lima = (hour, minute = 0) => new Date(Date.UTC(2026, 10, 14, hour + 5, minute));

test("Lima time is five hours behind UTC, across midnight too", () => {
  assert.equal(limaHour(new Date(Date.UTC(2026, 10, 14, 12, 0))), 7);
  assert.equal(limaHour(new Date(Date.UTC(2026, 10, 14, 3, 0))), 22);
  assert.equal(limaHour(new Date(Date.UTC(2026, 10, 14, 4, 59))), 23);
  assert.equal(limaHour(new Date(Date.UTC(2026, 10, 14, 5, 0))), 0);
});

test("the API is kept awake from 7:00 to 22:59 in Lima and left alone otherwise", () => {
  assert.equal(shouldKeepAwake(lima(6, 59)), false);
  assert.equal(shouldKeepAwake(lima(7, 0)), true);
  assert.equal(shouldKeepAwake(lima(15, 30)), true);
  assert.equal(shouldKeepAwake(lima(22, 59)), true);
  assert.equal(shouldKeepAwake(lima(23, 0)), false);
  assert.equal(shouldKeepAwake(lima(0, 0)), false);
  assert.equal(shouldKeepAwake(lima(3, 0)), false);
});

test("only the ping address is accepted", () => {
  assert.equal(pingUrl(URL_OK), URL_OK);
  assert.throws(() => pingUrl("https://mireserva-api.onrender.com/api/health/"), /api\/ping/);
  assert.throws(() => pingUrl("http://mireserva-api.onrender.com/api/ping/"), /https/);
  assert.throws(() => pingUrl("not an address"), /valid/);
  assert.throws(() => pingUrl(undefined), /missing/);
});

test("it visits the ping address during the day", async () => {
  const seen = [];
  const fetchFn = async (url) => {
    seen.push(url);
    return new Response('{"status":"ok"}', { status: 200 });
  };
  const outcome = await keepAwake({ PING_URL: URL_OK }, { now: lima(12), fetchFn });
  assert.deepEqual(outcome, { result: "ok", status: 200 });
  assert.deepEqual(seen, [URL_OK]);
});

test("it does not visit at night", async () => {
  const fetchFn = async () => assert.fail("must not call the API at night");
  const outcome = await keepAwake({ PING_URL: URL_OK }, { now: lima(2), fetchFn });
  assert.deepEqual(outcome, { result: "skipped" });
});

test("a server error or a network error is reported, not thrown", async () => {
  const down = await keepAwake(
    { PING_URL: URL_OK },
    { now: lima(12), fetchFn: async () => new Response("", { status: 503 }) },
  );
  assert.equal(down.result, "failed");
  assert.equal(down.status, 503);

  const offline = await keepAwake(
    { PING_URL: URL_OK },
    {
      now: lima(12),
      fetchFn: async () => {
        throw new Error("connection reset");
      },
    },
  );
  assert.equal(offline.result, "failed");
  assert.match(offline.error, /connection reset/);
});

test("a wrong address fails loudly instead of visiting something else", async () => {
  await assert.rejects(
    keepAwake({ PING_URL: "https://mireserva-api.onrender.com/api/health/" }, { now: lima(12), fetchFn: async () => assert.fail() }),
    /api\/ping/,
  );
});

test("it says who it is, and a failure carries who answered and what it said", async () => {
  let sent;
  const fetchFn = async (_url, init) => {
    sent = init;
    return new Response("<html><title>502 Bad Gateway</title></html>", {
      status: 502,
      headers: { server: "cloudflare", "cf-ray": "abc-LIM", "content-type": "text/html", "set-cookie": "x=1" },
    });
  };

  const outcome = await keepAwake({ PING_URL: URL_OK }, { now: lima(12), fetchFn });

  assert.match(sent.headers["user-agent"], /MiReserva keep-awake/);
  assert.equal(outcome.status, 502);
  assert.deepEqual(outcome.headers, { server: "cloudflare", "cf-ray": "abc-LIM", "content-type": "text/html" });
  assert.match(outcome.body, /502 Bad Gateway/);
});
