import { useId } from "react";
import type { TextareaHTMLAttributes } from "react";

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
}

/** The multi-line sibling of <Field>. */
export function TextAreaField({ label, error, hint, className = "", ...area }: TextAreaFieldProps) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-display text-base font-bold">
        {label}
      </label>
      <textarea
        id={id}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={
          "w-full rounded-box border-[3px] bg-surface px-4 py-3 text-lg text-text " +
          "placeholder:text-muted/70 focus:shadow-hard focus:outline-none " +
          (error ? "border-danger" : "border-line") +
          ` ${className}`
        }
        {...area}
      />
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
