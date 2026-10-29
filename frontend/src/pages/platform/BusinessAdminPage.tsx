import { ArrowLeft, Check, Copy, Lifebuoy, WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { Button } from "../../components/Button";
import { ConfirmAction } from "../../components/ConfirmAction";
import { Field } from "../../components/Field";
import { StandingStamp } from "../../components/platform/StandingStamp";
import { Skeleton } from "../../components/Skeleton";
import { useAuth } from "../../lib/auth";
import { formatShortDate } from "../../lib/dates";
import { ApiError } from "../../lib/http";
import { KIND_LABEL } from "../../lib/kinds";
import { useBusiness, useReactivate, useStartSupport, useSuspend } from "../../lib/platformQueries";
import type { PlatformBusiness } from "../../lib/platformTypes";
import { NotFoundPage } from "../NotFoundPage";
import { MembersSection } from "./MembersSection";
import { SubscriptionSection } from "./SubscriptionSection";

type Section = "resumen" | "suscripcion" | "personas";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "resumen", label: "Resumen" },
  { id: "suscripcion", label: "Suscripción" },
  { id: "personas", label: "Personas" },
];

function Problem({ message }: { message: string }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-box border-[3px] border-danger p-3 font-semibold text-danger">
      <WarningCircle aria-hidden="true" className="mt-0.5 shrink-0" />
      {message}
    </p>
  );
}

function PublicLink({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/${slug}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Clipboard access can be refused; the link stays visible to copy by hand.
    }
  }

  return (
    <div className="grid gap-3">
      <textarea
        readOnly
        rows={2}
        value={link}
        aria-label="Enlace público"
        onFocus={(event) => event.currentTarget.select()}
        className="w-full resize-none break-all rounded-box border-[3px] border-line bg-paper px-4 py-3 font-mono text-sm text-text"
      />
      <Button variant="plain" onClick={() => void copy()}>
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copied ? "Copiado" : "Copiar enlace"}
      </Button>
    </div>
  );
}

function Suspension({ business }: { business: PlatformBusiness }) {
  const suspend = useSuspend(business.slug);
  const reactivate = useReactivate(business.slug);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>();

  function confirm(event: FormEvent) {
    event.preventDefault();
    if (!reason.trim()) {
      setReasonError("Escribe el motivo: queda en el registro.");
      return;
    }
    suspend.mutate(reason.trim(), {
      onSuccess: () => {
        setAsking(false);
        setReason("");
      },
      onError: (error) => setReasonError(error instanceof ApiError ? (error.fields.reason ?? error.message) : error.message),
    });
  }

  if (business.status === "suspended") {
    return (
      <section aria-labelledby="suspension" className="grid gap-3 rounded-box border-[3px] border-danger p-4 text-text">
        <h3 id="suspension" className="font-display text-xl font-extrabold text-danger">
          Suspendido
        </h3>
        <p>
          <span className="text-muted">Motivo: </span>
          {business.suspended_reason || "sin motivo registrado"}
        </p>
        <p className="text-sm text-muted">No recibe reservas nuevas; su dueño sigue viendo sus datos.</p>
        {business.standing.state === "expired" && (
          <p className="text-sm font-semibold">
            Aunque lo reactives, seguirá sin recibir reservas hasta que registres un pago: su suscripción está vencida.
          </p>
        )}
        <ConfirmAction
          label="Reactivar"
          question="¿Reactivar este negocio?"
          confirmLabel="Sí, reactivar"
          busy={reactivate.isPending}
          onConfirm={() => reactivate.mutate()}
        />
        {reactivate.error && <Problem message={reactivate.error.message} />}
      </section>
    );
  }

  return (
    <section aria-labelledby="suspension" className="grid gap-3">
      <h3 id="suspension" className="font-display text-xl font-extrabold">
        Suspender
      </h3>
      <p className="text-sm text-muted">Deja de recibir reservas nuevas. No se borra nada y su dueño sigue viendo sus datos.</p>
      {asking ? (
        <form onSubmit={confirm} noValidate aria-label="Suspender el negocio" className="grid gap-3 rounded-box border-[3px] border-line bg-surface p-4 text-text">
          <Field
            label="Motivo"
            autoComplete="off"
            placeholder="No pagó los dos últimos meses"
            value={reason}
            error={reasonError}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Button type="submit" variant="ink" disabled={suspend.isPending}>
              Suspender
            </Button>
            <Button variant="plain" onClick={() => setAsking(false)}>
              No
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="plain" onClick={() => setAsking(true)}>
          Suspender negocio
        </Button>
      )}
    </section>
  );
}

function Support({ business }: { business: PlatformBusiness }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const start = useStartSupport(business.slug);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>();

  function enter(event: FormEvent) {
    event.preventDefault();
    if (!reason.trim()) {
      setReasonError("Escribe por qué entras: queda en el registro.");
      return;
    }
    setReasonError(undefined);
    start.mutate(reason.trim(), {
      onSuccess: (session) => {
        auth.startSupport({
          session: session.id,
          slug: business.slug,
          name: business.name,
          reason: session.reason,
          expires_at: session.expires_at,
        });
        navigate("/panel");
      },
    });
  }

  return (
    <section aria-labelledby="soporte" className="grid gap-3">
      <h3 id="soporte" className="flex items-center gap-2 font-display text-xl font-extrabold">
        <Lifebuoy aria-hidden="true" />
        Ayudar desde su panel
      </h3>
      <p className="text-sm text-muted">
        Entras a su panel con los mismos permisos que su dueño, por 2 horas. Queda registrado quién entró, por qué y qué cambió.
      </p>
      <form onSubmit={enter} noValidate aria-label="Entrar como soporte" className="grid gap-3 rounded-box border-[3px] border-line bg-surface p-4 text-text">
        <Field
          label="¿Por qué entras?"
          autoComplete="off"
          placeholder="El dueño no puede cargar sus horarios"
          value={reason}
          error={reasonError}
          onChange={(event) => setReason(event.target.value)}
        />
        {start.error && <Problem message={start.error.message} />}
        <Button type="submit" disabled={start.isPending}>
          {start.isPending ? "Abriendo" : "Entrar como soporte"}
        </Button>
      </form>
    </section>
  );
}

function Summary({ business }: { business: PlatformBusiness }) {
  const users = business.users_count === 1 ? "1 persona" : `${business.users_count} personas`;

  return (
    <div className="grid grid-cols-1 gap-8">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-box border-[3px] border-line bg-surface p-4 text-sm text-text shadow-hard-sm">
        <div>
          <dt className="text-muted">Tipo</dt>
          <dd className="font-semibold">{KIND_LABEL[business.business_type]}</dd>
        </div>
        <div>
          <dt className="text-muted">Zona horaria</dt>
          <dd className="font-semibold">{business.timezone}</dd>
        </div>
        <div>
          <dt className="text-muted">Personas</dt>
          <dd className="font-semibold">{users}</dd>
        </div>
        <div>
          <dt className="text-muted">Reservas, 30 días</dt>
          <dd className="font-mono font-bold">{business.bookings_30d}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted">Creado</dt>
          <dd className="font-semibold">{formatShortDate(business.created_at, "America/Lima")}</dd>
        </div>
      </dl>

      <section aria-labelledby="enlace" className="grid gap-3">
        <h3 id="enlace" className="font-display text-xl font-extrabold">
          Su enlace para reservar
        </h3>
        <PublicLink slug={business.slug} />
      </section>

      <Link
        to={`/plataforma/actividad?negocio=${business.slug}`}
        className="font-display font-bold underline decoration-[3px] underline-offset-4"
      >
        Ver lo que el equipo hizo en este negocio
      </Link>

      <Support business={business} />
      <Suspension business={business} />
    </div>
  );
}

export function BusinessAdminPage() {
  const { slug = "" } = useParams();
  const business = useBusiness(slug);
  const [params, setParams] = useSearchParams();
  const raw = params.get("seccion");
  const section: Section = SECTIONS.some((item) => item.id === raw) ? (raw as Section) : "resumen";

  if (business.isError) {
    const missing = business.error instanceof ApiError && business.error.status === 404;
    return (
      <NotFoundPage
        title={missing ? "No encontramos ese negocio" : "No pudimos cargar el negocio"}
        hint={missing ? undefined : business.error.message}
      />
    );
  }

  if (business.isPending) {
    return (
      <div className="grid gap-4" aria-busy="true" aria-label="Cargando">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[320px]" />
      </div>
    );
  }

  const data = business.data;

  return (
    <div className="grid grid-cols-1 gap-6">
      <Link to="/plataforma/negocios" className="inline-flex w-fit items-center gap-2 font-display font-bold underline decoration-[3px] underline-offset-4">
        <ArrowLeft aria-hidden="true" />
        Negocios
      </Link>

      <header className="grid gap-3">
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 break-words font-display text-4xl font-extrabold leading-[0.95] sm:text-5xl">{data.name}</h1>
          <StandingStamp standing={data.standing} suspended={data.status === "suspended"} />
        </div>
        <p className="font-mono text-sm text-muted">/{data.slug}</p>
      </header>

      <div role="tablist" aria-label="Secciones del negocio" className="flex gap-3 overflow-x-auto pb-2 pt-1 [scrollbar-width:none]">
        {SECTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={section === id}
            onClick={() => setParams(id === "resumen" ? {} : { seccion: id }, { replace: true })}
            className={
              "press min-h-[48px] shrink-0 rounded-box border-[3px] border-line px-4 font-display text-base font-bold " +
              (section === id ? "bg-accent text-on-accent shadow-hard" : "bg-surface text-text shadow-hard-sm")
            }
          >
            {label}
          </button>
        ))}
      </div>

      {section === "resumen" && <Summary business={data} />}
      {section === "suscripcion" && <SubscriptionSection business={data} />}
      {section === "personas" && <MembersSection slug={data.slug} />}
    </div>
  );
}
