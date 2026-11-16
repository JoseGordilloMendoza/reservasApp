import { Check, ImageSquare, WarningCircle } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import type { ChangeEvent } from "react";

import { ApiError } from "../../lib/http";
import type { ImageKind, PanelBusiness } from "../../lib/panelTypes";
import { useRemoveImage, useUploadImage } from "../../lib/panelQueries";
import { Button } from "../Button";
import { Picture } from "../Picture";

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp";

const TEXT: Record<ImageKind, { title: string; empty: string; hint: string; added: string; removed: string }> = {
  logo: {
    title: "Logo",
    empty: "Sin logo",
    hint: "Se ve en el inicio, en los favoritos y junto al nombre de tu página. Funciona mejor si es cuadrado.",
    added: "Logo guardado",
    removed: "Logo quitado",
  },
  cover: {
    title: "Portada",
    empty: "Sin portada",
    hint: "Una foto de tu local, en horizontal. Va arriba de tu página. Los bordes pueden recortarse.",
    added: "Portada guardada",
    removed: "Portada quitada",
  },
};

/** Why a file cannot be sent, found before sending anything; null when it looks fine. */
function problemWith(file: File): string | null {
  if (!ACCEPT.split(",").includes(file.type)) return "Usa una imagen JPG, PNG o WebP.";
  if (file.size > MAX_BYTES) return "La imagen pesa más de 8 MB. Prueba con una más liviana.";
  return null;
}

function ImageSlot({ kind, url }: { kind: ImageKind; url: string | null }) {
  const text = TEXT[kind];
  const upload = useUploadImage();
  const remove = useRemoveImage();
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const busy = upload.isPending || remove.isPending;
  const headingId = `image-${kind}`;

  const fail = (error: unknown) =>
    setMessage({ tone: "error", text: error instanceof ApiError ? error.message : "No pudimos guardar la imagen. Inténtalo otra vez." });

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // choosing the same file again must still count as a choice
    if (!file) return;

    const problem = problemWith(file);
    if (problem) {
      setMessage({ tone: "error", text: problem });
      return;
    }
    setMessage(null);
    upload.mutate({ kind, file }, { onSuccess: () => setMessage({ tone: "ok", text: text.added }), onError: fail });
  }

  function discard() {
    setMessage(null);
    remove.mutate(kind, { onSuccess: () => setMessage({ tone: "ok", text: text.removed }), onError: fail });
  }

  return (
    <div role="group" aria-labelledby={headingId} className="grid gap-3 rounded-box border border-edge bg-surface p-4">
      <h3 id={headingId} className="font-display text-base font-bold">
        {text.title}
      </h3>

      <div
        className={`grid place-items-center overflow-hidden rounded-xl border border-dashed border-edge-strong bg-paper ${
          kind === "logo" ? "size-28" : "aspect-[5/2] w-full"
        }`}
      >
        <Picture
          src={url}
          alt={url ? `${text.title} actual` : ""}
          className={`size-full ${kind === "logo" ? "object-contain p-2" : "object-cover"}`}
          fallback={
            <span className="grid justify-items-center gap-1 p-2 text-center text-sm text-muted">
              <ImageSquare aria-hidden="true" size={28} />
              {text.empty}
            </span>
          }
        />
      </div>

      <p className="text-sm text-muted">{text.hint}</p>

      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        hidden
        aria-label={`Archivo para ${text.title.toLowerCase()}`}
        onChange={choose}
      />
      <div className="flex flex-wrap gap-3">
        <Button variant="plain" disabled={busy} onClick={() => input.current?.click()}>
          {upload.isPending ? "Subiendo" : url ? `Cambiar ${text.title.toLowerCase()}` : `Subir ${text.title.toLowerCase()}`}
        </Button>
        {url && (
          <Button variant="plain" disabled={busy} onClick={discard}>
            {remove.isPending ? "Quitando" : "Quitar"}
          </Button>
        )}
      </div>

      <div aria-live="polite">
        {message?.tone === "ok" && (
          <p className="flex items-center gap-2 font-semibold">
            <Check aria-hidden="true" />
            {message.text}
          </p>
        )}
      </div>
      {message?.tone === "error" && (
        <p role="alert" className="flex items-start gap-2 font-semibold text-danger">
          <WarningCircle aria-hidden="true" className="mt-0.5 shrink-0" />
          {message.text}
        </p>
      )}
    </div>
  );
}

/** The logo and the cover of the business page. Each one saves by itself, with no need for the form's button. */
export function BusinessImages({ business }: { business: PanelBusiness }) {
  return (
    <section aria-labelledby="imagenes" className="grid gap-3">
      <h2 id="imagenes" className="font-display text-base font-bold">
        Imágenes
      </h2>
      <p className="text-sm text-muted">JPG, PNG o WebP de hasta 8 MB. Las achicamos y les quitamos los datos de la cámara, como el lugar donde se tomó la foto.</p>
      <ImageSlot kind="logo" url={business.logo_url} />
      <ImageSlot kind="cover" url={business.cover_url} />
    </section>
  );
}
