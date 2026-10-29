import type { BusinessKind } from "./platformTypes";

/** What each business type is called on screen. */
export const KIND_LABEL: Record<BusinessKind, string> = {
  court: "Cancha deportiva",
  psychologist: "Psicólogo",
  generic: "General",
};

export const KINDS = Object.keys(KIND_LABEL) as BusinessKind[];
