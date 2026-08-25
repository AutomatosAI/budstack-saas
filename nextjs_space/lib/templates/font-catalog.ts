/**
 * Font id → display/CSS family name for the Store Editor's font catalogue.
 * Mirrors the FONTS list in app/tenant-admin/branding/tabs/shared.tsx (the
 * picker UI) — kept in lib so server code (e.g. the branding save route
 * syncing tenant_branding.fontFamily for emails/OG/login) can resolve names
 * without importing client components.
 */

export const FONT_ID_TO_NAME: Record<string, string> = {
  // Sans-serif
  inter: "Inter",
  roboto: "Roboto",
  lato: "Lato",
  montserrat: "Montserrat",
  poppins: "Poppins",
  outfit: "Outfit",
  nunito: "Nunito",
  "open-sans": "Open Sans",
  raleway: "Raleway",
  "work-sans": "Work Sans",
  "dm-sans": "DM Sans",
  "source-sans-3": "Source Sans 3",
  manrope: "Manrope",
  "space-grotesk": "Space Grotesk",
  "plus-jakarta-sans": "Plus Jakarta Sans",
  sora: "Sora",
  urbanist: "Urbanist",
  figtree: "Figtree",
  // Serif
  playfair: "Playfair Display",
  merriweather: "Merriweather",
  lora: "Lora",
  "dm-serif-display": "DM Serif Display",
  "cormorant-garamond": "Cormorant Garamond",
  "libre-baskerville": "Libre Baskerville",
  "eb-garamond": "EB Garamond",
  "crimson-text": "Crimson Text",
  bitter: "Bitter",
  // Display / Decorative
  oswald: "Oswald",
  "bebas-neue": "Bebas Neue",
  antonio: "Antonio",
  righteous: "Righteous",
};

/** Resolve a picker font id to its family name; returns undefined for
 *  unknown/empty input so callers can skip the write rather than store junk. */
export function fontIdToName(id: unknown): string | undefined {
  if (typeof id !== "string" || !id.trim()) return undefined;
  return FONT_ID_TO_NAME[id.trim()];
}
