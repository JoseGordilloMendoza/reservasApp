import { WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import { GoogleSignInButton, googleClientId } from "../../components/GoogleSignInButton";
import { useAuth } from "../../lib/auth";
import { BRAND } from "../../lib/brand";
import { ApiError } from "../../lib/http";

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? "/panel";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (auth.status === "authenticated") return <Navigate to={from} replace />;

  async function enter(attempt: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await attempt();
      navigate(from, { replace: true });
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : "Algo salió mal. Inténtalo de nuevo en un momento.");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("Escribe tu correo y tu contraseña.");
      return;
    }
    void enter(() => auth.login(email.trim(), password));
  }

  return (
    <div className="mx-auto grid min-h-dvh max-w-[28rem] content-center gap-6 px-4 py-10">
      <header className="rounded-box border-[3px] border-line bg-accent p-6 pb-8 text-on-accent shadow-hard">
        <p className="font-display text-lg font-extrabold uppercase tracking-tight">{BRAND}</p>
        <h1 className="mt-3 font-display text-5xl font-extrabold uppercase leading-[0.9] tracking-[-0.03em]">
          Entra a tu panel
        </h1>
      </header>

      <form
        onSubmit={submit}
        noValidate
        className="grid gap-5 rounded-box border-[3px] border-line bg-surface p-5 text-text shadow-hard"
      >
        <Field
          label="Correo"
          type="email"
          inputMode="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Field
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-box border-[3px] border-danger p-3 font-semibold text-danger">
            <WarningCircle aria-hidden="true" className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        <Button type="submit" disabled={busy}>
          {busy ? "Entrando" : "Entrar"}
        </Button>

        {googleClientId() && (
          <>
            <p className="text-center text-sm text-muted">o</p>
            <GoogleSignInButton
              onCredential={(credential) => void enter(() => auth.loginWithGoogle(credential))}
              onError={setError}
            />
          </>
        )}
      </form>
    </div>
  );
}
