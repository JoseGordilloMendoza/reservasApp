import { FacebookLogo, Globe, InstagramLogo, ListChecks, NavigationArrow, TiktokLogo } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

import { featuresOf } from "../lib/features";
import { directionsLink, networksOf, rulesOf } from "../lib/places";
import type { Network } from "../lib/places";
import type { PublicBusiness } from "../lib/types";
import { buttonClass } from "./Button";

const NETWORK_ICON: Record<Network["key"], Icon> = {
  instagram: InstagramLogo,
  facebook: FacebookLogo,
  tiktok: TiktokLogo,
  website: Globe,
};

const CHIP =
  "inline-flex min-h-[44px] items-center gap-2 rounded-box border border-edge bg-paper px-3 py-2 text-sm font-semibold text-text";

/** A new tab is announced, so nobody is surprised to find the page behind them. */
const NEW_TAB = <span className="sr-only"> (se abre en otra pestaña)</span>;

/** What the business says about its place: what it has, how to get there, its rules and where to follow it. */
export function PlaceDetails({ business }: { business: PublicBusiness }) {
  const features = featuresOf(business.features);
  const rules = rulesOf(business.house_rules);
  const networks = networksOf(business);
  const directions = directionsLink(business);

  if (!features.length && !rules.length && !networks.length && !directions) return null;

  return (
    <section aria-labelledby="about-place" className="grid gap-6 rounded-box border border-edge bg-surface p-5 shadow-card-sm md:p-6">
      <h2 id="about-place" className="font-display text-2xl font-bold leading-tight">
        Sobre este lugar
      </h2>

      {features.length > 0 && (
        <ul aria-label="Qué tiene" className="flex flex-wrap gap-2">
          {features.map(({ key, label, Icon }) => (
            <li key={key} className={CHIP}>
              <Icon aria-hidden="true" size={20} />
              {label}
            </li>
          ))}
        </ul>
      )}

      {directions && (
        <a href={directions} target="_blank" rel="noreferrer" className={buttonClass("plain", "w-fit")}>
          <NavigationArrow aria-hidden="true" weight="fill" />
          Cómo llegar
          {NEW_TAB}
        </a>
      )}

      {rules.length > 0 && (
        <div className="grid gap-3">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold">
            <ListChecks aria-hidden="true" size={22} />
            Reglas de la casa
          </h3>
          <ul className="grid list-disc gap-1.5 pl-6 marker:text-accent-deep">
            {rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
      )}

      {networks.length > 0 && (
        <div className="grid gap-3">
          <h3 className="font-display text-lg font-bold">Síguenos</h3>
          <ul className="flex flex-wrap gap-2">
            {networks.map(({ key, label, url }) => {
              const NetworkIcon = NETWORK_ICON[key];
              return (
                <li key={key}>
                  <a href={url} target="_blank" rel="noreferrer" className={`${CHIP} press shadow-card-sm`}>
                    <NetworkIcon aria-hidden="true" size={20} />
                    {label}
                    {NEW_TAB}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
