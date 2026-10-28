import { ArrowLeft, Check, WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import { AccentPicker } from "../../components/panel/AccentPicker";
import { Skeleton } from "../../components/Skeleton";
import { TextAreaField } from "../../components/TextAreaField";
import { ApiError } from "../../lib/http";
import type { PanelBusiness } from "../../lib/panelTypes";
import { usePanelBusiness, useUpdateBusiness } from "../../lib/panelQueries";

const FIELDS = ["name", "description", "address", "phone", "whatsapp"] as const;
type Values = Pick<PanelBusiness, (typeof FIELDS)[number] | "accent">;

const valuesOf = (business: PanelBusiness): Values => ({
  name: business.name,
  description: business.description,
  address: business.address,
  phone: business.phone,
  whatsapp: business.whatsapp,
  accent: business.accent,
});

function BusinessForm({ business }: { business: PanelBusiness }) {
  const update = useUpdateBusiness();
  const [values, setValues] = useState(() => valuesOf(business));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = (changes: Partial<Values>) => {
    setSaved(false);
    setValues((current) => ({ ...current, ...changes }));
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSaved(false);

    if (!values.name.trim()) {
      setErrors({ name: "Escribe el nombre de tu negocio." });
      return;
    }
    setErrors({});

    update.mutate(
      {
        name: values.name.trim(),
        description: values.description.trim(),
        address: values.address.trim(),
        phone: values.phone.trim(),
        whatsapp: values.whatsapp.trim(),
        accent: values.accent,
      },
      {
        onSuccess: (updated) => {
          // The server may have tidied the phone numbers; show what it kept.
          setValues(valuesOf(updated));
          setSaved(true);
        },
        onError: (error) => {
          if (error instanceof ApiError && error.code === "invalid") {
            setErrors(error.fields);
            setFormError(Object.keys(error.fields).length ? null : error.message);
          } else {
            setFormError(error.message);
          }
        },
      },
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-6">
      <Field label="Nombre" autoComplete="off" value={values.name} error={errors.name} onChange={(event) => set({ name: event.target.value })} />
      <TextAreaField
        label="Descripción"
        hint="Aparece en tu página, bajo el nombre."
        value={values.description}
        error={errors.description}
        onChange={(event) => set({ description: event.target.value })}
      />
      <Field label="Dirección" autoComplete="off" value={values.address} error={errors.address} onChange={(event) => set({ address: event.target.value })} />
      <Field
        label="Teléfono"
        type="tel"
        inputMode="tel"
        autoComplete="off"
        placeholder="987 654 321"
        value={values.phone}
        error={errors.phone}
        onChange={(event) => set({ phone: event.target.value })}
      />
      <Field
        label="WhatsApp"
        type="tel"
        inputMode="tel"
        autoComplete="off"
        placeholder="987 654 321"
        hint="Tus clientes te escriben desde aquí."
        value={values.whatsapp}
        error={errors.whatsapp}
        onChange={(event) => set({ whatsapp: event.target.value })}
      />

      <section aria-labelledby="color" className="grid gap-3">
        <h2 id="color" className="font-display text-base font-bold">
          Color
        </h2>
        <AccentPicker value={values.accent} onChange={(accent) => set({ accent })} />
      </section>

      {formError && (
        <p role="alert" className="flex items-start gap-2 rounded-box border-[3px] border-danger p-4 font-semibold text-danger">
          <WarningCircle aria-hidden="true" className="mt-0.5 shrink-0" />
          {formError}
        </p>
      )}
      {saved && (
        <p role="status" className="flex items-center gap-2 rounded-box border-[3px] border-line bg-surface p-4 font-semibold">
          <Check aria-hidden="true" />
          Cambios guardados
        </p>
      )}

      <Button type="submit" disabled={update.isPending}>
        {update.isPending ? "Guardando" : "Guardar cambios"}
      </Button>
    </form>
  );
}

export function BusinessSettingsPage() {
  const business = usePanelBusiness();

  return (
    <div className="grid max-w-[34rem] gap-6">
      <Link to="/panel/ajustes" className="inline-flex w-fit items-center gap-2 font-display font-bold underline decoration-[3px] underline-offset-4">
        <ArrowLeft aria-hidden="true" />
        Ajustes
      </Link>
      <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.9] tracking-[-0.03em]">Mi página</h1>

      {business.isPending && (
        <div className="grid gap-4" aria-busy="true" aria-label="Cargando">
          <Skeleton className="h-[80px]" />
          <Skeleton className="h-[120px]" />
          <Skeleton className="h-[80px]" />
        </div>
      )}
      {business.isError && (
        <p role="alert" className="font-semibold text-danger">
          No pudimos cargar tu negocio. {business.error.message}
        </p>
      )}
      {business.isSuccess && <BusinessForm business={business.data} />}
    </div>
  );
}
