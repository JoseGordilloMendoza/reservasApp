import { Heart } from "@phosphor-icons/react";
import { useState } from "react";

import { addFavorite, removeFavorite, useFavorites } from "../lib/favorites";
import type { PublicBusiness } from "../lib/types";

interface Props {
  business: PublicBusiness;
  /** Same shape as the other chips of the page, so it sits among them. */
  className: string;
}

/** Saves the business on this device. The words change with the state; they do not rely on a color or a fill. */
export function FavoriteButton({ business, className }: Props) {
  const saved = useFavorites().some((item) => item.slug === business.slug);
  // Said aloud only after a tap, never when the page opens.
  const [said, setSaid] = useState("");

  function toggle() {
    if (saved) {
      removeFavorite(business.slug);
      setSaid("Quitado de tus favoritos.");
    } else {
      addFavorite({
        slug: business.slug,
        name: business.name,
        accent: business.accent,
        kind: business.business_type,
        address: business.address,
        logo: business.logo_url,
      });
      setSaid("Guardado en tus favoritos.");
    }
  }

  return (
    <>
      <button type="button" onClick={toggle} className={`${className} press shadow-card-sm`}>
        <Heart aria-hidden="true" weight={saved ? "fill" : "regular"} />
        {saved ? "En tus favoritos" : "Guardar en favoritos"}
      </button>
      <span aria-live="polite" className="sr-only">
        {said}
      </span>
    </>
  );
}
