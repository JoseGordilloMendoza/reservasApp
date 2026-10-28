import { Check, Copy, Palette, SlidersHorizontal, SquaresFour, Tag } from "@phosphor-icons/react";
import { useState } from "react";

import { Button } from "../../components/Button";
import { MenuList } from "../../components/panel/MenuList";
import type { MenuEntry } from "../../components/panel/MenuList";
import { usePanelBusiness } from "../../lib/panelQueries";

const SECTIONS: MenuEntry[] = [
  { to: "/panel/ajustes/negocio", label: "Mi página", hint: "Nombre, contacto y color", icon: Palette },
  { to: "/panel/ajustes/reglas", label: "Reglas de reserva", hint: "Confirmación, anticipación y cancelación", icon: SlidersHorizontal },
  { to: "/panel/ajustes/espacios", label: "Espacios y horarios", hint: "Tus canchas o consultorios y cuándo atienden", icon: SquaresFour },
  { to: "/panel/ajustes/servicios", label: "Servicios", hint: "Qué reservan tus clientes, cuánto dura y cuánto cuesta", icon: Tag },
];

/** The link customers use to book. Copying it is the first thing a new business does. */
function PublicLink({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/${slug}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Clipboard access can be refused; the link stays visible to copy by hand.
    }
  }

  return (
    <section aria-labelledby="enlace" className="grid gap-3 rounded-box border-[3px] border-line bg-surface p-4 text-text shadow-hard">
      <h2 id="enlace" className="font-display text-xl font-extrabold">
        Tu enlace para reservar
      </h2>
      <p className="text-muted">Compártelo en WhatsApp o Instagram. Tus clientes reservan desde ahí.</p>
      <input
        readOnly
        value={link}
        aria-label="Enlace de tu página"
        onFocus={(event) => event.currentTarget.select()}
        className="min-h-[52px] w-full rounded-box border-[3px] border-line bg-paper px-4 font-mono text-sm text-text"
      />
      <Button variant="plain" onClick={() => void copy()}>
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copied ? "Copiado" : "Copiar enlace"}
      </Button>
    </section>
  );
}

export function SettingsPage() {
  const business = usePanelBusiness();

  return (
    <div className="grid max-w-[34rem] gap-6">
      <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.9] tracking-[-0.03em]">Ajustes</h1>
      {business.data && <PublicLink slug={business.data.slug} />}
      <MenuList entries={SECTIONS} />
    </div>
  );
}
