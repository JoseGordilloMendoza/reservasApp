import { Check } from "@phosphor-icons/react";

import { formatDuration, formatPrice } from "../lib/format";
import type { PublicResource, PublicService } from "../lib/types";

export interface BookableOption {
  resource: PublicResource;
  service: PublicService;
}

export const optionId = (option: BookableOption) => `${option.resource.id}:${option.service.id}`;

export function bookableOptions(resources: PublicResource[]): BookableOption[] {
  return resources.flatMap((resource) => resource.services.map((service) => ({ resource, service })));
}

interface Props {
  options: BookableOption[];
  selected: string;
  onSelect: (id: string) => void;
}

/** Each option is a ticket stub. With several resources the resource name leads. */
export function ServicePicker({ options, selected, onSelect }: Props) {
  const severalResources = new Set(options.map((option) => option.resource.id)).size > 1;

  return (
    <div role="radiogroup" aria-label="Qué quieres reservar" className="grid gap-3">
      {options.map((option) => {
        const id = optionId(option);
        const active = id === selected;
        const price = formatPrice(option.service.reference_price);

        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(id)}
            className={
              "press flex min-h-[64px] items-center justify-between gap-3 rounded-box border-[3px] border-line px-4 py-3 text-left " +
              (active ? "bg-accent text-on-accent shadow-hard" : "bg-surface text-text shadow-hard-sm")
            }
          >
            <span className="flex flex-col">
              <span className="font-display text-xl font-extrabold leading-tight">
                {severalResources ? option.resource.name : option.service.name}
              </span>
              <span className={`text-sm ${active ? "" : "text-muted"}`}>
                {severalResources ? `${option.service.name} · ` : ""}
                {formatDuration(option.service.duration_minutes)}
              </span>
            </span>
            <span className="flex items-center gap-2 font-mono text-lg font-bold">
              {price}
              {active && <Check aria-hidden="true" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
