import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { Button, buttonClass } from "../../components/Button";
import { Field } from "../../components/Field";
import { BRAND } from "../../lib/brand";
import { ApiError } from "../../lib/http";
import { panelApi } from "../../lib/panelApi";
import { validateNewPassword } from "../../lib/password";
import type { PasswordErrors } from "../../lib/password";

const LINK_CODE = "invalid_reset_link";

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto grid min-h-dvh max-w-[28rem] grid-cols-1 content-center gap-6 px-4 py-10">
      <header className="rounded-box border-[3px] border-line bg-accent p-6 pb-8 text-on-accent shadow-hard">
        <p className="font-display text-lg font-extrabold uppercase tracking-tight">{BRAND}</p>
        <h1 className="mt-3 break-words font-display text-4xl font-extrabold sm:text-5xl uppercase leading-[0.9] tracking-[-0.03em]">{title}</h1>
      </header>
      {children}
    </div>
  );
}

/** A link that cannot be used: it says so and offers the way out, a new one. */
function BrokenLink({ message }: { message: string }) {
  return (
    <section role="alert" className="grid gap-4 rounded-box border-[3px] border-danger bg-surface p-5 text-text">
      <p className="flex items-start gap-2 font-semibold text-danger">
        <WarningCircle aria-hidden="true" className="mt-0.5 shrink-0" />
        {message}
      </p>
      <Link to="/panel/recuperar" className={buttonClass("primary")}>
        Pedir otro enlace
      </Link>
    </section>
  );
}

/** Step two of recovering a password: choose the new one, from the link that came by email. */
export function NewPasswordPage() {
  const [params] = useSearchParams();
  const uid = params.get("uid") ?? "";
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [brokenLink, setBrokenLink] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <Shell title="Contraseña nueva">
        <section role="status" className="grid gap-4 rounded-box border-[3px] border-line bg-surface p-5 text-text shadow-hard">
          <CheckCircle aria-hidden="true" size={36} />
          <p className="font-display text-2xl font-extrabold leading-tight">Listo, cambiaste tu contraseña.</p>
          <p className="text-muted">Por seguridad, cerramos tus otras sesiones. Entra con la nueva.</p>
          <Link to="/panel/entrar" className={buttonClass("primary")}>
            Entrar
          </Link>
        </section>
      </Shell>
    );
  }

  // Without both parts the link was cut off or typed by hand; there is nothing to send.
  if (!uid || !token || brokenLink) {
    return (
      <Shell title="Contraseña nueva">
        <BrokenLink message={brokenLink ?? "El enlace está incompleto. Pide uno nuevo."} />
      </Shell>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const found = validateNewPassword(password, confirm);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      await panelApi.resetPassword(uid, token, password);
      setDone(true);
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === LINK_CODE) {
        setBrokenLink(failure.message);
      } else if (failure instanceof ApiError && failure.fields.password) {
        // The server judges what the form cannot: too common, too like the email.
        setErrors({ password: failure.fields.password });
      } else {
        setFormError(failure instanceof ApiError ? failure.message : "Algo salió mal. Inténtalo de nuevo en un momento.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Contraseña nueva">
      <form
        onSubmit={(event) => void submit(event)}
        noValidate
        className="grid gap-5 rounded-box border-[3px] border-line bg-surface p-5 text-text shadow-hard"
      >
        <Field
          label="Contraseña nueva"
          type="password"
          autoComplete="new-password"
          hint="Al menos 8 caracteres, y no solo números."
          value={password}
          error={errors.password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Field
          label="Repite la contraseña"
          type="password"
          autoComplete="new-password"
          value={confirm}
          error={errors.confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />

        {formError && (
          <p role="alert" className="flex items-start gap-2 rounded-box border-[3px] border-danger p-3 font-semibold text-danger">
            <WarningCircle aria-hidden="true" className="mt-0.5 shrink-0" />
            {formError}
          </p>
        )}

        <Button type="submit" disabled={busy}>
          {busy ? "Guardando" : "Guardar contraseña"}
        </Button>
      </form>
    </Shell>
  );
}
