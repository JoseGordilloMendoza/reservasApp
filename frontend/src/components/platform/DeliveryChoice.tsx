import type { Delivery } from "../../lib/platformTypes";

const OPTIONS: { id: Delivery; label: string; hint: string }[] = [
  { id: "email", label: "Por correo", hint: "Le llega un enlace para elegir su contraseña." },
  { id: "credentials", label: "Con contraseña temporal", hint: "Te la mostramos una vez para que se la envíes tú, por ejemplo por WhatsApp." },
];

interface Props {
  value: Delivery;
  onChange: (value: Delivery) => void;
}

/** How a person who has no account yet receives their access. Someone who already has one keeps their password. */
export function DeliveryChoice({ value, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label="Cómo recibe su acceso" className="grid gap-3">
      <p className="font-display text-base font-bold">Cómo recibe su acceso</p>
      {OPTIONS.map(({ id, label, hint }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          onClick={() => onChange(id)}
          className={
            "press grid min-h-[52px] gap-1 rounded-box border-[3px] border-line px-4 py-3 text-left " +
            (value === id ? "bg-accent text-on-accent shadow-hard" : "bg-surface text-text shadow-hard-sm")
          }
        >
          <span className="font-display text-lg font-bold">{label}</span>
          <span className="text-sm font-medium">{hint}</span>
        </button>
      ))}
    </div>
  );
}
