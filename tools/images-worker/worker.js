// Serves the business pictures kept in the private R2 bucket (D119).
//
// The bucket is not public: this Worker reads it through a binding and hands out only what the API
// wrote, which is a WebP named like `b12/logo-3fa9c1d2e4b56789.webp`. Every picture gets a new name
// when it is replaced, so browsers may keep one for a year without ever showing an old version.

/** The only names that exist: business number, what it is, 16 random hex digits. */
const KEY = /^b[0-9]{1,12}\/(logo|cover)-[0-9a-f]{16}\.webp$/;

const CACHE_CONTROL = "public, max-age=31536000, immutable";

/** The key a request asks for, or null when the address is not one we ever hand out. */
export function keyOf(url) {
  let path;
  try {
    path = decodeURIComponent(new URL(url).pathname.slice(1));
  } catch {
    return null;
  }
  return KEY.test(path) ? path : null;
}

function answer(status, body, extra = {}) {
  return new Response(body, {
    status,
    headers: { "x-content-type-options": "nosniff", ...extra },
  });
}

export async function serve(request, bucket) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return answer(405, "Method not allowed\n", { allow: "GET, HEAD" });
  }

  const key = keyOf(request.url);
  if (!key) return answer(404, "Not found\n", { "content-type": "text/plain; charset=utf-8" });

  const object = await bucket.get(key);
  if (!object) return answer(404, "Not found\n", { "content-type": "text/plain; charset=utf-8" });

  const headers = {
    "content-type": "image/webp",
    "cache-control": CACHE_CONTROL,
    etag: object.httpEtag,
    // The pictures are shown on pages of another address (the frontend's).
    "cross-origin-resource-policy": "cross-origin",
  };

  if (request.headers.get("if-none-match") === object.httpEtag) return answer(304, null, headers);
  return answer(200, request.method === "HEAD" ? null : object.body, headers);
}

export default {
  async fetch(request, env) {
    return serve(request, env.BUCKET);
  },
};
