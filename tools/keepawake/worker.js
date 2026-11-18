// Keeps the free Render API awake while people are likely to book (D119).
//
// Cloudflare runs `scheduled` every 10 minutes (see wrangler.jsonc). Render puts a free service
// to sleep after 15 minutes without traffic, and one visit resets that timer. We only visit
// during the day in Lima: awake around the clock uses about 744 of the 750 free hours a month
// and Render suspends every free service when they run out; daytime only uses about 500.

/** Peru has no daylight saving time: Lima is always UTC-5. */
const LIMA_OFFSET_HOURS = -5;

/** First hour (included) and last hour (excluded) of the day we keep the API awake, in Lima time. */
export const FIRST_HOUR = 7;
export const LAST_HOUR = 23;

/** A sleeping service needs about a minute to wake, so the visit may take that long. */
const WAIT_MS = 90_000;

/** The hour of the day in Lima (0 to 23) at the given moment. */
export function limaHour(now) {
  return (now.getUTCHours() + LIMA_OFFSET_HOURS + 24) % 24;
}

/** True when the API should be kept awake at this moment. */
export function shouldKeepAwake(now) {
  const hour = limaHour(now);
  return hour >= FIRST_HOUR && hour < LAST_HOUR;
}

/**
 * Only `/api/ping/` is allowed. `/api/health/` opens the database and would keep the free Neon
 * database awake too, which spends its 100 monthly compute hours (D117).
 */
export function pingUrl(value) {
  let url;
  try {
    url = new URL(value ?? "");
  } catch {
    throw new Error("PING_URL is missing or is not a valid address");
  }
  if (url.protocol !== "https:") throw new Error("PING_URL must use https");
  if (url.pathname !== "/api/ping/") throw new Error("PING_URL must end in /api/ping/");
  return url.toString();
}

/** Headers that tell who answered: Cloudflare's edge, Render's router or our own server. */
const CLUE_HEADERS = ["server", "cf-ray", "rndr-id", "x-render-origin-server", "x-render-routing", "content-type"];

/** What a failed answer says about where it came from, to read in the logs. Never throws. */
export async function clues(response) {
  const headers = {};
  for (const name of CLUE_HEADERS) {
    const value = response.headers.get(name);
    if (value) headers[name] = value;
  }
  let body = "";
  try {
    body = (await response.text()).replace(/\s+/g, " ").slice(0, 200);
  } catch {
    // The body could not be read; the headers are still worth having.
  }
  return { headers, body };
}

/**
 * One visit. Returns what happened, so it can be logged and tested:
 * `skipped` outside the daytime window, `ok` when the API answered, `failed` otherwise.
 */
export async function keepAwake(env, { now = new Date(), fetchFn = fetch } = {}) {
  if (!shouldKeepAwake(now)) return { result: "skipped" };

  const url = pingUrl(env.PING_URL);
  try {
    const response = await fetchFn(url, {
      signal: AbortSignal.timeout(WAIT_MS),
      headers: { "user-agent": "MiReserva keep-awake (Cloudflare Worker)" },
    });
    if (response.ok) return { result: "ok", status: response.status };
    return { result: "failed", status: response.status, ...(await clues(response)) };
  } catch (error) {
    return { result: "failed", error: String(error) };
  }
}

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      keepAwake(env).then((outcome) => {
        if (outcome.result === "failed") console.error("keep-awake failed", JSON.stringify(outcome));
        else console.log("keep-awake", JSON.stringify(outcome));
      }),
    );
  },

  // Opening the Worker's address in a browser says what it is, and visits nothing.
  async fetch() {
    return new Response("MiReserva keep-awake: runs on a schedule, nothing to see here.\n", {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
};
