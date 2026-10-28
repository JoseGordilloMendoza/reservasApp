import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, api, flattenFieldErrors } from "./api";

function respond(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      text: async () => (body === null ? "" : JSON.stringify(body)),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    return error as ApiError;
  }
  throw new Error("expected the call to fail");
}

describe("api requests", () => {
  it("returns the body when the call succeeds", async () => {
    respond(200, { name: "Cancha Los Andes" });

    await expect(api.business("cancha-los-andes")).resolves.toEqual({ name: "Cancha Los Andes" });
  });

  it("asks for the right addresses", async () => {
    respond(200, { timezone: "America/Lima", slots: [] });

    await api.availability("cancha-los-andes", { resource: 3, service: 5, from: "2030-01-07", to: "2030-01-20" });

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/public/businesses/cancha-los-andes/availability/?resource=3&service=5&date=2030-01-07&to_date=2030-01-20",
      expect.anything(),
    );
  });

  it("sends a booking as JSON", async () => {
    respond(201, { manage_token: "abc" });

    await api.createBooking("cancha-los-andes", {
      service: 5,
      starts_at: "2030-01-08T00:00:00Z",
      customer: { name: "Ana", phone: "987654321", email: "" },
      accepted_terms: true,
    });

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string).customer.name).toBe("Ana");
  });

  it("escapes the booking token in the address", async () => {
    respond(200, {});

    await api.booking("a/b c");

    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe("/api/v1/public/bookings/a%2Fb%20c/");
  });
});

describe("api errors", () => {
  it("keeps the stable code and the Spanish message of a broken rule", async () => {
    respond(409, { code: "slot_unavailable", detail: "Ese horario ya no está disponible. Elige otro." });

    const error = await failure(api.booking("x"));

    expect(error).toBeInstanceOf(ApiError);
    expect([error.status, error.code]).toEqual([409, "slot_unavailable"]);
    expect(error.message).toBe("Ese horario ya no está disponible. Elige otro.");
  });

  it("turns validation errors into one message per field", async () => {
    respond(400, { customer: { phone: ["El número de celular no es válido."] }, accepted_terms: ["Debes aceptar."] });

    const error = await failure(api.booking("x"));

    expect(error.code).toBe("invalid");
    expect(error.fields).toEqual({
      "customer.phone": "El número de celular no es válido.",
      accepted_terms: "Debes aceptar.",
    });
  });

  it("explains being rate limited", async () => {
    respond(429, { detail: "Request was throttled." });

    const error = await failure(api.booking("x"));

    expect(error.code).toBe("throttled");
    expect(error.message).toMatch(/Espera/);
  });

  it("explains a lost connection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const error = await failure(api.booking("x"));

    expect(error.code).toBe("network");
    expect(error.message).toMatch(/conexión/);
  });

  it("does not choke on a body that is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 502, text: async () => "<html>Bad gateway</html>" }),
    );

    const error = await failure(api.booking("x"));

    expect([error.status, error.code]).toEqual([502, "unknown"]);
    expect(error.message).toMatch(/Algo salió mal/);
  });
});

describe("flattenFieldErrors", () => {
  it("handles nested objects, lists and plain strings", () => {
    expect(flattenFieldErrors({ a: ["uno"], b: { c: ["dos"], d: { e: "tres" } } })).toEqual({
      a: "uno",
      "b.c": "dos",
      "b.d.e": "tres",
    });
  });

  it("returns nothing for other shapes", () => {
    expect(flattenFieldErrors(null)).toEqual({});
    expect(flattenFieldErrors("text")).toEqual({});
  });
});
