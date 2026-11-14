import {
  Armchair,
  Baby,
  Car,
  Coffee,
  DoorOpen,
  House,
  Lightbulb,
  LockSimple,
  PawPrint,
  Snowflake,
  Toilet,
  TShirt,
  Wheelchair,
  WifiHigh,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

export type FeatureKey =
  | "parking"
  | "lighting"
  | "covered"
  | "changing_rooms"
  | "restrooms"
  | "lockers"
  | "wifi"
  | "air_conditioning"
  | "step_free"
  | "snacks"
  | "pet_friendly"
  | "kids"
  | "private"
  | "waiting_room";

interface Feature {
  key: FeatureKey;
  label: string;
  Icon: Icon;
}

/** What a business can say about its place, in the order the owner sees them. Same keys as the server's list. */
export const FEATURES: Feature[] = [
  { key: "parking", label: "Estacionamiento", Icon: Car },
  { key: "lighting", label: "Luz para la noche", Icon: Lightbulb },
  { key: "covered", label: "Techado", Icon: House },
  { key: "changing_rooms", label: "Vestidores", Icon: TShirt },
  { key: "restrooms", label: "Baños", Icon: Toilet },
  { key: "lockers", label: "Casilleros", Icon: LockSimple },
  { key: "wifi", label: "Wifi", Icon: WifiHigh },
  { key: "air_conditioning", label: "Aire acondicionado", Icon: Snowflake },
  { key: "step_free", label: "Entrada sin escalones", Icon: Wheelchair },
  { key: "snacks", label: "Cafetería o snacks", Icon: Coffee },
  { key: "pet_friendly", label: "Aceptan mascotas", Icon: PawPrint },
  { key: "kids", label: "Apto para niños", Icon: Baby },
  { key: "private", label: "Ambiente privado", Icon: DoorOpen },
  { key: "waiting_room", label: "Sala de espera", Icon: Armchair },
];

const BY_KEY = new Map(FEATURES.map((feature) => [feature.key, feature]));

/** The features to show, in the order the business picked them; unknown keys are skipped. */
export function featuresOf(keys: readonly string[]): Feature[] {
  return keys.flatMap((key) => BY_KEY.get(key as FeatureKey) ?? []);
}
