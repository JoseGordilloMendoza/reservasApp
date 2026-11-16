import assert from "node:assert/strict";
import { test } from "node:test";

import { keyOf, serve } from "./worker.js";

const KEY = "b12/logo-3fa9c1d2e4b56789.webp";
const BASE = "https://images.example.dev/";

/** A bucket with the given files; counts how often it was read. */
function bucketWith(files) {
  return {
    reads: [],
    async get(key) {
      this.reads.push(key);
      return key in files ? { body: files[key], httpEtag: '"abc123"' } : null;
    },
  };
}

test("only the names the API writes are served", () => {
  assert.equal(keyOf(BASE + KEY), KEY);
  assert.equal(keyOf(BASE + "b3/cover-0123456789abcdef.webp"), "b3/cover-0123456789abcdef.webp");

  for (const bad of [
    "",
    "b12/logo.webp",
    "b12/logo-3fa9c1d2e4b56789.png",
    "b12/logo-3FA9C1D2E4B56789.webp",
    "b12/photo-3fa9c1d2e4b56789.webp",
    "x12/logo-3fa9c1d2e4b56789.webp",
    "b12/logo-3fa9c1d2e4b56789.webp/extra",
    "b12%2f..%2fb13/logo-3fa9c1d2e4b56789.webp", // an encoded slash cannot sneak a ".." past the check
    "b12%2flogo-3fa9c1d2e4b56789.webp%00.png",
  ]) {
    assert.equal(keyOf(BASE + bad), null, bad);
  }
});

test("dot segments are resolved by the URL parser into a name that is itself valid, never into anything else", () => {
  // Whatever the path looks like on arrival, only a name that passes the check is ever read.
  assert.equal(keyOf(BASE + "../b12/logo-3fa9c1d2e4b56789.webp"), KEY);
  assert.equal(keyOf(BASE + "b12/../b12/logo-3fa9c1d2e4b56789.webp"), KEY);
  assert.equal(keyOf(BASE + "b12/../secret.txt"), null);
  assert.equal(keyOf(BASE + "b12/%2e%2e/secret.txt"), null);
});

test("a picture comes out as WebP, cached for a year", async () => {
  const response = await serve(new Request(BASE + KEY), bucketWith({ [KEY]: "bytes" }));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/webp");
  assert.equal(response.headers.get("cache-control"), "public, max-age=31536000, immutable");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("cross-origin-resource-policy"), "cross-origin");
  assert.equal(await response.text(), "bytes");
});

test("one that does not exist is a 404", async () => {
  const response = await serve(new Request(BASE + KEY), bucketWith({}));
  assert.equal(response.status, 404);
});

test("an address that is not a picture is a 404 and the bucket is not even asked", async () => {
  const bucket = bucketWith({ [KEY]: "bytes" });
  for (const path of ["", "secret.txt", "b12/../secret.txt"]) {
    assert.equal((await serve(new Request(BASE + path), bucket)).status, 404, path);
  }
  assert.deepEqual(bucket.reads, []);
});

test("a browser that already has it gets a 304 without the body", async () => {
  const request = new Request(BASE + KEY, { headers: { "if-none-match": '"abc123"' } });
  const response = await serve(request, bucketWith({ [KEY]: "bytes" }));

  assert.equal(response.status, 304);
  assert.equal(await response.text(), "");
});

test("only reading is allowed", async () => {
  const response = await serve(new Request(BASE + KEY, { method: "POST", body: "x" }), bucketWith({ [KEY]: "bytes" }));

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET, HEAD");
});

test("a HEAD request has the headers and no body", async () => {
  const response = await serve(new Request(BASE + KEY, { method: "HEAD" }), bucketWith({ [KEY]: "bytes" }));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/webp");
  assert.equal(await response.text(), "");
});
