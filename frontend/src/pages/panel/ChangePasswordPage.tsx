import { ArrowLeft, WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import { useAuth } from "../../lib/auth";
import { ApiError } from "../../lib/http";
import { validateNewPassword } from "../../lib/password";

interface Errors {
  current?: string;
  password?: string;
  confirm?: string;
}

/**
 * Where someone chooses their own password. It is the only screen an account with a temporary password can
 * use; anyone else reaches it from the settings, to change theirs when they like.
 */
export function ChangePasswordPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (auth.status === "anonymous") return <Navigate to="/panel/entrar" replace state={{ from: "/panel/cambiar-contrasena" }} />;
  if (auth.status === "loading" || !auth.user) return null;

  const forced = auth.user.must_change_password;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);

    const found: Errors = { ...validateNewPassword(password, confirm) };
    if (!current) found.current = "Escribe tu contraseña actual.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      await auth.changePassword(current, password);
      navigate(auth.user?.is_platform_admin && !auth.membership ? "/plataforma" : "/panel", { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.fields.current_password) setErrors({ current: error.fields.current_password });
      else if (error instanceof ApiError && error.fields.new_password) setErrors({ password: error.fields.new_password });
      else setFailure(error instanceof Error ? error.message : "No pudimos cambiar la contraseña.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid min-h-dvh max-w-[28rem] content-center gap-6 px-4 py-10">
      {!forced && (
        <Link to="/panel/ajustes" className="inline-flex w-fit items-center gap-2 font-display font-bold underline decoration-[3px] underline-offset-4">
          <ArrowLeft aria-hidden="true" />
          Ajustes
        </Link>
      )}

      <div className="grid gap-2">
        <h1 className="font-display text-4xl font-extrabold uppercase leading-[0.9] tracking-[-0.03em]">
          {forced ? "Elige tu contraseña" : "Cambiar contraseña"}
        </h1>
        <p className="text-muted">
          {forced
            ? "Entraste con una contraseña temporal. Elige una propia para seguir: solo tú la sabrás."
            : "Escribe la actual y elige una nueva. Cerraremos tus otras sesiones abiertas."}
        </p>
      </div>

      <form onSubmit={submit} noValidate className="grid gap-5">
        <Field
          label={forced ? "Contraseña temporal" : "Contraseña actual"}
          type="password"
          autoComplete="current-password"
          value={current}
          error={errors.current}
          onChange={(event) => setCurrent(event.target.value)}
        />
        <Field
          label="Contraseña nueva"
          type="password"
          autoComplete="new-password"
          hint="Al menos 8 caracteres, y que no sea solo números."
          value={password}
          error={errors.password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Field
          label="Repite la contraseña nueva"
          type="password"
          autoComplete="new-password"
          value={confirm}
          error={errors.confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />

        {failure && (
          <p role="alert" className="flex items-start gap-2 rounded-box border-[3px] border-danger p-4 font-semibold text-danger">
            <WarningCircle aria-hidden="true" className="mt-0.5 shrink-0" />
            {failure}
          </p>
        )}

        <Button type="submit" disabled={busy}>
          {busy ? "Guardando" : "Guardar contraseña"}
        </Button>
        {forced && (
          <Button variant="plain" onClick={() => void auth.logout()}>
            Salir
          </Button>
        )}
      </form>
    </div>
  );
}
