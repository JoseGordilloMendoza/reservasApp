import { CalendarX, Gear, Users } from "@phosphor-icons/react";

import { MenuList } from "../../components/panel/MenuList";
import type { MenuEntry } from "../../components/panel/MenuList";

const SECTIONS: MenuEntry[] = [
  { to: "/panel/clientes", label: "Clientes", hint: "Quién reserva, su historial y bloqueos", icon: Users },
  { to: "/panel/bloqueos", label: "Bloqueos", hint: "Cierra un día o un horario", icon: CalendarX },
  { to: "/panel/ajustes", label: "Ajustes", hint: "Tu página, reglas, servicios y horarios", icon: Gear },
];

/** The sections that do not fit in the phone's tab bar. */
export function MorePage() {
  return (
    <div className="grid gap-6">
      <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.9] tracking-[-0.03em]">Más</h1>
      <MenuList entries={SECTIONS} />
    </div>
  );
}
