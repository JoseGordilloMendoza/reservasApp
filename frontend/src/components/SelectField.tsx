import { useId } from "react";
import type { SelectHTMLAttributes } from "react";

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
}

/** The select that matches <Field>: label above, help and error below. */
export function SelectField({ label, error, hint, className = "", children, ...select }: SelectFieldProps) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-display text-base font-bold">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={
          "min-h-[52px] w-full rounded-box border-[3px] bg-surface px-4 text-lg text-text focus:shadow-hard focus:outline-none " +
          (error ? "border-danger" : "border-line") +
          ` ${className}`
        }
        {...select}
      >
        {children}
      </select>
      {hint && !error && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
