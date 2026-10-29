import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getBusinessSlug, getSupport, setSupport } from "../../lib/session";
import type { SupportInfo } from "../../lib/session";
import { page, renderApp, signedInRoutes } from "../../test/helpers";
import { TEAM } from "../../test/platform";

afterEach(() => {
  vi.unstubAllGlobals();
});

const soon = (ms: number) => new Date(Date.now() + ms).toISOString();

const support = (overrides: Partial<SupportInfo> = {}): SupportInfo => ({
  session: 7,
  slug: "canchas-los-andes",
  name: "Canchas Los Andes",
  reason: "Ayuda con los horarios",
  expires_at: soon(3_600_000),
  ...overrides,
});

function openInside(info: SupportInfo, extra: Parameters<typeof signedInRoutes>[0] = {}) {
  setSupport(info);
  const api = signedInRoutes({
    "GET /auth/me/": { status: 200, body: TEAM },
    "GET /panel/bookings/": { status: 200, body: page([]) },
    "POST /platform/support-sessions/7/end/": { status: 200, body: { id: 7 } },
    "GET /platform/dashboard/": { status: 404, body: {} },
    ...extra,
  });
  renderApp("/panel");
  return api;
}

describe("the support bar", () => {
  it("says it is a support session, in which business, until when, and that changes are logged", async () => {
    openInside(support());

    const bar = await screen.findByText(/Sesión de soporte en Canchas Los Andes/);
    expect(bar).toHaveTextContent("Vence a las");
    expect(bar).toHaveTextContent("Cada cambio queda registrado");
  });

  it("is not shown to a business owner in their own panel", async () => {
    signedInRoutes({ "GET /panel/bookings/": { status: 200, body: page([]) } });
    renderApp("/panel");

    await screen.findByRole("heading", { name: /Hola/ });
    expect(screen.queryByText(/Sesión de soporte/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Terminar soporte" })).not.toBeInTheDocument();
  });

  it("ends the session on the server, forgets it, and goes back to the team area", async () => {
    const api = openInside(support());
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Terminar soporte" }));

    expect(await screen.findByText("Equipo de la plataforma")).toBeInTheDocument();
    expect(api.calls.some((call) => call.method === "POST" && call.path === "/platform/support-sessions/7/end/")).toBe(true);
    expect(getSupport()).toBeNull();
    expect(getBusinessSlug()).toBeNull();
  });

  it("steps out even when the server cannot be reached", async () => {
    openInside(support(), { "POST /platform/support-sessions/7/end/": { status: 500, body: { detail: "Falla" } } });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Terminar soporte" }));

    expect(await screen.findByText("Equipo de la plataforma")).toBeInTheDocument();
    expect(getSupport()).toBeNull();
  });

  it("steps out by itself when the session runs out", async () => {
    openInside(support({ expires_at: soon(300) }));

    await screen.findByText(/Sesión de soporte en/);
    expect(await screen.findByText("Equipo de la plataforma")).toBeInTheDocument();
    await waitFor(() => expect(getSupport()).toBeNull());
  });

  it("does not offer the way to the team area while inside, only the end button", async () => {
    openInside(support());

    await screen.findByText(/Sesión de soporte en/);
    expect(screen.queryByRole("link", { name: "Ir a la plataforma" })).not.toBeInTheDocument();
  });
});
