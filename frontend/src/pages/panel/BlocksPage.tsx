import { CalendarX, Plus, WarningCircle, X } from "@phosphor-icons/react";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import { Button } from "../../components/Button";
import { ConfirmAction } from "../../components/ConfirmAction";
import { CheckField, Field } from "../../components/Field";
import { SelectField } from "../../components/SelectField";
import { Skeleton } from "../../components/Skeleton";
import { buildBlock, describePeriod } from "../../lib/blocks";
import type { BlockForm } from "../../lib/blocks";
import { addDays, formatTime, nextWholeHour, relativeDay } from "../../lib/dates";
import type { CreatedBlock, PanelBlock } from "../../lib/panelTypes";
import { useBlocks, useCreateBlock, useDeleteBlock, usePanelBusiness, useResources } from "../../lib/panelQueries";

function initialForm(timeZone: string): BlockForm {
  const start = nextWholeHour(timeZone);
  const hour = Number(start.time.slice(0, 2));
  // An hour later; past 23:00 it ends at midnight of the next day.
  const end =
    hour >= 23
      ? { date: addDays(start.date, 1), time: "00:00" }
      : { date: start.date, time: `${String(hour + 1).padStart(2, "0")}:00` };
  return { resource: "", allDay: false, fromDate: start.date, fromTime: start.time, toDate: end.date, toTime: end.time, reason: "" };
}

function NewBlockForm({
  timeZone,
  onDone,
  onCreated,
}: {
  timeZone: string;
  onDone: () => void;
  onCreated: (block: CreatedBlock) => void;
}) {
  const resources = useResources();
  const create = useCreateBlock();
  const [form, setForm] = useState(() => initialForm(timeZone));
  const [error, setError] = useState<string | null>(null);

  const set = (changes: Partial<BlockForm>) => setForm((current) => ({ ...current, ...changes }));

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = buildBlock(form, timeZone);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(null);
    create.mutate(result.block, {
      onSuccess: (created) => {
        onCreated(created);
        onDone();
      },
      onError: (failure) => setError(failure.message),
    });
  }

  const active = (resources.data?.results ?? []).filter((resource) => resource.is_active);

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 rounded-box border-[3px] border-line bg-surface p-4 text-text shadow-hard">
      <h2 className="font-display text-2xl font-extrabold">Nuevo bloqueo</h2>

      <SelectField label="¿Qué cierras?" value={form.resource} onChange={(event) => set({ resource: event.target.value })}>
        <option value="">Todo el negocio</option>
        {active.map((resource) => (
          <option key={resource.id} value={resource.id}>
            {resource.name}
          </option>
        ))}
      </SelectField>

      <CheckField label="Todo el día" checked={form.allDay} onChange={(event) => set({ allDay: event.target.checked })} />

      <div className="grid grid-cols-2 gap-4">
        <Field label="Desde el día" type="date" value={form.fromDate} onChange={(event) => set({ fromDate: event.target.value })} />
        {!form.allDay && (
          <Field label="Hora de inicio" type="time" step={300} value={form.fromTime} onChange={(event) => set({ fromTime: event.target.value })} />
        )}
        <Field label="Hasta el día" type="date" value={form.toDate} onChange={(event) => set({ toDate: event.target.value })} />
        {!form.allDay && (
          <Field label="Hora de fin" type="time" step={300} value={form.toTime} onChange={(event) => set({ toTime: event.target.value })} />
        )}
      </div>

      <Field
        label="Motivo (opcional)"
        maxLength={200}
        placeholder="Mantenimiento, feriado, vacaciones"
        value={form.reason}
        onChange={(event) => set({ reason: event.target.value })}
      />

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-box border-[3px] border-danger p-3 font-semibold text-danger">
          <WarningCircle aria-hidden="true" className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? "Bloqueando" : "Bloquear"}
        </Button>
        <Button variant="plain" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

/** Bookings that were already there when a period was closed. Closing never cancels them. */
function Conflicts({ block, timeZone, onClose }: { block: CreatedBlock; timeZone: string; onClose: () => void }) {
  const found = block.conflicting_bookings;
  if (found.length === 0) return null;

  return (
    <section
      role="status"
      aria-label="Reservas en conflicto"
      className="grid gap-3 rounded-box border-[3px] border-danger bg-surface p-4 text-text"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-start gap-2 font-display text-lg font-bold leading-tight text-danger">
          <WarningCircle aria-hidden="true" className="mt-0.5 shrink-0" />
          {found.length === 1 ? "Ya había 1 reserva en ese horario" : `Ya había ${found.length} reservas en ese horario`}
        </p>
        <button type="button" onClick={onClose} aria-label="Cerrar aviso" className="grid size-11 shrink-0 place-items-center">
          <X aria-hidden="true" />
        </button>
      </div>
      <p className="text-sm text-muted">Siguen en pie: bloquear no las cancela. Ábrelas para cancelarlas o avisar al cliente.</p>
      <ul className="grid gap-2">
        {found.map((booking) => (
          <li key={booking.id}>
            <Link
              to={`/panel/reservas/${booking.id}`}
              className="press flex items-center justify-between gap-3 rounded-box border-[3px] border-line p-3 shadow-hard-sm"
            >
              <span className="min-w-0 truncate font-display font-bold">{booking.customer_name}</span>
              <span className="shrink-0 font-mono text-sm">
                {relativeDay(booking.starts_at, timeZone)} {formatTime(booking.starts_at, timeZone)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BlockRow({ block, timeZone }: { block: PanelBlock; timeZone: string }) {
  const remove = useDeleteBlock();

  return (
    <li className="grid gap-3 rounded-box border-[3px] border-line bg-surface p-4 text-text shadow-hard-sm">
      <div className="min-w-0">
        <p className="font-display text-xl font-extrabold leading-tight">{block.reason || "Cerrado"}</p>
        <p className="mt-1 font-semibold first-letter:uppercase">{describePeriod(block, timeZone)}</p>
        <p className="text-sm text-muted">{block.resource ? block.resource.name : "Todo el negocio"}</p>
      </div>
      <ConfirmAction
        label="Quitar bloqueo"
        question="¿Quitar este bloqueo? Ese horario volverá a estar disponible."
        confirmLabel="Sí, quitar"
        busy={remove.isPending}
        onConfirm={() => remove.mutate(block.id)}
      />
      {remove.error && (
        <p role="alert" className="font-semibold text-danger">
          {remove.error.message}
        </p>
      )}
    </li>
  );
}

export function BlocksPage() {
  const business = usePanelBusiness();
  const blocks = useBlocks();
  const timeZone = business.data?.timezone;

  const [creating, setCreating] = useState(false);
  const [last, setLast] = useState<CreatedBlock | null>(null);

  return (
    <div className="grid max-w-[34rem] grid-cols-1 gap-6">
      <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.9] tracking-[-0.03em]">Bloqueos</h1>
      <p className="text-muted">Cierra un horario cuando no atiendes: mantenimiento, feriados o vacaciones. Nadie podrá reservar ahí.</p>

      {last && timeZone && <Conflicts block={last} timeZone={timeZone} onClose={() => setLast(null)} />}

      {creating && timeZone ? (
        <NewBlockForm timeZone={timeZone} onDone={() => setCreating(false)} onCreated={setLast} />
      ) : (
        <Button onClick={() => setCreating(true)} disabled={!timeZone}>
          <Plus aria-hidden="true" />
          Nuevo bloqueo
        </Button>
      )}

      {(blocks.isPending || !timeZone) && (
        <div className="grid gap-3" aria-busy="true" aria-label="Cargando">
          <Skeleton className="h-[120px]" />
          <Skeleton className="h-[120px]" />
        </div>
      )}

      {blocks.isError && (
        <div role="alert" className="grid gap-3 rounded-box border-[3px] border-danger p-4">
          <p className="font-semibold text-danger">No pudimos cargar los bloqueos. {blocks.error.message}</p>
          <Button variant="plain" onClick={() => void blocks.refetch()}>
            Intentar otra vez
          </Button>
        </div>
      )}

      {blocks.isSuccess && timeZone && blocks.data.results.length === 0 && (
        <p className="flex items-center gap-3 rounded-box border-[3px] border-dashed border-line p-5 font-display text-xl font-bold leading-tight">
          <CalendarX aria-hidden="true" size={28} className="shrink-0" />
          No tienes bloqueos próximos.
        </p>
      )}

      {blocks.isSuccess && timeZone && blocks.data.results.length > 0 && (
        <section aria-labelledby="proximos" className="grid gap-3">
          <h2 id="proximos" className="font-display text-2xl font-extrabold">
            Próximos
          </h2>
          <ul className="grid gap-3">
            {blocks.data.results.map((block) => (
              <BlockRow key={block.id} block={block} timeZone={timeZone} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
