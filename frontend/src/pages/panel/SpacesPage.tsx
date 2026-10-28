import { ArrowLeft, Clock, PencilSimple, Plus, WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import { Button, buttonClass } from "../../components/Button";
import { ConfirmAction } from "../../components/ConfirmAction";
import { Field } from "../../components/Field";
import { Skeleton } from "../../components/Skeleton";
import { ApiError } from "../../lib/http";
import type { PanelResource } from "../../lib/panelTypes";
import { useCreateResource, useDeleteResource, useResources, useUpdateResource } from "../../lib/panelQueries";

function Problem({ message }: { message: string }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-box border-[3px] border-danger p-3 font-semibold text-danger">
      <WarningCircle aria-hidden="true" className="mt-0.5 shrink-0" />
      {message}
    </p>
  );
}

/** The reason a field was refused, in the server's words when it has them. */
const reasonOf = (error: Error) => (error instanceof ApiError ? (error.fields.name ?? error.message) : error.message);

function SpaceRow({ space }: { space: PanelResource }) {
  const update = useUpdateResource();
  const remove = useDeleteResource();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(space.name);

  function rename(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    update.mutate({ id: space.id, name: name.trim() }, { onSuccess: () => setEditing(false) });
  }

  return (
    <li className="grid gap-4 rounded-box border-[3px] border-line bg-surface p-4 text-text shadow-hard-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 break-words font-display text-2xl font-extrabold leading-tight">{space.name}</p>
        {!space.is_active && (
          <span className="shrink-0 -rotate-3 whitespace-nowrap rounded-[8px] border-[3px] border-dashed border-current px-2 py-1 font-display text-sm font-extrabold uppercase leading-none tracking-wide text-muted">
            Inactivo
          </span>
        )}
      </div>

      <div className="grid gap-3">
        <Link to={`/panel/ajustes/espacios/${space.id}/horario`} className={buttonClass("primary")}>
          <Clock aria-hidden="true" />
          Horario
        </Link>
        {!editing && (
          <Button
            variant="plain"
            onClick={() => {
              setName(space.name);
              setEditing(true);
            }}
          >
            <PencilSimple aria-hidden="true" />
            Cambiar nombre
          </Button>
        )}
      </div>

      {editing && (
        <form onSubmit={rename} noValidate className="grid gap-3 rounded-box border-[3px] border-line p-3">
          <Field label="Nombre" autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} />
          {update.error && <Problem message={reasonOf(update.error)} />}
          <div className="grid grid-cols-2 gap-3">
            <Button type="submit" disabled={update.isPending || !name.trim()}>
              {update.isPending ? "Guardando" : "Guardar"}
            </Button>
            <Button variant="plain" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {space.is_active ? (
        <ConfirmAction
          label="Desactivar"
          question="¿Desactivar este espacio? Deja de recibir reservas, pero conservas su historial."
          confirmLabel="Sí, desactivar"
          busy={update.isPending}
          onConfirm={() => update.mutate({ id: space.id, is_active: false })}
        />
      ) : (
        <Button variant="plain" disabled={update.isPending} onClick={() => update.mutate({ id: space.id, is_active: true })}>
          Activar
        </Button>
      )}

      <ConfirmAction
        label="Eliminar"
        question="¿Eliminar este espacio para siempre?"
        confirmLabel="Sí, eliminar"
        busy={remove.isPending}
        onConfirm={() => remove.mutate(space.id)}
      />
      {remove.error && (
        <Problem
          message={
            remove.error instanceof ApiError && remove.error.status === 409
              ? "Este espacio tiene reservas, así que no se puede eliminar. Desactívalo para que deje de recibir reservas."
              : remove.error.message
          }
        />
      )}
    </li>
  );
}

function NewSpace() {
  const create = useCreateResource();
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    create.mutate(name.trim(), {
      onSuccess: () => {
        setName("");
        setOpen(false);
      },
    });
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" />
        Nuevo espacio
      </Button>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 rounded-box border-[3px] border-line bg-surface p-4 text-text shadow-hard">
      <h2 className="font-display text-2xl font-extrabold">Nuevo espacio</h2>
      <Field label="Nombre" autoComplete="off" placeholder="Cancha 2" value={name} onChange={(event) => setName(event.target.value)} />
      {create.error && <Problem message={reasonOf(create.error)} />}
      <div className="grid grid-cols-2 gap-3">
        <Button type="submit" disabled={create.isPending || !name.trim()}>
          {create.isPending ? "Agregando" : "Agregar"}
        </Button>
        <Button variant="plain" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export function SpacesPage() {
  const resources = useResources();

  return (
    <div className="grid max-w-[34rem] gap-6">
      <Link to="/panel/ajustes" className="inline-flex w-fit items-center gap-2 font-display font-bold underline decoration-[3px] underline-offset-4">
        <ArrowLeft aria-hidden="true" />
        Ajustes
      </Link>
      <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.9] tracking-[-0.03em]">Espacios</h1>
      <p className="text-muted">Lo que tus clientes reservan: una cancha, un consultorio o a una persona. Cada uno tiene su propio horario.</p>

      <NewSpace />

      {resources.isPending && (
        <div className="grid gap-3" aria-busy="true" aria-label="Cargando">
          <Skeleton className="h-[200px]" />
          <Skeleton className="h-[200px]" />
        </div>
      )}

      {resources.isError && (
        <div role="alert" className="grid gap-3 rounded-box border-[3px] border-danger p-4">
          <p className="font-semibold text-danger">No pudimos cargar los espacios. {resources.error.message}</p>
          <Button variant="plain" onClick={() => void resources.refetch()}>
            Intentar otra vez
          </Button>
        </div>
      )}

      {resources.isSuccess && resources.data.results.length === 0 && (
        <p className="rounded-box border-[3px] border-dashed border-line p-5 font-display text-xl font-bold leading-tight">
          Todavía no tienes espacios. Agrega el primero para empezar a recibir reservas.
        </p>
      )}

      {resources.isSuccess && resources.data.results.length > 0 && (
        <ul className="grid gap-4">
          {resources.data.results.map((space) => (
            <SpaceRow key={space.id} space={space} />
          ))}
        </ul>
      )}
    </div>
  );
}
