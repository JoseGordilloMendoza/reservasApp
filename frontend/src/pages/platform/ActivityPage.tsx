import { X } from "@phosphor-icons/react";
import { Link, useSearchParams } from "react-router-dom";

import { Button } from "../../components/Button";
import { Skeleton } from "../../components/Skeleton";
import { describeActivity } from "../../lib/activityText";
import { formatShortDate, formatTime } from "../../lib/dates";
import { useActivity } from "../../lib/platformQueries";
import type { ActivityEntry, ActivityKind } from "../../lib/platformTypes";

const KINDS: { id: ActivityKind | "all"; label: string }[] = [
  { id: "all", label: "Todo" },
  { id: "business", label: "Negocios" },
  { id: "subscription", label: "Suscripciones" },
  { id: "payment", label: "Pagos" },
  { id: "user", label: "Personas" },
  { id: "support", label: "Soporte" },
];

const KNOWN = new Set<string>(KINDS.map((kind) => kind.id));

// The team works on Lima time, whatever the business it is looking at.
const ZONE = "America/Lima";

function Entry({ entry }: { entry: ActivityEntry }) {
  return (
    <li className="grid gap-1 rounded-box border-[3px] border-line bg-surface p-3 text-text">
      <p className="font-semibold">{describeActivity(entry)}</p>
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-muted">
        <time dateTime={entry.created_at} className="font-mono">
          {formatShortDate(entry.created_at, ZONE)} {formatTime(entry.created_at, ZONE)}
        </time>
        <span>{entry.actor_email}</span>
        {entry.business_slug && (
          <Link to={`/plataforma/negocios/${entry.business_slug}`} className="font-semibold text-text underline decoration-[3px] underline-offset-4">
            /{entry.business_slug}
          </Link>
        )}
      </p>
    </li>
  );
}

export function ActivityPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tipo") ?? "all";
  const kind = (KNOWN.has(raw) ? raw : "all") as ActivityKind | "all";
  const business = params.get("negocio") ?? "";

  const list = useActivity({ ...(kind === "all" ? {} : { kind }), ...(business ? { business } : {}) });
  const entries = list.data?.pages.flatMap((page) => page.results) ?? [];

  function change(next: { tipo?: string; negocio?: string }) {
    const merged = { tipo: kind === "all" ? "" : kind, negocio: business, ...next };
    setParams(Object.fromEntries(Object.entries(merged).filter(([, value]) => value && value !== "all")), { replace: true });
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.9] tracking-[-0.03em]">Actividad</h1>
      <p className="text-muted">Lo que el equipo hizo sobre los negocios: altas, suspensiones, pagos, personas y sesiones de soporte.</p>

      <div role="tablist" aria-label="Filtrar actividad" className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 pt-1 [scrollbar-width:none] md:mx-0 md:px-0">
        {KINDS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={kind === id}
            onClick={() => change({ tipo: id })}
            className={
              "press min-h-[48px] shrink-0 rounded-box border-[3px] border-line px-4 font-display text-base font-bold " +
              (kind === id ? "bg-accent text-on-accent shadow-hard" : "bg-surface text-text shadow-hard-sm")
            }
          >
            {label}
          </button>
        ))}
      </div>

      {business && (
        <p className="flex items-center justify-between gap-3 rounded-box border-[3px] border-line bg-surface p-3 font-semibold text-text">
          <span className="min-w-0 truncate">Solo de /{business}</span>
          <button type="button" onClick={() => change({ negocio: "" })} aria-label="Ver la actividad de todos los negocios" className="grid size-11 shrink-0 place-items-center">
            <X aria-hidden="true" />
          </button>
        </p>
      )}

      {list.isPending && (
        <div className="grid gap-3" aria-busy="true" aria-label="Cargando">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-[76px]" />
          ))}
        </div>
      )}

      {list.isError && (
        <div role="alert" className="grid gap-3 rounded-box border-[3px] border-danger p-4">
          <p className="font-semibold text-danger">No pudimos cargar la actividad. {list.error.message}</p>
          <Button variant="plain" onClick={() => void list.refetch()}>
            Intentar otra vez
          </Button>
        </div>
      )}

      {list.isSuccess && entries.length === 0 && (
        <p className="rounded-box border-[3px] border-dashed border-line p-5 font-display text-xl font-bold leading-tight">
          No hay actividad que mostrar.
        </p>
      )}

      {list.isSuccess && entries.length > 0 && (
        <>
          <ul className="grid grid-cols-1 gap-3">
            {entries.map((entry) => (
              <Entry key={entry.id} entry={entry} />
            ))}
          </ul>
          {list.hasNextPage && (
            <Button variant="plain" onClick={() => void list.fetchNextPage()} disabled={list.isFetchingNextPage}>
              {list.isFetchingNextPage ? "Cargando" : "Ver más"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
