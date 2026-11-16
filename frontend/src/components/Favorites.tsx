import { X } from "@phosphor-icons/react";
import { Link } from "react-router-dom";

import { removeFavorite, useFavorites } from "../lib/favorites";
import { KIND_LABEL } from "../lib/kinds";
import type { BusinessKind } from "../lib/platformTypes";
import { Picture } from "./Picture";

/** The businesses this person saved, kept on their device. It is not on the page until they save one. */
export function Favorites() {
  const favorites = useFavorites();
  if (favorites.length === 0) return null;

  return (
    <section aria-labelledby="favorites-title" className="mt-14">
      <h2 id="favorites-title" className="font-display text-3xl font-bold leading-tight tracking-[-0.02em] md:text-4xl">
        Tus favoritos
      </h2>
      <p className="mt-2 text-muted">Los guardaste en este celular. Solo tú los ves.</p>

      <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {favorites.map((favorite) => (
          <li key={favorite.slug} className="relative">
            <Link
              to={`/${favorite.slug}`}
              className="press flex min-h-[88px] items-center gap-4 rounded-box border border-edge bg-surface p-4 pr-16 text-text shadow-card-sm"
            >
              <Picture
                src={favorite.logo}
                className="size-12 shrink-0 rounded-xl border border-edge bg-surface object-contain p-1"
                fallback={
                  <span
                    aria-hidden="true"
                    data-accent={favorite.accent}
                    className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent font-display text-xl font-bold text-on-accent"
                  >
                    {favorite.name.trim().charAt(0).toUpperCase()}
                  </span>
                }
              />
              <span className="grid min-w-0 gap-0.5">
                <span className="text-xs font-bold uppercase tracking-wide text-accent-deep">
                  {KIND_LABEL[favorite.kind as BusinessKind] ?? "Negocio"}
                </span>
                <span className="break-words font-display text-lg font-bold leading-tight">{favorite.name}</span>
                {favorite.address && <span className="truncate text-sm text-muted">{favorite.address}</span>}
              </span>
            </Link>
            <button
              type="button"
              onClick={() => removeFavorite(favorite.slug)}
              aria-label={`Quitar ${favorite.name} de tus favoritos`}
              className="press absolute right-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-xl text-muted"
            >
              <X aria-hidden="true" weight="bold" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
