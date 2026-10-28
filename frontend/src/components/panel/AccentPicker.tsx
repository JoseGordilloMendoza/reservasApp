import { Check } from "@phosphor-icons/react";

import type { Accent } from "../../lib/types";

const ACCENTS: { id: Accent; label: string }[] = [
  { id: "lime", label: "Lima" },
  { id: "tangerine", label: "Mandarina" },
  { id: "cobalt", label: "Cobalto" },
  { id: "rose", label: "Rosa" },
  { id: "mint", label: "Menta" },
];

interface Props {
  value: Accent;
  onChange: (accent: Accent) => void;
}

/**
 * The five colors a business can wear. Each swatch carries its own data-accent, so it paints
 * itself with that color whatever the page is using.
 */
export function AccentPicker({ value, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label="Color de tu página" className="grid grid-cols-5 gap-3">
      {ACCENTS.map(({ id, label }) => {
        const active = id === value;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            data-accent={id}
            onClick={() => onChange(id)}
            className={
              "press grid aspect-square min-h-[52px] place-items-center rounded-box border-[3px] border-line bg-accent text-on-accent " +
              (active ? "shadow-hard" : "shadow-hard-sm")
            }
          >
            {active && <Check aria-hidden="true" weight="bold" size={26} />}
          </button>
        );
      })}
    </div>
  );
}
