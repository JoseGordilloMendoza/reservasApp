import { ArrowLeft, Check, Copy, WarningCircle, WhatsappLogo } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import { Button, ButtonLink, buttonClass } from "../../components/Button";
import { Field } from "../../components/Field";
import { Skeleton } from "../../components/Skeleton";
import { validateCustomer } from "../../lib/customer";
import type { CustomerErrors } from "../../lib/customer";
import { formatLongDate, formatTime, nextWholeHour } from "../../lib/dates";
import { formatDuration, formatPrice } from "../../lib/format";
import { ApiError } from "../../lib/http";
import type { PanelCreatedBooking, PanelService } from "../../lib/panelTypes";
import { useCreateBooking, usePanelBusiness, useServices } from "../../lib/panelQueries";
import { zonedToUtc } from "../../lib/time";
import { whatsappLink } from "../../lib/whatsapp";

const SERVER_FIELDS: Record<string, "name" | "phone" | "email"> = {
  "customer.name": "name",
  "customer.phone": "phone",
  "customer.email": "email",
};

function ServiceChoice({
  services,
  selected,
  onSelect,
}: {
  services: PanelService[];
  selected: number | null;
  onSelect: (id: number) => void;
}) {
  const several = new Set(services.map((service) => service.resource.id)).size > 1;

  return (
    <div role="radiogroup" aria-label="Servicio" className="grid gap-3">
      {services.map((service) => {
        const active = service.id === selected;
        const price = formatPrice(service.reference_price);
        return (
          <button
            key={service.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(service.id)}
            className={
              "press flex min-h-[60px] items-center justify-between gap-3 rounded-box border-[3px] border-line px-4 py-3 text-left " +
              (active ? "bg-accent text-on-accent shadow-hard" : "bg-surface text-text shadow-hard-sm")
            }
          >
            <span className="grid">
              <span className="font-display text-lg font-extrabold leading-tight">
                {several ? service.resource.name : service.name}
              </span>
              <span className="text-sm">
                {several ? `${service.name} · ` : ""}
                {formatDuration(service.duration_minutes)}
              </span>
            </span>
            <span className="font-mono font-bold">{price}</span>
          </button>
        );
      })}
    </div>
  );
}

function Done({ booking, business, slug, timeZone, onAnother }: {
  booking: PanelCreatedBooking;
  business: string;
  slug: string;
  timeZone: string;
  onAnother: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/${slug}/reserva/${booking.manage_token}`;
  const when = `${formatLongDate(booking.starts_at, timeZone)} a las ${formatTime(booking.starts_at, timeZone)}`;
  const chat = whatsappLink(
    booking.customer.phone,
    `Hola ${booking.customer.name}, tu reserva en ${business} quedó anotada para el ${when}. Aquí puedes verla o cancelarla: ${link}`,
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Clipboard access can be refused; the link stays visible to copy by hand.
    }
  }

  return (
    <div className="grid max-w-[34rem] grid-cols-1 gap-6">
      <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.9] tracking-[-0.03em]">Reserva anotada</h1>

      <div className="grid gap-2 rounded-box border-[3px] border-line bg-surface p-5 text-text shadow-hard">
        <p className="font-display text-3xl font-extrabold leading-tight">{booking.customer.name}</p>
        <p className="font-display text-lg font-bold first-letter:uppercase">{formatLongDate(booking.starts_at, timeZone)}</p>
        <p className="font-mono text-4xl font-bold leading-none">{formatTime(booking.starts_at, timeZone)}</p>
        <p className="text-muted">
          {booking.service.name} · {booking.resource.name}
        </p>
      </div>

      <section aria-labelledby="enlace" className="grid gap-3">
        <h2 id="enlace" className="font-display text-xl font-extrabold">
          Enlace para el cliente
        </h2>
        <p className="text-muted">Con él puede ver su reserva y cancelarla. Solo se muestra ahora.</p>
        <input
          readOnly
          value={link}
          aria-label="Enlace de la reserva"
          onFocus={(event) => event.currentTarget.select()}
          className="min-h-[52px] w-full rounded-box border-[3px] border-line bg-surface px-4 font-mono text-sm text-text"
        />
        <div className="grid gap-3">
          {chat && (
            <ButtonLink href={chat} target="_blank" rel="noreferrer">
              <WhatsappLogo aria-hidden="true" />
              Enviar por WhatsApp
            </ButtonLink>
          )}
          <Button variant="plain" onClick={() => void copy()}>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? "Copiado" : "Copiar enlace"}
          </Button>
        </div>
      </section>

      <div className="grid gap-3">
        <Link to={`/panel/reservas/${booking.id}`} className={buttonClass("ink")}>
          Ver la reserva
        </Link>
        <Button variant="plain" onClick={onAnother}>
          Anotar otra
        </Button>
      </div>
    </div>
  );
}

export function NewBookingPage() {
  const business = usePanelBusiness();
  const services = useServices();
  const create = useCreateBooking();
  const formRef = useRef<HTMLFormElement>(null);

  const timeZone = business.data?.timezone;
  const active = (services.data?.results ?? []).filter((service) => service.is_active);

  const [serviceId, setServiceId] = useState<number | null>(null);
  const [when, setWhen] = useState<{ date: string; time: string } | null>(null);
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "" });
  const [errors, setErrors] = useState<CustomerErrors & { when?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<PanelCreatedBooking | null>(null);

  if (business.isPending || services.isPending || !timeZone || !business.data) {
    return (
      <div className="grid max-w-[34rem] gap-4" aria-busy="true" aria-label="Cargando">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-[420px]" />
      </div>
    );
  }

  if (created) {
    return (
      <Done
        booking={created}
        business={business.data.name}
        slug={business.data.slug}
        timeZone={timeZone}
        onAnother={() => {
          setCreated(null);
          setCustomer({ name: "", phone: "", email: "" });
          setWhen(null);
        }}
      />
    );
  }

  const chosenService = serviceId ?? active[0]?.id ?? null;
  const moment = when ?? nextWholeHour(timeZone);

  function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const found: CustomerErrors & { when?: string } = validateCustomer({ ...customer, accepted: true });
    delete found.accepted;
    if (!moment.date || !moment.time) found.when = "Elige el día y la hora.";
    setErrors(found);
    if (Object.keys(found).length > 0 || chosenService === null) return;

    create.mutate(
      {
        service: chosenService,
        starts_at: zonedToUtc(moment.date, moment.time, timeZone!).toISOString(),
        customer: { name: customer.name.trim(), phone: customer.phone.trim(), email: customer.email.trim() },
      },
      {
        onSuccess: setCreated,
        onError: (error) => {
          if (error instanceof ApiError && error.code === "invalid") {
            const fromServer: CustomerErrors = {};
            for (const [field, message] of Object.entries(error.fields)) {
              const key = SERVER_FIELDS[field];
              if (key) fromServer[key] = message;
            }
            setErrors(fromServer);
            setFormError(Object.keys(fromServer).length ? null : error.message);
          } else {
            setFormError(error.message);
          }
        },
      },
    );
  }

  return (
    <div className="grid max-w-[34rem] grid-cols-1 gap-6">
      <Link to="/panel" className="inline-flex w-fit items-center gap-2 font-display font-bold underline decoration-[3px] underline-offset-4">
        <ArrowLeft aria-hidden="true" />
        Inicio
      </Link>
      <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.9] tracking-[-0.03em]">Anotar reserva</h1>
      <p className="text-muted">Para las que te piden por llamada o por WhatsApp. Queda confirmada al instante.</p>

      {active.length === 0 ? (
        <p className="rounded-box border-[3px] border-dashed border-line p-5 font-display text-xl font-bold leading-tight">
          Tu negocio todavía no tiene servicios para reservar.
        </p>
      ) : (
        <form ref={formRef} onSubmit={submit} noValidate className="grid gap-6">
          {active.length > 1 && (
            <section aria-labelledby="servicio" className="grid gap-3">
              <h2 id="servicio" className="font-display text-2xl font-extrabold">¿Qué reserva?</h2>
              <ServiceChoice services={active} selected={chosenService} onSelect={setServiceId} />
            </section>
          )}

          <section aria-labelledby="cuando" className="grid gap-4">
            <h2 id="cuando" className="font-display text-2xl font-extrabold">¿Cuándo?</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Día"
                type="date"
                value={moment.date}
                onChange={(event) => setWhen({ ...moment, date: event.target.value })}
                error={errors.when}
              />
              <Field
                label="Hora"
                type="time"
                step={300}
                value={moment.time}
                onChange={(event) => setWhen({ ...moment, time: event.target.value })}
              />
            </div>
          </section>

          <section aria-labelledby="cliente" className="grid gap-4">
            <h2 id="cliente" className="font-display text-2xl font-extrabold">¿A nombre de quién?</h2>
            <Field
              label="Nombre"
              autoComplete="off"
              value={customer.name}
              error={errors.name}
              onChange={(event) => setCustomer({ ...customer, name: event.target.value })}
            />
            <Field
              label="Celular"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="987 654 321"
              value={customer.phone}
              error={errors.phone}
              onChange={(event) => setCustomer({ ...customer, phone: event.target.value })}
            />
            <Field
              label="Correo (opcional)"
              type="email"
              inputMode="email"
              autoComplete="off"
              value={customer.email}
              error={errors.email}
              onChange={(event) => setCustomer({ ...customer, email: event.target.value })}
            />
          </section>

          {formError && (
            <p role="alert" className="flex items-start gap-2 rounded-box border-[3px] border-danger p-4 font-semibold text-danger">
              <WarningCircle aria-hidden="true" className="mt-0.5 shrink-0" />
              {formError}
            </p>
          )}

          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Anotando" : "Anotar reserva"}
          </Button>
        </form>
      )}
    </div>
  );
}
