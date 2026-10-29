import { ArrowLeft, Check, Copy, EnvelopeSimple, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import { Button, buttonClass } from "../../components/Button";
import { Field } from "../../components/Field";
import { SelectField } from "../../components/SelectField";
import { formatDayKey } from "../../lib/dates";
import { KIND_LABEL, KINDS } from "../../lib/kinds";
import { ApiError } from "../../lib/http";
import { SERVER_FIELD, emptyBusiness, toNewBusiness, validateNewBusiness } from "../../lib/newBusiness";
import type { NewBusinessErrors, NewBusinessValues } from "../../lib/newBusiness";
import { useCreateBusiness } from "../../lib/platformQueries";
import type { BusinessKind, CreatedBusiness } from "../../lib/platformTypes";

function Done({ business, onAnother }: { business: CreatedBusiness; onAnother: () => void }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/${business.slug}`;

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
      <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.9] tracking-[-0.03em]">Negocio abierto</h1>

      <div className="grid gap-2 rounded-box border-[3px] border-line bg-surface p-5 text-text shadow-hard">
        <p className="font-display text-3xl font-extrabold leading-tight">{business.name}</p>
        <p className="text-muted">
          {KIND_LABEL[business.business_type]}
          {business.standing.valid_until ? ` · vigente hasta el ${formatDayKey(business.standing.valid_until)}` : ""}
        </p>
      </div>

      <section aria-labelledby="dueno" className="grid gap-3">
        <h2 id="dueno" className="flex items-center gap-2 font-display text-xl font-extrabold">
          <EnvelopeSimple aria-hidden="true" />
          El dueño
        </h2>
        <p role="status">
          {business.owner.account_created ? (
            <>
              Le enviamos un correo a <strong className="break-all">{business.owner.email}</strong> para que elija su contraseña. El enlace
              vale una hora; si vence, puedes reenviarlo desde la ficha del negocio.
            </>
          ) : (
            <>
              <strong className="break-all">{business.owner.email}</strong> ya tenía cuenta: la conserva tal como estaba, y le avisamos
              por correo que ahora también administra este negocio.
            </>
          )}
        </p>
      </section>

      <section aria-labelledby="enlace" className="grid gap-3">
        <h2 id="enlace" className="font-display text-xl font-extrabold">
          Su enlace para reservar
        </h2>
        <textarea
          readOnly
          rows={2}
          value={link}
          aria-label="Enlace del negocio"
          onFocus={(event) => event.currentTarget.select()}
          className="w-full resize-none break-all rounded-box border-[3px] border-line bg-paper px-4 py-3 font-mono text-sm text-text"
        />
        <Button variant="plain" onClick={() => void copy()}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? "Copiado" : "Copiar enlace"}
        </Button>
      </section>

      <div className="grid gap-3">
        <Link to={`/plataforma/negocios/${business.slug}`} className={buttonClass("ink")}>
          Ver el negocio
        </Link>
        <Button variant="plain" onClick={onAnother}>
          Abrir otro
        </Button>
      </div>
    </div>
  );
}

export function NewBusinessPage() {
  const create = useCreateBusiness();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<NewBusinessValues>(emptyBusiness);
  const [errors, setErrors] = useState<NewBusinessErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedBusiness | null>(null);
  const [focusTick, setFocusTick] = useState(0);

  // Runs after the errors are painted, when the invalid fields can be found.
  useEffect(() => {
    if (focusTick === 0) return;
    formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
  }, [focusTick]);

  const set = (changes: Partial<NewBusinessValues>) => setValues((current) => ({ ...current, ...changes }));

  if (created) {
    return (
      <Done
        business={created}
        onAnother={() => {
          setCreated(null);
          setValues(emptyBusiness());
          setErrors({});
        }}
      />
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const found = validateNewBusiness(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // Take the person to the first thing to fix: on a phone it may be off screen.
      setFocusTick((tick) => tick + 1);
      return;
    }

    create.mutate(toNewBusiness(values), {
      onSuccess: setCreated,
      onError: (error) => {
        if (error instanceof ApiError && error.code === "invalid") {
          const fromServer: NewBusinessErrors = {};
          for (const [field, message] of Object.entries(error.fields)) {
            const key = SERVER_FIELD[field];
            if (key) fromServer[key] = message;
          }
          setErrors(fromServer);
          // A complaint about a field that is not on screen (the other way of giving the term)
          // would go unseen, so it is also said in general.
          const hidden = values.term === "trial" ? "validUntil" : "trialDays";
          const unseen = fromServer[hidden];
          setFormError(unseen ?? (Object.keys(fromServer).length ? null : (Object.values(error.fields)[0] ?? error.message)));
          if (Object.keys(fromServer).length) setFocusTick((tick) => tick + 1);
        } else {
          setFormError(error.message);
        }
      },
    });
  }

  return (
    <div className="grid max-w-[34rem] grid-cols-1 gap-6">
      <Link to="/plataforma/negocios" className="inline-flex w-fit items-center gap-2 font-display font-bold underline decoration-[3px] underline-offset-4">
        <ArrowLeft aria-hidden="true" />
        Negocios
      </Link>
      <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.9] tracking-[-0.03em]">Nuevo negocio</h1>
      <p className="text-muted">Crea el negocio, a su dueño y su suscripción de una vez. El dueño recibe un correo para elegir su contraseña.</p>

      <form ref={formRef} onSubmit={submit} noValidate className="grid gap-8">
        <section aria-labelledby="negocio" className="grid gap-4">
          <h2 id="negocio" className="font-display text-2xl font-extrabold">
            El negocio
          </h2>
          <Field label="Nombre del negocio" autoComplete="off" value={values.name} error={errors.name} onChange={(event) => set({ name: event.target.value })} />
          <SelectField label="Tipo" value={values.kind} onChange={(event) => set({ kind: event.target.value as BusinessKind })}>
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {KIND_LABEL[kind]}
              </option>
            ))}
          </SelectField>
          <Field
            label="Link (opcional)"
            autoComplete="off"
            placeholder="canchas-el-sol"
            hint="Déjalo vacío y se arma con el nombre. Después no se cambia desde aquí."
            value={values.slug}
            error={errors.slug}
            onChange={(event) => set({ slug: event.target.value })}
          />
        </section>

        <section aria-labelledby="duenoform" className="grid gap-4">
          <h2 id="duenoform" className="font-display text-2xl font-extrabold">
            El dueño
          </h2>
          <Field
            label="Correo del dueño"
            type="email"
            inputMode="email"
            autoComplete="off"
            value={values.ownerEmail}
            error={errors.ownerEmail}
            onChange={(event) => set({ ownerEmail: event.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nombre del dueño" autoComplete="off" value={values.ownerFirstName} error={errors.ownerFirstName} onChange={(event) => set({ ownerFirstName: event.target.value })} />
            <Field label="Apellido del dueño" autoComplete="off" value={values.ownerLastName} error={errors.ownerLastName} onChange={(event) => set({ ownerLastName: event.target.value })} />
          </div>
        </section>

        <section aria-labelledby="suscripcion" className="grid gap-4">
          <h2 id="suscripcion" className="font-display text-2xl font-extrabold">
            La suscripción
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Plan (opcional)" autoComplete="off" placeholder="Mensual" value={values.plan} error={errors.plan} onChange={(event) => set({ plan: event.target.value })} />
            <Field
              label="Precio al mes (S/)"
              inputMode="decimal"
              autoComplete="off"
              value={values.price}
              error={errors.price}
              onChange={(event) => set({ price: event.target.value })}
            />
          </div>

          <div role="radiogroup" aria-label="Vigencia" className="grid gap-3">
            {(
              [
                { id: "trial", label: "Prueba de unos días desde hoy" },
                { id: "date", label: "Hasta un día en concreto" },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={values.term === id}
                onClick={() => set({ term: id })}
                className={
                  "press min-h-[52px] rounded-box border-[3px] border-line px-4 py-3 text-left font-display text-lg font-bold " +
                  (values.term === id ? "bg-accent text-on-accent shadow-hard" : "bg-surface text-text shadow-hard-sm")
                }
              >
                {label}
              </button>
            ))}
          </div>

          {values.term === "trial" ? (
            <Field
              label="Días de prueba"
              inputMode="numeric"
              autoComplete="off"
              value={values.trialDays}
              error={errors.trialDays}
              hint="Cuando se acaben, el negocio tiene 5 días de gracia antes de dejar de recibir reservas."
              onChange={(event) => set({ trialDays: event.target.value })}
            />
          ) : (
            <Field label="Vale hasta el" type="date" value={values.validUntil} error={errors.validUntil} onChange={(event) => set({ validUntil: event.target.value })} />
          )}
        </section>

        {formError && (
          <p role="alert" className="flex items-start gap-2 rounded-box border-[3px] border-danger p-4 font-semibold text-danger">
            <WarningCircle aria-hidden="true" className="mt-0.5 shrink-0" />
            {formError}
          </p>
        )}

        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? "Abriendo" : "Abrir negocio"}
        </Button>
      </form>
    </div>
  );
}
