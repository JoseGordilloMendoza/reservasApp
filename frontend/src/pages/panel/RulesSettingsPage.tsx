import { ArrowLeft, Check, WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import { Skeleton } from "../../components/Skeleton";
import { ApiError } from "../../lib/http";
import type { PanelBusiness } from "../../lib/panelTypes";
import { usePanelBusiness, useUpdateBusiness } from "../../lib/panelQueries";
import { RULES, describeValue, ruleError } from "../../lib/rules";

type Mode = "manual" | "automatic";

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "manual", label: "Yo confirmo cada reserva", hint: "Llega como pendiente y tú decides." },
  { id: "automatic", label: "Se confirman solas", hint: "Quedan listas al instante, sin que hagas nada." },
];

const textOf = (business: PanelBusiness) =>
  Object.fromEntries(RULES.map((rule) => [rule.key, String(business.settings[rule.key] ?? "")]));

function RulesForm({ business }: { business: PanelBusiness }) {
  const update = useUpdateBusiness();
  const [mode, setMode] = useState<Mode>(business.settings.confirmation_mode === "automatic" ? "automatic" : "manual");
  const [texts, setTexts] = useState(() => textOf(business));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // The hold only matters when the owner confirms by hand, so it is not asked otherwise.
  const shown = RULES.filter((rule) => !rule.manualOnly || mode === "manual");

  function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSaved(false);

    const found: Record<string, string> = {};
    for (const rule of shown) {
      const problem = ruleError(rule, texts[rule.key] ?? "");
      if (problem) found[rule.key] = problem;
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    // Only what changed is sent; the server keeps the other options as they are.
    const changes: Record<string, number | string> = {};
    if (mode !== business.settings.confirmation_mode) changes.confirmation_mode = mode;
    for (const rule of shown) {
      const value = Number(texts[rule.key]);
      if (value !== business.settings[rule.key]) changes[rule.key] = value;
    }

    if (Object.keys(changes).length === 0) {
      setSaved(true);
      return;
    }

    update.mutate(
      { settings: changes },
      {
        onSuccess: () => setSaved(true),
        onError: (error) => {
          const detail = error instanceof ApiError ? Object.values(error.fields)[0] : undefined;
          setFormError(detail ?? error.message);
        },
      },
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-6">
      <section aria-labelledby="confirmacion" className="grid gap-3">
        <h2 id="confirmacion" className="font-display text-xl font-extrabold">
          ¿Cómo se confirman las reservas?
        </h2>
        <div role="radiogroup" aria-labelledby="confirmacion" className="grid gap-3">
          {MODES.map(({ id, label, hint }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={mode === id}
              onClick={() => {
                setSaved(false);
                setMode(id);
              }}
              className={
                "press grid min-h-[60px] gap-1 rounded-box border-[3px] border-line px-4 py-3 text-left " +
                (mode === id ? "bg-accent text-on-accent shadow-hard" : "bg-surface text-text shadow-hard-sm")
              }
            >
              <span className="font-display text-lg font-extrabold leading-tight">{label}</span>
              <span className="text-sm">{hint}</span>
            </button>
          ))}
        </div>
      </section>

      {shown.map((rule) => {
        const echo = describeValue(rule, texts[rule.key] ?? "");
        return (
          <Field
            key={rule.key}
            label={rule.label}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={texts[rule.key] ?? ""}
            error={errors[rule.key]}
            hint={echo ? `${echo}. ${rule.hint}` : rule.hint}
            onChange={(event) => {
              setSaved(false);
              setTexts((current) => ({ ...current, [rule.key]: event.target.value }));
            }}
          />
        );
      })}

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

export function RulesSettingsPage() {
  const business = usePanelBusiness();

  return (
    <div className="grid max-w-[34rem] grid-cols-1 gap-6">
      <Link to="/panel/ajustes" className="inline-flex w-fit items-center gap-2 font-display font-bold underline decoration-[3px] underline-offset-4">
        <ArrowLeft aria-hidden="true" />
        Ajustes
      </Link>
      <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.9] tracking-[-0.03em]">Reglas de reserva</h1>
      <p className="text-muted">Valen para todo tu negocio. Los cambios no afectan a las reservas que ya existen.</p>

      {business.isPending && (
        <div className="grid gap-4" aria-busy="true" aria-label="Cargando">
          <Skeleton className="h-[140px]" />
          <Skeleton className="h-[80px]" />
          <Skeleton className="h-[80px]" />
        </div>
      )}
      {business.isError && (
        <p role="alert" className="font-semibold text-danger">
          No pudimos cargar tu negocio. {business.error.message}
        </p>
      )}
      {business.isSuccess && <RulesForm business={business.data} />}
    </div>
  );
}
