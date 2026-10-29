import { Check, WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";
import type { FormEvent } from "react";

import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import { StandingStamp } from "../../components/platform/StandingStamp";
import { SelectField } from "../../components/SelectField";
import { Skeleton } from "../../components/Skeleton";
import { TextAreaField } from "../../components/TextAreaField";
import { formatDayKeyWithYear } from "../../lib/dates";
import { formatPrice } from "../../lib/format";
import { ApiError } from "../../lib/http";
import { METHODS, METHOD_LABEL, emptyPayment, toNewPayment, validatePayment } from "../../lib/paymentForm";
import type { PaymentErrors, PaymentValues } from "../../lib/paymentForm";
import { usePayments, useRecordPayment, useSaveSubscription } from "../../lib/platformQueries";
import type { Payment, PaymentMethod, PlatformBusiness } from "../../lib/platformTypes";
import { fromSubscription, movesTheEnd, toChanges, validateSubscription } from "../../lib/subscriptionForm";
import type { SubscriptionErrors, SubscriptionValues } from "../../lib/subscriptionForm";

function Problem({ message }: { message: string }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-box border-[3px] border-danger p-3 font-semibold text-danger">
      <WarningCircle aria-hidden="true" className="mt-0.5 shrink-0" />
      {message}
    </p>
  );
}

const SERVER_PAYMENT_FIELD: Record<string, keyof PaymentValues> = {
  amount: "amount",
  method: "method",
  paid_on: "paidOn",
  months: "months",
  reference: "reference",
  note: "note",
};

function RecordPayment({ business }: { business: PlatformBusiness }) {
  const record = useRecordPayment(business.slug);
  const [values, setValues] = useState(() => emptyPayment(business.subscription?.price));
  const [errors, setErrors] = useState<PaymentErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<Payment | null>(null);

  const set = (changes: Partial<PaymentValues>) => {
    setDone(null);
    setValues((current) => ({ ...current, ...changes }));
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const found = validatePayment(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    record.mutate(toNewPayment(values), {
      onSuccess: (payment) => {
        setDone(payment);
        setValues(emptyPayment(business.subscription?.price));
      },
      onError: (error) => {
        if (error instanceof ApiError && error.code === "invalid") {
          const fromServer: PaymentErrors = {};
          for (const [field, message] of Object.entries(error.fields)) {
            const key = SERVER_PAYMENT_FIELD[field];
            if (key) fromServer[key] = message;
          }
          setErrors(fromServer);
          setFormError(Object.keys(fromServer).length ? null : error.message);
        } else {
          setFormError(error.message);
        }
      },
    });
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Registrar un pago" className="grid gap-4 rounded-box border-[3px] border-line bg-surface p-4 text-text shadow-hard">
      <h3 className="font-display text-xl font-extrabold">Registrar un pago</h3>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Monto (S/)" inputMode="decimal" autoComplete="off" value={values.amount} error={errors.amount} onChange={(event) => set({ amount: event.target.value })} />
        <Field label="Meses que paga" inputMode="numeric" autoComplete="off" value={values.months} error={errors.months} onChange={(event) => set({ months: event.target.value })} />
      </div>
      <SelectField label="Cómo pagó" value={values.method} onChange={(event) => set({ method: event.target.value as PaymentMethod })}>
        {METHODS.map((method) => (
          <option key={method} value={method}>
            {METHOD_LABEL[method]}
          </option>
        ))}
      </SelectField>
      <Field label="Fecha del pago" type="date" hint="Si la dejas vacía, es hoy." value={values.paidOn} error={errors.paidOn} onChange={(event) => set({ paidOn: event.target.value })} />
      <Field label="Referencia (opcional)" autoComplete="off" placeholder="N.º de operación" value={values.reference} error={errors.reference} onChange={(event) => set({ reference: event.target.value })} />
      <Field label="Nota (opcional)" autoComplete="off" value={values.note} error={errors.note} onChange={(event) => set({ note: event.target.value })} />

      {formError && <Problem message={formError} />}
      {done && (
        <p role="status" className="flex items-start gap-2 rounded-box border-[3px] border-line p-3 font-semibold">
          <Check aria-hidden="true" className="mt-0.5 shrink-0" />
          Pago registrado: cubre del {formatDayKeyWithYear(done.period_start)} al {formatDayKeyWithYear(done.period_end)}.
        </p>
      )}

      <Button type="submit" disabled={record.isPending}>
        {record.isPending ? "Registrando" : "Registrar pago"}
      </Button>
    </form>
  );
}

const SERVER_SUBSCRIPTION_FIELD: Record<string, keyof SubscriptionValues> = {
  plan_name: "plan",
  price: "price",
  valid_until: "validUntil",
  notes: "notes",
  reason: "reason",
};

function EditSubscription({ business, onDone }: { business: PlatformBusiness; onDone: () => void }) {
  const save = useSaveSubscription(business.slug);
  const current = business.subscription;
  const creating = current === null;

  const [values, setValues] = useState(() => fromSubscription(current));
  const [errors, setErrors] = useState<SubscriptionErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const set = (changes: Partial<SubscriptionValues>) => setValues((existing) => ({ ...existing, ...changes }));

  function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const found = validateSubscription(values, current);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const changes = toChanges(values, current);
    if (Object.keys(changes).length === 0) {
      onDone();
      return;
    }

    save.mutate(changes, {
      onSuccess: onDone,
      onError: (error) => {
        if (error instanceof ApiError && error.code === "invalid") {
          const fromServer: SubscriptionErrors = {};
          for (const [field, message] of Object.entries(error.fields)) {
            const key = SERVER_SUBSCRIPTION_FIELD[field];
            if (key) fromServer[key] = message;
          }
          setErrors(fromServer);
          setFormError(Object.keys(fromServer).length ? null : error.message);
        } else {
          setFormError(error.message);
        }
      },
    });
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label={creating ? "Crear la suscripción" : "Ajustar la suscripción"}
      className="grid gap-4 rounded-box border-[3px] border-line bg-surface p-4 text-text shadow-hard"
    >
      <h3 className="font-display text-xl font-extrabold">{creating ? "Crear la suscripción" : "Ajustar la suscripción"}</h3>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Plan (opcional)" autoComplete="off" value={values.plan} error={errors.plan} onChange={(event) => set({ plan: event.target.value })} />
        <Field label="Precio al mes (S/)" inputMode="decimal" autoComplete="off" value={values.price} error={errors.price} onChange={(event) => set({ price: event.target.value })} />
      </div>
      <Field
        label="Vale hasta el"
        type="date"
        hint={creating ? undefined : "Normalmente un pago la mueve solo. Cámbiala solo para corregir algo."}
        value={values.validUntil}
        error={errors.validUntil}
        onChange={(event) => set({ validUntil: event.target.value })}
      />
      {movesTheEnd(values, current) && (
        <Field
          label="¿Por qué cambias la vigencia?"
          autoComplete="off"
          hint="Queda en el registro de actividad."
          value={values.reason}
          error={errors.reason}
          onChange={(event) => set({ reason: event.target.value })}
        />
      )}
      <TextAreaField label="Notas (opcional)" value={values.notes} error={errors.notes} onChange={(event) => set({ notes: event.target.value })} />

      {formError && <Problem message={formError} />}

      <div className="grid grid-cols-2 gap-3">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Guardando" : "Guardar"}
        </Button>
        <Button variant="plain" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function History({ slug }: { slug: string }) {
  const payments = usePayments(slug);

  return (
    <section aria-labelledby="historial" className="grid gap-3">
      <h3 id="historial" className="font-display text-xl font-extrabold">
        Pagos recibidos
      </h3>

      {payments.isPending && <Skeleton className="h-[88px]" />}
      {payments.isError && <Problem message={`No pudimos cargar los pagos. ${payments.error.message}`} />}
      {payments.isSuccess && payments.data.length === 0 && (
        <p className="rounded-box border-[3px] border-dashed border-line p-4 font-semibold">Todavía no hay pagos registrados.</p>
      )}
      {payments.isSuccess && payments.data.length > 0 && (
        <ul className="grid gap-3">
          {payments.data.map((payment) => (
            <li key={payment.id} className="grid gap-1 rounded-box border-[3px] border-line bg-surface p-3 text-text">
              <p className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-xl font-bold">{formatPrice(payment.amount)}</span>
                <span className="text-sm text-muted">
                  {formatDayKeyWithYear(payment.paid_on)} · {METHOD_LABEL[payment.method]}
                </span>
              </p>
              <p className="text-sm">
                Cubre del {formatDayKeyWithYear(payment.period_start)} al {formatDayKeyWithYear(payment.period_end)}
                {payment.months > 1 ? ` (${payment.months} meses)` : ""}
              </p>
              {payment.reference && <p className="text-sm text-muted">Ref. {payment.reference}</p>}
              {payment.note && <p className="text-sm text-muted">{payment.note}</p>}
              {payment.recorded_by && <p className="text-xs text-muted">Registrado por {payment.recorded_by}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SubscriptionSection({ business }: { business: PlatformBusiness }) {
  const [editing, setEditing] = useState(false);
  const { subscription, standing } = business;

  return (
    <div className="grid grid-cols-1 gap-6">
      <section aria-labelledby="estado" className="grid gap-3 rounded-box border-[3px] border-line bg-surface p-4 text-text shadow-hard-sm">
        <div className="flex items-start justify-between gap-3">
          <h2 id="estado" className="font-display text-2xl font-extrabold">
            Suscripción
          </h2>
          <StandingStamp standing={standing} suspended={business.status === "suspended"} />
        </div>

        {subscription ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-muted">Plan</dt>
              <dd className="font-semibold">{subscription.plan_name || "Sin nombre"}</dd>
            </div>
            <div>
              <dt className="text-muted">Precio al mes</dt>
              <dd className="font-mono font-bold">{formatPrice(subscription.price)}</dd>
            </div>
            <div>
              <dt className="text-muted">Vale hasta el</dt>
              <dd className="font-semibold">{formatDayKeyWithYear(subscription.valid_until)}</dd>
            </div>
            {standing.state === "grace" && standing.grace_ends_on && (
              <div>
                <dt className="text-muted">Recibe reservas hasta el</dt>
                <dd className="font-semibold">{formatDayKeyWithYear(standing.grace_ends_on)}</dd>
              </div>
            )}
            {subscription.notes && (
              <div className="col-span-2">
                <dt className="text-muted">Notas</dt>
                <dd className="whitespace-pre-line">{subscription.notes}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p>Este negocio no tiene suscripción, así que nunca vence. Créala para cobrarle y para que se bloquee si no paga.</p>
        )}
      </section>

      {subscription && <RecordPayment business={business} />}

      {editing ? (
        <EditSubscription business={business} onDone={() => setEditing(false)} />
      ) : (
        <Button variant="plain" onClick={() => setEditing(true)}>
          {subscription ? "Ajustar la suscripción" : "Crear la suscripción"}
        </Button>
      )}

      {subscription && <History slug={business.slug} />}
    </div>
  );
}
