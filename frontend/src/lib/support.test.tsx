import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OWNER, PANEL_BUSINESS, page, renderApp, signedInRoutes } from "../test/helpers";
import { getBusinessSlug, getSupport, setSupport } from "./session";
import type { SupportInfo } from "./session";

afterEach(() => {
  vi.unstubAllGlobals();
});

const IN_AN_HOUR = new Date(Date.now() + 3_600_000).toISOString();

const SUPPORT: SupportInfo = {
  session: 7,
  slug: "canchas-los-andes",
  name: "Canchas Los Andes",
  reason: "Ayuda con los horarios",
  expires_at: IN_AN_HOUR,
};

/** Someone from the platform team: no business of their own. */
const TEAM = { ...OWNER, email: "equipo@example.com", is_platform_admin: true, memberships: [] };

function openPanel(me = TEAM) {
  return signedInRoutes({
    "GET /auth/me/": { status: 200, body: me },
    "GET /panel/bookings/": { status: 200, body: page([]) },
  });
}

describe("the stored support session", () => {
  it("is returned while it lasts", () => {
    setSupport(SUPPORT);

    expect(getSupport()).toEqual(SUPPORT);
  });

  it("is forgotten once it expires", () => {
    setSupport(SUPPORT);

    expect(getSupport(Date.parse(IN_AN_HOUR) + 1)).toBeNull();
  });

  it("is nothing when nothing was stored, or what was stored is broken", () => {
    expect(getSupport()).toBeNull();

    localStorage.setItem("separa.support.v1", "{not json");
    expect(getSupport()).toBeNull();
  });
});

describe("working inside a business as the platform team", () => {
  it("opens that business panel, with its name, though the team member belongs to none", async () => {
    setSupport(SUPPORT);
    openPanel();
    renderApp("/panel");

    expect(await screen.findByRole("heading", { name: /Hola/ })).toBeInTheDocument();
    expect(screen.getAllByText("Canchas Los Andes").length).toBeGreaterThan(0);
  });

  it("names the business on every panel call", async () => {
    setSupport(SUPPORT);
    const api = openPanel();
    renderApp("/panel");

    await screen.findByRole("heading", { name: /Hola/ });

    const call = api.fetchMock.mock.calls.find(([url]) => String(url).includes("/panel/business/"));
    expect((call?.[1] as RequestInit).headers).toMatchObject({ "X-Business": "canchas-los-andes" });
    expect(getBusinessSlug()).toBe("canchas-los-andes");
  });

  it("without a support session the team member has no business to work on", async () => {
    openPanel();
    renderApp("/panel");

    expect(await screen.findByText("Esta cuenta no tiene un negocio")).toBeInTheDocument();
  });

  it("an expired support session gives no access", async () => {
    setSupport({ ...SUPPORT, expires_at: new Date(Date.now() - 1000).toISOString() });
    openPanel();
    renderApp("/panel");

    expect(await screen.findByText("Esta cuenta no tiene un negocio")).toBeInTheDocument();
  });

  it("a business owner cannot use a support session someone left in the browser", async () => {
    setSupport(SUPPORT);
    signedInRoutes({
      "GET /panel/bookings/": { status: 200, body: page([]) },
      "GET /panel/business/": { status: 200, body: { ...PANEL_BUSINESS, slug: "canchas-los-andes" } },
    });
    renderApp("/panel");

    await screen.findByRole("heading", { name: /Hola/ });
    // The owner's own business is the one in use, not the support one.
    expect(getBusinessSlug()).toBe(OWNER.memberships[0]?.business.slug);
  });

  it("signing out forgets the support session", async () => {
    setSupport(SUPPORT);
    openPanel();
    renderApp("/panel");
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: /Hola/ });
    await user.click(screen.getAllByRole("button", { name: "Salir" })[0]!);

    expect(getSupport()).toBeNull();
  });
});
