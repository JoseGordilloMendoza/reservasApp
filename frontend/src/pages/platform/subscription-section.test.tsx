import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Payment, PlatformBusiness } from "../../lib/platformTypes";
import { renderApp, signedInRoutes } from "../../test/helpers";
import { TEAM, businessPage } from "../../test/platform";

afterEach(() => {
  vi.unstubAllGlobals();
});

const BASE = "/platform/businesses/canchas-los-andes";
const PATH = "/plataforma/negocios/canchas-los-andes?seccion=suscripcion";

const payment = (overrides: Partial<Payment> = {}): Payment => ({
  id: 1,
  amount: "80.00",
  method: "yape",
  paid_on: "2030-03-20",
  months: 1,
  period_start: "2030-04-01",
  period_end: "2030-04-30",
  reference: "",
  note: "",
  recorded_by: "equipo@example.com",
  created_at: "2030-03-20T10:00:00Z",
  ...overrides,
});

function open(business: PlatformBusiness = businessPage(), payments: Payment[] = [], extra: Parameters<typeof signedInRoutes>[0] = {}) {
  const api = signedInRoutes({
    "GET /auth/me/": { status: 200, body: TEAM },
    [`GET ${BASE}/`]: { status: 200, body: business },
    [`GET ${BASE}/payments/`]: { status: 200, body: payments },
    ...extra,
  });
  renderApp(PATH);
  return api;
}

const called = (api: ReturnType<typeof open>, method: string, path: string) =>
  api.calls.find((call) => call.method === method && call.path === path);

describe("the subscription of a business", () => {
  it("shows the plan, the price, until when it is valid and the notes", async () => {
    open(businessPage({ subscription: { ...businessPage().subscription!, notes: "Descuento acordado" } }));

    const state = within(await screen.findByRole("region", { name: "Suscripción" }));
    expect(state.getByText("Mensual")).toBeInTheDocument();
    expect(state.getByText("S/ 80")).toBeInTheDocument();
    expect(state.getByText("31 mar 2030")).toBeInTheDocument();
    expect(state.getByText("Descuento acordado")).toBeInTheDocument();
  });

  it("says until when a business in its grace days still takes bookings", async () => {
    open(businessPage({ standing: { state: "grace", valid_until: "2030-03-31", grace_ends_on: "2030-04-05", days_left: -2 } }));

    expect(await screen.findByText("Recibe reservas hasta el")).toBeInTheDocument();
    expect(screen.getByText("5 abr 2030")).toBeInTheDocument();
  });

  it("explains that without one the business never expires, and offers to create it", async () => {
    open(businessPage({ subscription: null, standing: { state: "none", valid_until: null, grace_ends_on: null, days_left: null } }));

    expect(await screen.findByText(/nunca vence/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear la suscripción" })).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Registrar un pago" })).not.toBeInTheDocument();
  });

  it("creates one", async () => {
    const api = open(
      businessPage({ subscription: null, standing: { state: "none", valid_until: null, grace_ends_on: null, days_left: null } }),
      [],
      { [`PUT ${BASE}/subscription/`]: { status: 201, body: businessPage().subscription } },
    );
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Crear la suscripción" }));
    const form = within(screen.getByRole("form", { name: "Crear la suscripción" }));
    await user.type(form.getByLabelText("Plan (opcional)"), "Mensual");
    await user.type(form.getByLabelText("Precio al mes (S/)"), "80");
    await user.type(form.getByLabelText("Vale hasta el"), "2030-05-01");
    await user.click(form.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(called(api, "PUT", `${BASE}/subscription/`)?.body).toEqual({ plan_name: "Mensual", price: "80.00", valid_until: "2030-05-01" }),
    );
  });
});

describe("recording a payment", () => {
  it("proposes the agreed price, one month, paid with Yape", async () => {
    open();

    const form = within(await screen.findByRole("form", { name: "Registrar un pago" }));
    expect(form.getByLabelText("Monto (S/)")).toHaveValue("80");
    expect(form.getByLabelText("Meses que paga")).toHaveValue("1");
    expect(form.getByLabelText("Cómo pagó")).toHaveValue("yape");
  });

  it("sends it and says what the payment bought", async () => {
    const api = open(businessPage(), [], { [`POST ${BASE}/payments/`]: { status: 201, body: payment() } });
    const user = userEvent.setup();

    const form = within(await screen.findByRole("form", { name: "Registrar un pago" }));
    await user.click(form.getByRole("button", { name: "Registrar pago" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Pago registrado: cubre del 1 abr 2030 al 30 abr 2030.");
    expect(called(api, "POST", `${BASE}/payments/`)?.body).toEqual({ amount: "80.00", method: "yape", months: 1 });
  });

  it("sends everything that was filled in", async () => {
    const api = open(businessPage(), [], { [`POST ${BASE}/payments/`]: { status: 201, body: payment({ months: 3 }) } });
    const user = userEvent.setup();

    const form = within(await screen.findByRole("form", { name: "Registrar un pago" }));
    await user.clear(form.getByLabelText("Monto (S/)"));
    await user.type(form.getByLabelText("Monto (S/)"), "240");
    await user.clear(form.getByLabelText("Meses que paga"));
    await user.type(form.getByLabelText("Meses que paga"), "3");
    await user.selectOptions(form.getByLabelText("Cómo pagó"), "transfer");
    await user.type(form.getByLabelText("Referencia (opcional)"), "Op. 123");
    await user.type(form.getByLabelText("Nota (opcional)"), "Pagó su hermana");
    await user.click(form.getByRole("button", { name: "Registrar pago" }));

    await waitFor(() =>
      expect(called(api, "POST", `${BASE}/payments/`)?.body).toEqual({
        amount: "240.00",
        method: "transfer",
        months: 3,
        reference: "Op. 123",
        note: "Pagó su hermana",
      }),
    );
  });

  it("checks the amount before calling the server", async () => {
    const api = open();
    const user = userEvent.setup();

    const form = within(await screen.findByRole("form", { name: "Registrar un pago" }));
    await user.clear(form.getByLabelText("Monto (S/)"));
    await user.click(form.getByRole("button", { name: "Registrar pago" }));

    expect(await screen.findByText("Escribe cuánto pagó.")).toBeInTheDocument();
    expect(called(api, "POST", `${BASE}/payments/`)).toBeUndefined();
  });

  it("shows the server's complaint under its field", async () => {
    open(businessPage(), [], { [`POST ${BASE}/payments/`]: { status: 400, body: { paid_on: ["La fecha del pago no puede ser futura."] } } });
    const user = userEvent.setup();

    const form = within(await screen.findByRole("form", { name: "Registrar un pago" }));
    await user.click(form.getByRole("button", { name: "Registrar pago" }));

    expect(await screen.findByText("La fecha del pago no puede ser futura.")).toBeInTheDocument();
  });

  it("starts over for the next payment, with the price proposed again", async () => {
    open(businessPage(), [], { [`POST ${BASE}/payments/`]: { status: 201, body: payment() } });
    const user = userEvent.setup();

    const form = within(await screen.findByRole("form", { name: "Registrar un pago" }));
    await user.type(form.getByLabelText("Referencia (opcional)"), "Op. 1");
    await user.click(form.getByRole("button", { name: "Registrar pago" }));
    await screen.findByRole("status");

    expect(form.getByLabelText("Referencia (opcional)")).toHaveValue("");
    expect(form.getByLabelText("Monto (S/)")).toHaveValue("80");
  });
});

describe("correcting a subscription", () => {
  async function openAdjust(api = open(businessPage(), [], { [`PUT ${BASE}/subscription/`]: { status: 200, body: businessPage().subscription } })) {
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Ajustar la suscripción" }));
    return { api, user, form: within(screen.getByRole("form", { name: "Ajustar la suscripción" })) };
  }

  it("sends only what changed, with no reason when the end date stays", async () => {
    const { api, user, form } = await openAdjust();

    await user.clear(form.getByLabelText("Plan (opcional)"));
    await user.type(form.getByLabelText("Plan (opcional)"), "Anual");
    expect(form.queryByLabelText("¿Por qué cambias la vigencia?")).not.toBeInTheDocument();
    await user.click(form.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(called(api, "PUT", `${BASE}/subscription/`)?.body).toEqual({ plan_name: "Anual" }));
  });

  it("asks why when the end date is moved, and will not send it without a reason", async () => {
    const { api, user, form } = await openAdjust();

    await user.clear(form.getByLabelText("Vale hasta el"));
    await user.type(form.getByLabelText("Vale hasta el"), "2030-04-15");
    expect(form.getByLabelText("¿Por qué cambias la vigencia?")).toBeInTheDocument();
    await user.click(form.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Explica por qué cambias la vigencia a mano.")).toBeInTheDocument();
    expect(called(api, "PUT", `${BASE}/subscription/`)).toBeUndefined();
  });

  it("sends the new end with its reason", async () => {
    const { api, user, form } = await openAdjust();

    await user.clear(form.getByLabelText("Vale hasta el"));
    await user.type(form.getByLabelText("Vale hasta el"), "2030-04-15");
    await user.type(form.getByLabelText("¿Por qué cambias la vigencia?"), "Cortesía por la falla");
    await user.click(form.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(called(api, "PUT", `${BASE}/subscription/`)?.body).toEqual({ valid_until: "2030-04-15", reason: "Cortesía por la falla" }),
    );
  });

  it("closes without calling the server when nothing changed", async () => {
    const { api, user, form } = await openAdjust();

    await user.click(form.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(screen.queryByRole("form", { name: "Ajustar la suscripción" })).not.toBeInTheDocument());
    expect(called(api, "PUT", `${BASE}/subscription/`)).toBeUndefined();
  });

  it("can be cancelled", async () => {
    const { user, form } = await openAdjust();

    await user.click(form.getByRole("button", { name: "Cancelar" }));

    expect(screen.getByRole("button", { name: "Ajustar la suscripción" })).toBeInTheDocument();
  });
});

describe("the history of payments", () => {
  it("lists them with what each one covers", async () => {
    open(businessPage(), [
      payment({ id: 2, amount: "240.00", months: 3, method: "transfer", period_start: "2030-05-01", period_end: "2030-07-31", reference: "Op. 99", note: "Pagó su hermana" }),
      payment(),
    ]);

    const history = within(await screen.findByRole("region", { name: "Pagos recibidos" }));
    const items = await history.findAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("S/ 240");
    expect(items[0]).toHaveTextContent("Transferencia");
    expect(items[0]).toHaveTextContent("Cubre del 1 may 2030 al 31 jul 2030 (3 meses)");
    expect(items[0]).toHaveTextContent("Ref. Op. 99");
    expect(items[0]).toHaveTextContent("Pagó su hermana");
    expect(items[1]).toHaveTextContent("Registrado por equipo@example.com");
    expect(items[1]).not.toHaveTextContent("meses)");
  });

  it("says when there are none yet", async () => {
    open();

    expect(await screen.findByText("Todavía no hay pagos registrados.")).toBeInTheDocument();
  });

  it("says when they could not be loaded", async () => {
    open(businessPage(), [], { [`GET ${BASE}/payments/`]: { status: 500, body: { detail: "Falla del servidor" } } });

    expect(await screen.findByText(/No pudimos cargar los pagos/)).toBeInTheDocument();
  });
});
