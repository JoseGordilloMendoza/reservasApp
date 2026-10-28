import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { page, panelBooking, renderApp, signedInRoutes, slotAt } from "../../test/helpers";

afterEach(() => {
  vi.unstubAllGlobals();
});

type Call = { path: string; method: string; body: unknown };
const listCalls = (calls: Call[]) => calls.filter((call) => call.path === "/panel/bookings/");

const named = (id: number, name: string, hour: number, day = 1) =>
  panelBooking({
    id,
    status: "confirmed",
    starts_at: slotAt(day, hour).starts_at,
    ends_at: slotAt(day, hour).ends_at,
    customer: { id, name, phone: "+51987654321", email: "", is_blocked: false },
  });

describe("the bookings page", () => {
  it("shows the upcoming ones first, grouped under their day", async () => {
    signedInRoutes({
      "GET /panel/bookings/": {
        status: 200,
        body: page([named(1, "Ana Pérez", 17), named(2, "Luis Ramos", 18), named(3, "Marta Díaz", 17, 3)]),
      },
    });
    renderApp("/panel/reservas");

    expect(await screen.findByRole("heading", { level: 2, name: "Mañana" })).toBeInTheDocument();
    const [firstDay, secondDay] = screen.getAllByRole("region");

    expect(within(firstDay!).getAllByRole("link")).toHaveLength(2);
    expect(within(secondDay!).getAllByRole("link")).toHaveLength(1);
    expect(screen.getByText("3 reservas")).toBeInTheDocument();
  });

  it("asks only for upcoming live bookings by default, and not before the calendar is known", async () => {
    const asked: URLSearchParams[] = [];
    signedInRoutes({
      "GET /panel/bookings/": (_init, query) => {
        asked.push(query);
        return { status: 200, body: page([]) };
      },
    });
    renderApp("/panel/reservas");

    await screen.findByText("No hay reservas próximas.");

    expect(asked).toHaveLength(1);
    expect(asked[0]?.get("status")).toBe("pending,confirmed");
    expect(asked[0]?.get("date_from")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(asked[0]?.get("ordering")).toBe("starts_at");
  });

  it("switches the filters with the tabs", async () => {
    const urls: string[] = [];
    signedInRoutes({
      "GET /panel/bookings/": (_init, query) => {
        urls.push(query.toString());
        return { status: 200, body: page([]) };
      },
    });
    renderApp("/panel/reservas");
    const user = userEvent.setup();

    await screen.findByText("No hay reservas próximas.");
    await user.click(screen.getByRole("tab", { name: "Por confirmar" }));
    await screen.findByText("No hay reservas por confirmar.");
    await user.click(screen.getByRole("tab", { name: "Pasadas" }));
    await screen.findByText("Todavía no hay reservas pasadas.");
    await user.click(screen.getByRole("tab", { name: "Canceladas" }));
    await screen.findByText("No hay reservas canceladas.");

    const params = urls.map((url) => new URLSearchParams(url));
    expect(params.some((p) => p.get("status") === "pending,confirmed" && p.has("date_from"))).toBe(true);
    expect(params.some((p) => p.get("status") === "pending" && !p.has("date_from"))).toBe(true);
    expect(params.some((p) => p.has("date_to") && p.get("ordering") === "-starts_at")).toBe(true);
    expect(params.some((p) => p.get("status") === "cancelled,expired")).toBe(true);
  });

  it("marks the tab that is open", async () => {
    signedInRoutes({ "GET /panel/bookings/": { status: 200, body: page([]) } });
    renderApp("/panel/reservas");
    const user = userEvent.setup();

    expect(await screen.findByRole("tab", { name: "Próximas" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: "Pasadas" }));

    expect(screen.getByRole("tab", { name: "Pasadas" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Próximas" })).toHaveAttribute("aria-selected", "false");
  });

  it("searches by name or phone", async () => {
    const searches: (string | null)[] = [];
    signedInRoutes({
      "GET /panel/bookings/": (_init, query) => {
        searches.push(query.get("q"));
        return { status: 200, body: page([]) };
      },
    });
    renderApp("/panel/reservas");
    const user = userEvent.setup();

    await screen.findByText("No hay reservas próximas.");
    await user.type(screen.getByRole("searchbox", { name: "Buscar por nombre o celular" }), "Rosa");

    await waitFor(() => expect(searches).toContain("Rosa"));
    expect(await screen.findByText("Nada coincide con tu búsqueda.")).toBeInTheDocument();
  });

  it("loads more when there are more pages", async () => {
    const { calls } = signedInRoutes({
      "GET /panel/bookings/": (_init, query) =>
        query.get("page") === "2"
          ? { status: 200, body: page([named(2, "Luis Ramos", 18)], { count: 2 }) }
          : { status: 200, body: page([named(1, "Ana Pérez", 17)], { count: 2, next: "http://x/?page=2" }) },
    });
    renderApp("/panel/reservas");
    const user = userEvent.setup();

    await screen.findByRole("link", { name: /Ana Pérez/ });
    await user.click(screen.getByRole("button", { name: "Ver más" }));

    expect(await screen.findByRole("link", { name: /Luis Ramos/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver más" })).not.toBeInTheDocument();
    expect(listCalls(calls)).toHaveLength(2);
  });

  it("offers a retry when the list cannot be loaded", async () => {
    signedInRoutes({ "GET /panel/bookings/": { status: 500, body: { detail: "boom" } } });
    renderApp("/panel/reservas");

    expect(await screen.findByText(/No pudimos cargar las reservas/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Intentar otra vez" })).toBeInTheDocument();
  });
});
