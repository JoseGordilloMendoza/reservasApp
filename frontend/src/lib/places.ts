/** Where to send someone who wants to get to the place: the owner's map link, or a search of the address. */
export function directionsLink(business: { address: string; maps_url: string }): string | null {
  if (business.maps_url) return business.maps_url;
  const address = business.address.trim();
  if (!address) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/** The house rules as a list: one per line, empty lines dropped. */
export function rulesOf(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export interface Network {
  key: "instagram" | "facebook" | "tiktok" | "website";
  label: string;
  url: string;
}

/** The links the business filled in, in a fixed order. */
export function networksOf(business: { instagram: string; facebook: string; tiktok: string; website: string }): Network[] {
  const all: Network[] = [
    { key: "instagram", label: "Instagram", url: business.instagram },
    { key: "facebook", label: "Facebook", url: business.facebook },
    { key: "tiktok", label: "TikTok", url: business.tiktok },
    { key: "website", label: "Página web", url: business.website },
  ];
  return all.filter((network) => network.url);
}
