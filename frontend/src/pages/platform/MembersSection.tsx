import { Check, EnvelopeSimple, Plus, WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";
import type { FormEvent } from "react";

import { Button } from "../../components/Button";
import { ConfirmAction } from "../../components/ConfirmAction";
import { Field } from "../../components/Field";
import { SelectField } from "../../components/SelectField";
import { Skeleton } from "../../components/Skeleton";
import { formatShortDate } from "../../lib/dates";
import { ApiError } from "../../lib/http";
import { useAddMember, useChangeRole, useMembers, useRemoveMember, useSendAccessLink } from "../../lib/platformQueries";
import type { Member } from "../../lib/platformTypes";

const ROLE_LABEL: Record<Member["role"], string> = { owner: "Dueño", staff: "Personal" };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Problem({ message }: { message: string }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-box border-[3px] border-danger p-3 font-semibold text-danger">
      <WarningCircle aria-hidden="true" className="mt-0.5 shrink-0" />
      {message}
    </p>
  );
}

/** How the person gets in, in words: never signed in, Google, or a password. */
function access(member: Member): string {
  if (member.last_login === null) return member.has_password || member.uses_google ? "Todavía no ha entrado" : "Sin contraseña: aún no la elige";
  return `Último ingreso: ${formatShortDate(member.last_login, "America/Lima")}`;
}

function MemberRow({ slug, member }: { slug: string; member: Member }) {
  const role = useChangeRole(slug);
  const remove = useRemoveMember(slug);
  const link = useSendAccessLink(slug);
  const other: Member["role"] = member.role === "owner" ? "staff" : "owner";
  const error = role.error ?? remove.error ?? link.error;

  return (
    <li className="grid gap-3 rounded-box border-[3px] border-line bg-surface p-4 text-text shadow-hard-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-xl font-extrabold leading-tight">{member.name || member.email}</p>
          {member.name && <p className="truncate text-sm text-muted">{member.email}</p>}
        </div>
        <span className="shrink-0 -rotate-3 whitespace-nowrap rounded-[8px] border-[3px] border-current px-2 py-1 font-display text-sm font-extrabold uppercase leading-none tracking-wide">
          {ROLE_LABEL[member.role]}
        </span>
      </div>

      <p className="text-sm text-muted">
        {access(member)}
        {member.uses_google ? " · Usa Google" : ""}
      </p>

      <div className="grid gap-3">
        <Button variant="plain" disabled={link.isPending} onClick={() => link.mutate(member.id)}>
          <EnvelopeSimple aria-hidden="true" />
          Reenviar acceso
        </Button>
        <Button variant="plain" disabled={role.isPending} onClick={() => role.mutate({ id: member.id, role: other })}>
          Pasar a {ROLE_LABEL[other].toLowerCase()}
        </Button>
        <ConfirmAction
          label="Quitar del negocio"
          question="¿Quitar a esta persona del negocio? Su cuenta y sus otros negocios no se tocan."
          confirmLabel="Sí, quitar"
          busy={remove.isPending}
          onConfirm={() => remove.mutate(member.id)}
        />
      </div>

      {link.isSuccess && (
        <p role="status" className="flex items-start gap-2 font-semibold">
          <Check aria-hidden="true" className="mt-0.5 shrink-0" />
          {link.data.detail}
        </p>
      )}
      {error && <Problem message={error.message} />}
    </li>
  );
}

function AddMember({ slug, onDone }: { slug: string; onDone: () => void }) {
  const add = useAddMember(slug);
  const [values, setValues] = useState({ email: "", first_name: "", last_name: "", role: "staff" as Member["role"] });
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | undefined>();

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const email = values.email.trim();
    if (!EMAIL.test(email)) {
      setEmailError(email ? "Revisa el correo: parece incompleto." : "Escribe el correo.");
      return;
    }
    setEmailError(undefined);

    add.mutate(
      {
        email,
        role: values.role,
        ...(values.first_name.trim() ? { first_name: values.first_name.trim() } : {}),
        ...(values.last_name.trim() ? { last_name: values.last_name.trim() } : {}),
      },
      {
        onSuccess: onDone,
        onError: (failure) => {
          if (failure instanceof ApiError && failure.code === "invalid") setEmailError(failure.fields.email ?? failure.message);
          else setError(failure.message);
        },
      },
    );
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Agregar a alguien" className="grid gap-4 rounded-box border-[3px] border-line bg-surface p-4 text-text shadow-hard">
      <h3 className="font-display text-xl font-extrabold">Agregar a alguien</h3>
      <Field
        label="Correo"
        type="email"
        inputMode="email"
        autoComplete="off"
        hint="Si no tiene cuenta, se crea y recibe un correo para elegir su contraseña."
        value={values.email}
        error={emailError}
        onChange={(event) => setValues({ ...values, email: event.target.value })}
      />
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nombre (opcional)" autoComplete="off" value={values.first_name} onChange={(event) => setValues({ ...values, first_name: event.target.value })} />
        <Field label="Apellido (opcional)" autoComplete="off" value={values.last_name} onChange={(event) => setValues({ ...values, last_name: event.target.value })} />
      </div>
      <SelectField label="Rol" value={values.role} onChange={(event) => setValues({ ...values, role: event.target.value as Member["role"] })}>
        <option value="staff">Personal</option>
        <option value="owner">Dueño</option>
      </SelectField>

      {error && <Problem message={error} />}

      <div className="grid grid-cols-2 gap-3">
        <Button type="submit" disabled={add.isPending}>
          {add.isPending ? "Agregando" : "Agregar"}
        </Button>
        <Button variant="plain" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export function MembersSection({ slug }: { slug: string }) {
  const members = useMembers(slug);
  const [adding, setAdding] = useState(false);

  return (
    <div className="grid grid-cols-1 gap-6">
      <h2 className="font-display text-2xl font-extrabold">Personas del negocio</h2>

      {adding ? (
        <AddMember slug={slug} onDone={() => setAdding(false)} />
      ) : (
        <Button onClick={() => setAdding(true)}>
          <Plus aria-hidden="true" />
          Agregar a alguien
        </Button>
      )}

      {members.isPending && <Skeleton className="h-[160px]" />}
      {members.isError && <Problem message={`No pudimos cargar a las personas. ${members.error.message}`} />}
      {members.isSuccess && members.data.length === 0 && (
        <p className="rounded-box border-[3px] border-dashed border-line p-4 font-semibold">Este negocio no tiene a nadie que lo administre.</p>
      )}
      {members.isSuccess && members.data.length > 0 && (
        <ul className="grid grid-cols-1 gap-4">
          {members.data.map((member) => (
            <MemberRow key={member.id} slug={slug} member={member} />
          ))}
        </ul>
      )}
    </div>
  );
}
