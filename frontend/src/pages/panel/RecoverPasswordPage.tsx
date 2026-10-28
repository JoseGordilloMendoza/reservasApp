import { EnvelopeSimple, WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import { BRAND } from "../../lib/brand";
import { ApiError } from "../../lib/http";
import { panelApi } from "../../lib/panelApi";

/** Step one of recovering a password: ask for the link. The answer is the same for any address. */
export function RecoverPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asked, setAsked] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) {
      setError("Escribe tu correo.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await panelApi.requestPasswordReset(email.trim());
      setAsked(email.trim());
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : "Algo salió mal. Inténtalo de nuevo en un momento.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid min-h-dvh max-w-[28rem] grid-cols-1 content-center gap-6 px-4 py-10">
      <header className="rounded-box border-[3px] border-line bg-accent p-6 pb-8 text-on-accent shadow-hard">
        <p className="font-display text-lg font-extrabold uppercase tracking-tight">{BRAND}</p>
        <h1 className="mt-3 break-words font-display text-4xl font-extrabold sm:text-5xl uppercase leading-[0.9] tracking-[-0.03em]">
          Recupera tu contraseña
        </h1>
      </header>

      {asked ? (
        <section role="status" className="grid gap-4 rounded-box border-[3px] border-line bg-surface p-5 text-text shadow-hard">
          <EnvelopeSimple aria-hidden="true" size={36} />
          <h2 className="font-display text-2xl font-extrabold leading-tight">Revisa tu correo</h2>
          <p>
            Si <strong className="break-all">{asked}</strong> tiene una cuenta, te enviamos un enlace para elegir una contraseña
            nueva. Vale una hora.
          </p>
          <p className="text-sm text-muted">¿No llega? Mira en la carpeta de spam, o espera unos minutos y pídelo otra vez.</p>
          <Link to="/panel/entrar" className="font-display font-bold underline decoration-[3px] underline-offset-4">
            Volver a entrar
          </Link>
        </section>
      ) : (
        <form
          onSubmit={(event) => void submit(event)}
          noValidate
          className="grid gap-5 rounded-box border-[3px] border-line bg-surface p-5 text-text shadow-hard"
        >
          <p className="text-muted">Escribe el correo de tu cuenta y te enviamos un enlace para elegir una contraseña nueva.</p>
          <Field
            label="Correo"
            type="email"
            inputMode="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-box border-[3px] border-danger p-3 font-semibold text-danger">
              <WarningCircle aria-hidden="true" className="mt-0.5 shrink-0" />
              {error}
            </p>
          )}

          <Button type="submit" disabled={busy}>
            {busy ? "Enviando" : "Enviar enlace"}
          </Button>
          <Link to="/panel/entrar" className="text-center font-display font-bold underline decoration-[3px] underline-offset-4">
            Volver a entrar
          </Link>
        </form>
      )}
    </div>
  );
}
