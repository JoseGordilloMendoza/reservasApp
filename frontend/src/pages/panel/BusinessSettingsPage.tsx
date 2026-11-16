import { ArrowLeft, Check, WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import { Button } from "../../components/Button";
import { CheckField, Field } from "../../components/Field";
import { AccentPicker } from "../../components/panel/AccentPicker";
import { BusinessImages } from "../../components/panel/BusinessImages";
import { Skeleton } from "../../components/Skeleton";
import { TextAreaField } from "../../components/TextAreaField";
import { FEATURES } from "../../lib/features";
import { ApiError } from "../../lib/http";
import type { PanelBusiness } from "../../lib/panelTypes";
import { usePanelBusiness, useUpdateBusiness } from "../../lib/panelQueries";

const FIELDS = ["name", "description", "address", "phone", "whatsapp"] as const;
const DETAILS = ["features", "instagram", "facebook", "tiktok", "website", "maps_url", "house_rules"] as const;
type Values = Pick<PanelBusiness, (typeof FIELDS)[number] | (typeof DETAILS)[number] | "accent" | "listed" | "payment_instructions">;

const valuesOf = (business: PanelBusiness): Values => ({
  name: business.name,
  description: business.description,
  address: business.address,
  phone: business.phone,
  whatsapp: business.whatsapp,
  accent: business.accent,
  listed: business.listed,
  payment_instructions: business.payment_instructions,
  features: business.features,
  instagram: business.instagram,
  facebook: business.facebook,
  tiktok: business.tiktok,
  website: business.website,
  maps_url: business.maps_url,
  house_rules: business.house_rules,
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
        listed: values.listed,
        payment_instructions: values.payment_instructions.trim(),
        features: values.features,
        instagram: values.instagram.trim(),
        facebook: values.facebook.trim(),
        tiktok: values.tiktok.trim(),
        website: values.website.trim(),
        maps_url: values.maps_url.trim(),
        house_rules: values.house_rules.trim(),
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
        hint="Es tu mensaje de bienvenida: aparece en tu página, bajo el nombre. Cuenta en pocas palabras qué ofreces."
        value={values.description}
        error={errors.description}
        onChange={(event) => set({ description: event.target.value })}
      />
      <Field label="Dirección" autoComplete="off" value={values.address} error={errors.address} onChange={(event) => set({ address: event.target.value })} />
      <Field
        label="Link de Google Maps"
        type="url"
        inputMode="url"
        autoComplete="off"
        placeholder="https://maps.app.goo.gl/..."
        hint="Opcional. En Google Maps busca tu local, toca Compartir y copia el link. Así tus clientes llegan con un toque. Si lo dejas vacío, buscamos tu dirección."
        value={values.maps_url}
        error={errors.maps_url}
        onChange={(event) => set({ maps_url: event.target.value })}
      />
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

      <TextAreaField
        label="Cómo te pagan"
        placeholder="Yape o Plin al 987 654 321, a nombre de Rosa Quispe"
        hint="Sale en el correo y en el boleto de tu cliente. La plataforma no cobra: el pago es entre ustedes."
        maxLength={300}
        value={values.payment_instructions}
        onChange={(event) => set({ payment_instructions: event.target.value })}
      />

      <fieldset className="grid gap-3">
        <legend className="font-display text-base font-bold">Qué tiene tu lugar</legend>
        <p className="text-sm text-muted">Marca lo que tienes. Tus clientes lo ven en tu página.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map(({ key, label }) => (
            <CheckField
              key={key}
              label={label}
              checked={values.features.includes(key)}
              onChange={(event) =>
                set({ features: event.target.checked ? [...values.features, key] : values.features.filter((item) => item !== key) })
              }
            />
          ))}
        </div>
        {errors.features && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {errors.features}
          </p>
        )}
      </fieldset>

      <section aria-labelledby="redes" className="grid gap-6">
        <div className="grid gap-1">
          <h2 id="redes" className="font-display text-base font-bold">
            Tus redes
          </h2>
          <p className="text-sm text-muted">Todo es opcional. Puedes escribir tu usuario o pegar el link.</p>
        </div>
        <Field
          label="Instagram"
          autoComplete="off"
          autoCapitalize="none"
          placeholder="@minegocio"
          value={values.instagram}
          error={errors.instagram}
          onChange={(event) => set({ instagram: event.target.value })}
        />
        <Field
          label="Facebook"
          autoComplete="off"
          autoCapitalize="none"
          placeholder="facebook.com/minegocio"
          value={values.facebook}
          error={errors.facebook}
          onChange={(event) => set({ facebook: event.target.value })}
        />
        <Field
          label="TikTok"
          autoComplete="off"
          autoCapitalize="none"
          placeholder="@minegocio"
          value={values.tiktok}
          error={errors.tiktok}
          onChange={(event) => set({ tiktok: event.target.value })}
        />
        <Field
          label="Página web"
          autoComplete="off"
          autoCapitalize="none"
          placeholder="minegocio.pe"
          value={values.website}
          error={errors.website}
          onChange={(event) => set({ website: event.target.value })}
        />
      </section>

      <TextAreaField
        label="Reglas de la casa"
        placeholder={"Llegar 10 minutos antes\nTraer tus zapatillas\nNo se permite fumar"}
        hint="Una regla por línea, hasta 8. Tus clientes las ven en tu página y en su reserva."
        maxLength={600}
        value={values.house_rules}
        error={errors.house_rules}
        onChange={(event) => set({ house_rules: event.target.value })}
      />

      <section aria-labelledby="color" className="grid gap-3">
        <h2 id="color" className="font-display text-base font-bold">
          Color
        </h2>
        <AccentPicker value={values.accent} onChange={(accent) => set({ accent })} />
      </section>

      <section aria-labelledby="buscador" className="grid gap-3">
        <h2 id="buscador" className="font-display text-base font-bold">
          Buscador
        </h2>
        <CheckField
          label="Aparecer en el buscador de la página de inicio"
          checked={values.listed}
          onChange={(event) => set({ listed: event.target.checked })}
        />
        <p className="text-sm text-muted">
          Tu negocio sale en la lista de la página de inicio y quien llegue sin tu link podrá encontrarte por tu nombre. Si lo quitas, solo entran tus clientes que tengan tu link.
        </p>
      </section>

      {formError && (
        <p role="alert" className="flex items-start gap-2 rounded-box border border-danger p-4 font-semibold text-danger">
          <WarningCircle aria-hidden="true" className="mt-0.5 shrink-0" />
          {formError}
        </p>
      )}
      {saved && (
        <p role="status" className="flex items-center gap-2 rounded-box border border-edge bg-surface p-4 font-semibold">
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
    <div className="grid max-w-[34rem] grid-cols-1 gap-6">
      <Link to="/panel/ajustes" className="inline-flex w-fit items-center gap-2 font-display font-bold underline decoration-[3px] underline-offset-4">
        <ArrowLeft aria-hidden="true" />
        Ajustes
      </Link>
      <h1 className="font-display text-3xl font-bold leading-[1.15] tracking-[-0.02em] sm:text-4xl">Mi página</h1>

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
      {business.isSuccess && <BusinessImages business={business.data} />}
      {business.isSuccess && <BusinessForm business={business.data} />}
    </div>
  );
}
