import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BUSINESS, TZ, bookingDetails, mockApi, renderApp, slotAt } from "../test/helpers";

// Google's own button cannot run here; this one hands over a token the way it would.
vi.mock("../components/GoogleSignInButton", () => ({
  googleClientId: () => "client-id",
  GoogleSignInButton: ({ onCredential, onError }: { onCredential: (credential: string) => void; onError: (message: string) => void }) => (
    <>
      <button type="button" onClick={() => onCredential(fakeToken)}>
        Continuar con Google
      </button>
      <button type="button" onClick={() => onError("No pudimos cargar el acceso con Google.")}>
        Fallar Google
      </button>
    </>
  ),
}));

const fakeToken = `h.${btoa(JSON.stringify({ name: "Rosa Quispe", email: "rosa@gmail.com" }))}.s`;

afterEach(() => {
  vi.unstubAllGlobals();
});

const PATH = "/canchas-los-andes";
const POST = "POST /public/businesses/canchas-los-andes/bookings/";

function api(extra: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    "GET /public/businesses/canchas-los-andes/": { status: 200, body: BUSINESS },
    "GET /public/businesses/canchas-los-andes/availability/": {
      status: 200,
      body: { timezone: TZ, slots: [slotAt(1, 17), slotAt(1, 18)] },
    },
    [POST]: { status: 201, body: { ...bookingDetails(), manage_token: "tok-123" } },
    ...extra,
  });
}

const post = (calls: ReturnType<typeof mockApi>["calls"]) => calls.find((call) => call.method === "POST")?.body as Record<string, unknown>;

describe("booking with Google", () => {
  it("offers it as optional, and says why", async () => {
    api();
    renderApp(PATH);

    expect(await screen.findByRole("button", { name: "Continuar con Google" })).toBeInTheDocument();
    expect(screen.getByText(/Opcional\. Con Google, el negocio sabe que eres tú/)).toBeInTheDocument();
  });

  it("fills in the name and the email from Google, keeps the email as it is, and says the booking is verified", async () => {
    api();
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByRole("button", { name: "Continuar con Google" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Entraste con Google como rosa@gmail.com. Tu reserva queda verificada.");
    expect(screen.getByLabelText("Tu nombre")).toHaveValue("Rosa Quispe");
    expect(screen.getByLabelText("Correo (opcional)")).toHaveValue("rosa@gmail.com");
    expect(screen.getByLabelText("Correo (opcional)")).toHaveAttribute("readonly");
  });

  it("does not overwrite a name the customer already typed", async () => {
    api();
    const user = userEvent.setup();
    renderApp(PATH);

    await user.type(await screen.findByLabelText("Tu nombre"), "Rosita");
    await user.click(screen.getByRole("button", { name: "Continuar con Google" }));

    expect(screen.getByLabelText("Tu nombre")).toHaveValue("Rosita");
  });

  it("still asks for the phone, which Google does not give", async () => {
    const { calls } = api();
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByRole("button", { name: "Continuar con Google" }));
    await user.click(screen.getByLabelText(/Acepto que/));
    await user.click(screen.getByRole("button", { name: /Reservar/ }));

    await waitFor(() => expect(screen.getByLabelText("Tu celular")).toHaveAttribute("aria-invalid", "true"));
    expect(calls.some((call) => call.method === "POST")).toBe(false);
  });

  it("sends the token with the booking, for the server to verify", async () => {
    const { calls } = api();
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByRole("button", { name: "Continuar con Google" }));
    await user.type(screen.getByLabelText("Tu celular"), "987 111 222");
    await user.click(screen.getByLabelText(/Acepto que/));
    await user.click(screen.getByRole("button", { name: /Reservar/ }));

    await waitFor(() => expect(post(calls)).toBeDefined());
    expect(post(calls).google_credential).toBe(fakeToken);
    expect(post(calls).customer).toMatchObject({ name: "Rosa Quispe", email: "rosa@gmail.com" });
  });

  it("sends no token when the customer books without Google", async () => {
    const { calls } = api();
    const user = userEvent.setup();
    renderApp(PATH);

    await user.type(await screen.findByLabelText("Tu nombre"), "Rosa");
    await user.type(screen.getByLabelText("Tu celular"), "987 111 222");
    await user.click(screen.getByLabelText(/Acepto que/));
    await user.click(screen.getByRole("button", { name: /Reservar/ }));

    await waitFor(() => expect(post(calls)).toBeDefined());
    expect(post(calls)).not.toHaveProperty("google_credential");
  });

  it("lets the customer take Google back and book as anyone else would", async () => {
    const { calls } = api();
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByRole("button", { name: "Continuar con Google" }));
    await user.click(screen.getByRole("button", { name: "Quitar" }));
    await user.type(screen.getByLabelText("Tu celular"), "987 111 222");
    await user.click(screen.getByLabelText(/Acepto que/));
    await user.click(screen.getByRole("button", { name: /Reservar/ }));

    await waitFor(() => expect(post(calls)).toBeDefined());
    expect(post(calls)).not.toHaveProperty("google_credential");
  });

  it("drops a token the server refused and says why, so the customer can try again", async () => {
    api({ [POST]: { status: 400, body: { code: "invalid_google_token", detail: "No pudimos verificar tu cuenta de Google." } } });
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByRole("button", { name: "Continuar con Google" }));
    await user.type(screen.getByLabelText("Tu celular"), "987 111 222");
    await user.click(screen.getByLabelText(/Acepto que/));
    await user.click(screen.getByRole("button", { name: /Reservar/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos verificar tu cuenta de Google.");
    expect(screen.getByRole("button", { name: "Continuar con Google" })).toBeInTheDocument();
  });

  it("shows what went wrong when Google cannot load, and the form still works", async () => {
    api();
    const user = userEvent.setup();
    renderApp(PATH);

    await user.click(await screen.findByRole("button", { name: "Fallar Google" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar el acceso con Google.");
    expect(screen.getByLabelText("Tu nombre")).toBeEnabled();
  });
});
