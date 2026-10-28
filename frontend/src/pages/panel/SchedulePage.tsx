import { ArrowLeft, Check, Copy, Plus, Trash, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Button } from "../../components/Button";
import { Skeleton } from "../../components/Skeleton";
import { useResources, useSaveSchedule, useSchedule } from "../../lib/panelQueries";
import { WEEKDAYS, copyDayToAll, nextWindow, rulesFromWeek, weekErrors, weekFromRules } from "../../lib/schedule";
import type { Week } from "../../lib/schedule";
import { NotFoundPage } from "../NotFoundPage";

const TIME =
  "min-h-[48px] w-full rounded-box border-[3px] border-line bg-surface px-3 font-mono text-lg text-text focus:shadow-hard focus:outline-none";

function Day({
  weekday,
  windows,
  error,
  onChange,
  onCopy,
}: {
  weekday: number;
  windows: Week[number];
  error: string | undefined;
  onChange: (windows: Week[number]) => void;
  onCopy: () => void;
}) {
  const name = WEEKDAYS[weekday]!;
  const change = (index: number, field: "start" | "end", value: string) =>
    onChange(windows.map((window, at) => (at === index ? { ...window, [field]: value } : window)));

  return (
    <section
      aria-label={name}
      className={"grid gap-3 rounded-box border-[3px] bg-surface p-4 text-text " + (error ? "border-danger" : "border-line")}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-extrabold">{name}</h2>
        {windows.length === 0 && (
          <span className="rounded-[8px] border-[3px] border-dashed border-current px-2 py-1 font-display text-sm font-extrabold uppercase leading-none tracking-wide text-muted">
            Cerrado
          </span>
        )}
      </div>

      {windows.map((window, index) => (
        <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-3">
          <label className="grid min-w-0 gap-1 text-sm font-semibold">
            Abre
            <input
              type="time"
              step={300}
              aria-label={`${name}, abre`}
              value={window.start}
              onChange={(event) => change(index, "start", event.target.value)}
              className={TIME}
            />
          </label>
          <label className="grid min-w-0 gap-1 text-sm font-semibold">
            Cierra
            <input
              type="time"
              step={300}
              aria-label={`${name}, cierra`}
              value={window.end}
              onChange={(event) => change(index, "end", event.target.value)}
              className={TIME}
            />
          </label>
          <button
            type="button"
            aria-label={`Quitar horario del ${name.toLowerCase()}`}
            onClick={() => onChange(windows.filter((_, at) => at !== index))}
            className="press grid size-12 place-items-center rounded-box border-[3px] border-line bg-surface shadow-hard-sm"
          >
            <Trash aria-hidden="true" />
          </button>
        </div>
      ))}

      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm font-semibold text-danger">
          <WarningCircle aria-hidden="true" className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          variant="plain"
          className="min-h-[44px] px-3 text-base"
          onClick={() => onChange([...windows, nextWindow(windows)])}
        >
          <Plus aria-hidden="true" />
          {windows.length === 0 ? "Abrir este día" : "Otro horario"}
        </Button>
        {windows.length > 0 && (
          <Button variant="plain" className="min-h-[44px] px-3 text-base" onClick={onCopy}>
            <Copy aria-hidden="true" />
            Copiar a todos los días
          </Button>
        )}
      </div>
    </section>
  );
}

function ScheduleEditor({ resourceId, initial }: { resourceId: number; initial: Week }) {
  const save = useSaveSchedule(resourceId);
  const [week, setWeek] = useState(initial);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [saved, setSaved] = useState(false);

  const edit = (next: Week) => {
    setSaved(false);
    setWeek(next);
    // A problem is shown until the day is touched again, not while the owner is still typing.
    setErrors({});
  };

  function submit() {
    const found = weekErrors(week);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    save.mutate(rulesFromWeek(week), { onSuccess: () => setSaved(true) });
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {week.map((windows, weekday) => (
        <Day
          key={weekday}
          weekday={weekday}
          windows={windows}
          error={errors[weekday]}
          onChange={(next) => edit(week.map((current, at) => (at === weekday ? next : current)))}
          onCopy={() => edit(copyDayToAll(week, weekday))}
        />
      ))}

      <p className="text-sm text-muted">
        Para atender pasada la medianoche, cierra a las 00:00 y abre el día siguiente desde las 00:00. Las reservas que ya existen no cambian.
      </p>

      {save.error && (
        <p role="alert" className="flex items-start gap-2 rounded-box border-[3px] border-danger p-4 font-semibold text-danger">
          <WarningCircle aria-hidden="true" className="mt-0.5 shrink-0" />
          {save.error.message}
        </p>
      )}
      {saved && (
        <p role="status" className="flex items-center gap-2 rounded-box border-[3px] border-line bg-surface p-4 font-semibold">
          <Check aria-hidden="true" />
          Horario guardado
        </p>
      )}

      <Button onClick={submit} disabled={save.isPending}>
        {save.isPending ? "Guardando" : "Guardar horario"}
      </Button>
    </div>
  );
}

/** One screen per space: switching to another one starts the editor over. */
export function SchedulePage() {
  const id = Number(useParams().id);
  return <ScheduleScreen key={id} id={id} />;
}

function ScheduleScreen({ id }: { id: number }) {
  const resources = useResources();
  const schedule = useSchedule(id);
  const resource = resources.data?.results.find((item) => item.id === id);

  // The editor starts from the saved week once; after that the owner's edits are the truth.
  const [initial, setInitial] = useState<Week | null>(null);
  useEffect(() => {
    if (schedule.data && initial === null) setInitial(weekFromRules(schedule.data.rules));
  }, [schedule.data, initial]);

  if (resources.isSuccess && !resource) {
    return <NotFoundPage title="No encontramos ese espacio" />;
  }

  return (
    <div className="grid max-w-[34rem] grid-cols-1 gap-6">
      <Link to="/panel/ajustes/espacios" className="inline-flex w-fit items-center gap-2 font-display font-bold underline decoration-[3px] underline-offset-4">
        <ArrowLeft aria-hidden="true" />
        Espacios
      </Link>
      <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.9] tracking-[-0.03em]">Horario</h1>
      {resource && <p className="font-display text-xl font-bold">{resource.name}</p>}
      <p className="text-muted">Los días y horas en que este espacio recibe reservas.</p>

      {schedule.isError && (
        <div role="alert" className="grid gap-3 rounded-box border-[3px] border-danger p-4">
          <p className="font-semibold text-danger">No pudimos cargar el horario. {schedule.error.message}</p>
          <Button variant="plain" onClick={() => void schedule.refetch()}>
            Intentar otra vez
          </Button>
        </div>
      )}

      {!schedule.isError && initial === null && (
        <div className="grid gap-4" aria-busy="true" aria-label="Cargando">
          <Skeleton className="h-[120px]" />
          <Skeleton className="h-[120px]" />
          <Skeleton className="h-[120px]" />
        </div>
      )}

      {initial !== null && <ScheduleEditor resourceId={id} initial={initial} />}
    </div>
  );
}
