import { ArrowLeft, PencilSimple, Plus, WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import { Button } from "../../components/Button";
import { ConfirmAction } from "../../components/ConfirmAction";
import { Field } from "../../components/Field";
import { SelectField } from "../../components/SelectField";
import { Skeleton } from "../../components/Skeleton";
import { formatDuration, formatPrice } from "../../lib/format";
import { ApiError } from "../../lib/http";
import type { PanelService } from "../../lib/panelTypes";
import {
  useCreateService,
  useDeleteService,
  usePanelBusiness,
  useResources,
  useServices,
  useUpdateService,
} from "../../lib/panelQueries";
import { priceText, serviceInput, validateService } from "../../lib/services";
import type { ServiceErrors, ServiceValues } from "../../lib/services";

const FIELD_OF_SERVER: Record<string, keyof ServiceValues> = {
  name: "name",
  duration_minutes: "duration",
  reference_price: "price",
  resource_id: "resource",
};

function Problem({ message }: { message: string }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-box border-[3px] border-danger p-3 font-semibold text-danger">
      <WarningCircle aria-hidden="true" className="mt-0.5 shrink-0" />
      {message}
    </p>
  );
}

interface FormProps {
  initial: ServiceValues;
  /** Present when editing: the space is shown but cannot be changed. */
  space?: string;
  submitLabel: string;
  busyLabel: string;
  busy: boolean;
  /** Called with values that passed the checks; reports the server's complaint through `fail`. */
  onSubmit: (values: ServiceValues, fail: (error: Error) => void) => void;
  onCancel: () => void;
}

function ServiceForm({ initial, space, submitLabel, busyLabel, busy, onSubmit, onCancel }: FormProps) {
  const resources = useResources();
  const creating = space === undefined;
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<ServiceErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const set = (changes: Partial<ServiceValues>) => setValues((current) => ({ ...current, ...changes }));
  const active = (resources.data?.results ?? []).filter((resource) => resource.is_active);
  // With a single space there is nothing to choose, however late the spaces arrive.
  const resource = values.resource || (creating && active.length === 1 ? String(active[0]!.id) : "");

  function fail(error: Error) {
    if (error instanceof ApiError && error.code === "invalid") {
      const fromServer: ServiceErrors = {};
      for (const [field, message] of Object.entries(error.fields)) {
        const key = FIELD_OF_SERVER[field];
        if (key) fromServer[key] = message;
      }
      setErrors(fromServer);
      setFormError(Object.keys(fromServer).length ? null : error.message);
    } else {
      setFormError(error.message);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const complete = { ...values, resource };
    const found = validateService(complete, { creating });
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(complete, fail);
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      {creating ? (
        <SelectField label="Espacio" value={resource} error={errors.resource} onChange={(event) => set({ resource: event.target.value })}>
          <option value="">Elige un espacio</option>
          {active.map((resource) => (
            <option key={resource.id} value={resource.id}>
              {resource.name}
            </option>
          ))}
        </SelectField>
      ) : (
        <p className="text-muted">
          Espacio: <span className="font-semibold text-text">{space}</span>
        </p>
      )}
      <Field label="Nombre" autoComplete="off" placeholder="Alquiler 1 hora" value={values.name} error={errors.name} onChange={(event) => set({ name: event.target.value })} />
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Duración (minutos)"
          inputMode="numeric"
          autoComplete="off"
          value={values.duration}
          error={errors.duration}
          onChange={(event) => set({ duration: event.target.value })}
        />
        <Field
          label="Precio (S/)"
          inputMode="decimal"
          autoComplete="off"
          placeholder="Opcional"
          value={values.price}
          error={errors.price}
          onChange={(event) => set({ price: event.target.value })}
        />
      </div>
      {formError && <Problem message={formError} />}
      <div className="grid grid-cols-2 gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? busyLabel : submitLabel}
        </Button>
        <Button variant="plain" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function ServiceRow({ service }: { service: PanelService }) {
  const update = useUpdateService();
  const remove = useDeleteService();
  const [editing, setEditing] = useState(false);
  const price = formatPrice(service.reference_price);

  return (
    <li className="grid gap-4 rounded-box border-[3px] border-line bg-surface p-4 text-text shadow-hard-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words font-display text-2xl font-extrabold leading-tight">{service.name}</p>
          <p className="mt-1 text-sm text-muted">
            {service.resource.name} · {formatDuration(service.duration_minutes)}
            {price ? ` · ${price}` : ""}
          </p>
        </div>
        {!service.is_active && (
          <span className="shrink-0 -rotate-3 whitespace-nowrap rounded-[8px] border-[3px] border-dashed border-current px-2 py-1 font-display text-sm font-extrabold uppercase leading-none tracking-wide text-muted">
            Inactivo
          </span>
        )}
      </div>

      {editing ? (
        <div className="rounded-box border-[3px] border-line p-3">
          <ServiceForm
            initial={{
              resource: String(service.resource.id),
              name: service.name,
              duration: String(service.duration_minutes),
              price: priceText(service.reference_price),
            }}
            space={service.resource.name}
            submitLabel="Guardar"
            busyLabel="Guardando"
            busy={update.isPending}
            onCancel={() => setEditing(false)}
            onSubmit={(values, fail) =>
              update.mutate(
                { id: service.id, ...serviceInput(values, { creating: false }) },
                { onSuccess: () => setEditing(false), onError: fail },
              )
            }
          />
        </div>
      ) : (
        <Button variant="plain" onClick={() => setEditing(true)}>
          <PencilSimple aria-hidden="true" />
          Editar
        </Button>
      )}

      {service.is_active ? (
        <ConfirmAction
          label="Desactivar"
          question="¿Desactivar este servicio? Tus clientes dejan de verlo, pero conservas su historial."
          confirmLabel="Sí, desactivar"
          busy={update.isPending}
          onConfirm={() => update.mutate({ id: service.id, is_active: false })}
        />
      ) : (
        <Button variant="plain" disabled={update.isPending} onClick={() => update.mutate({ id: service.id, is_active: true })}>
          Activar
        </Button>
      )}
      {!editing && update.error && <Problem message={update.error.message} />}

      <ConfirmAction
        label="Eliminar"
        question="¿Eliminar este servicio para siempre?"
        confirmLabel="Sí, eliminar"
        busy={remove.isPending}
        onConfirm={() => remove.mutate(service.id)}
      />
      {remove.error && (
        <Problem
          message={
            remove.error instanceof ApiError && remove.error.status === 409
              ? "Este servicio tiene reservas, así que no se puede eliminar. Desactívalo para que deje de aparecer."
              : remove.error.message
          }
        />
      )}
    </li>
  );
}

function NewService({ suggestedDuration }: { suggestedDuration: number | undefined }) {
  const create = useCreateService();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" />
        Nuevo servicio
      </Button>
    );
  }

  return (
    <section aria-labelledby="nuevo" className="grid gap-4 rounded-box border-[3px] border-line bg-surface p-4 text-text shadow-hard">
      <h2 id="nuevo" className="font-display text-2xl font-extrabold">
        Nuevo servicio
      </h2>
      <ServiceForm
        initial={{ resource: "", name: "", duration: String(suggestedDuration ?? 60), price: "" }}
        submitLabel="Agregar"
        busyLabel="Agregando"
        busy={create.isPending}
        onCancel={() => setOpen(false)}
        onSubmit={(values, fail) => create.mutate(serviceInput(values, { creating: true }), { onSuccess: () => setOpen(false), onError: fail })}
      />
    </section>
  );
}

export function ServicesPage() {
  const business = usePanelBusiness();
  const services = useServices();

  return (
    <div className="grid max-w-[34rem] grid-cols-1 gap-6">
      <Link to="/panel/ajustes" className="inline-flex w-fit items-center gap-2 font-display font-bold underline decoration-[3px] underline-offset-4">
        <ArrowLeft aria-hidden="true" />
        Ajustes
      </Link>
      <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.9] tracking-[-0.03em]">Servicios</h1>
      <p className="text-muted">Lo que reserva tu cliente: cuánto dura y cuánto cuesta. El precio es una referencia; el pago lo acuerdas tú con el cliente.</p>

      <NewService suggestedDuration={business.data?.suggested_service_duration_minutes} />

      {services.isPending && (
        <div className="grid gap-3" aria-busy="true" aria-label="Cargando">
          <Skeleton className="h-[200px]" />
          <Skeleton className="h-[200px]" />
        </div>
      )}

      {services.isError && (
        <div role="alert" className="grid gap-3 rounded-box border-[3px] border-danger p-4">
          <p className="font-semibold text-danger">No pudimos cargar los servicios. {services.error.message}</p>
          <Button variant="plain" onClick={() => void services.refetch()}>
            Intentar otra vez
          </Button>
        </div>
      )}

      {services.isSuccess && services.data.results.length === 0 && (
        <p className="rounded-box border-[3px] border-dashed border-line p-5 font-display text-xl font-bold leading-tight">
          Todavía no tienes servicios. Agrega el primero para que tus clientes puedan reservar.
        </p>
      )}

      {services.isSuccess && services.data.results.length > 0 && (
        <ul className="grid gap-4">
          {services.data.results.map((service) => (
            <ServiceRow key={service.id} service={service} />
          ))}
        </ul>
      )}
    </div>
  );
}
