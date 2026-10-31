import { Check, Copy, Key } from "@phosphor-icons/react";
import { useState } from "react";

import { Button } from "../Button";

interface Props {
  email: string;
  password: string;
  /** Who it is for, to open the message with their name. */
  name?: string;
}

/** What to send to a person so they can get in, built from the account and the temporary password. */
export function accessMessage({ email, password, name }: Props, origin: string): string {
  return [
    `Hola${name ? ` ${name}` : ""}, ya tienes acceso a Separa.`,
    `Entra aquí: ${origin}/panel/entrar`,
    `Correo: ${email}`,
    `Contraseña temporal: ${password}`,
    "Al entrar te pedirá elegir tu propia contraseña.",
  ].join("\n");
}

/**
 * The temporary password of an account the team just opened or reset. It is shown once: the server keeps
 * only what it needs to check it, so once this screen is left there is no way to read it again.
 */
export function CredentialsCard({ email, password, name }: Props) {
  const [copied, setCopied] = useState<"message" | "password" | null>(null);
  const message = accessMessage({ email, password, name }, window.location.origin);

  async function copy(what: "message" | "password") {
    try {
      await navigator.clipboard.writeText(what === "message" ? message : password);
      setCopied(what);
    } catch {
      // Clipboard access can be refused; the text stays visible to copy by hand.
    }
  }

  return (
    <section aria-labelledby="credenciales" className="grid gap-4 rounded-box border-[3px] border-line bg-surface p-5 text-text shadow-hard">
      <h2 id="credenciales" className="flex items-center gap-2 font-display text-xl font-extrabold">
        <Key aria-hidden="true" />
        Contraseña temporal
      </h2>

      <dl className="grid gap-3">
        <div>
          <dt className="text-sm text-muted">Correo</dt>
          <dd className="break-all font-semibold">{email}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Contraseña temporal</dt>
          <dd className="break-all font-mono text-3xl font-bold tracking-wider">{password}</dd>
        </div>
      </dl>

      <p role="status" className="rounded-box border-[3px] border-dashed border-line p-3 font-semibold">
        Solo se muestra ahora. Cópiala y envíasela por un medio privado, como WhatsApp. Al entrar, la persona tendrá que elegir su
        propia contraseña.
      </p>

      <textarea
        readOnly
        rows={6}
        value={message}
        aria-label="Mensaje para enviar"
        onFocus={(event) => event.currentTarget.select()}
        className="w-full resize-none rounded-box border-[3px] border-line bg-paper px-4 py-3 text-sm text-text"
      />

      <div className="grid gap-3">
        <Button onClick={() => void copy("message")}>
          {copied === "message" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied === "message" ? "Mensaje copiado" : "Copiar mensaje"}
        </Button>
        <Button variant="plain" onClick={() => void copy("password")}>
          {copied === "password" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied === "password" ? "Contraseña copiada" : "Copiar solo la contraseña"}
        </Button>
      </div>
    </section>
  );
}
