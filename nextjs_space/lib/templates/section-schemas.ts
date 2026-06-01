/**
 * Section Schema System
 *
 * Single source of truth for what fields each section type supports.
 * Drives the Store Editor form rendering and section type migration.
 *
 * Type defs live in ./section-schema-types and the SECTION_SCHEMAS data table
 * lives in ./section-schemas-data; both are re-exported here so consumers keep
 * importing from "@/lib/templates/section-schemas".
 */

import type {
  FieldType,
  ArrayItemField,
  FieldSchema,
  SectionSchema,
} from "./section-schema-types";
export type { FieldType, ArrayItemField, FieldSchema, SectionSchema };

import { SECTION_SCHEMAS } from "./section-schemas-data";
export { SECTION_SCHEMAS };

// ─── Navigation & Footer Schemas (separate from section schemas) ──

export const NAV_STYLES: { type: string; label: string; description: string }[] = [
  { type: 'NavMinimal', label: 'Minimal', description: 'Clean, flat navigation bar' },
  { type: 'NavDark', label: 'Dark Glass', description: 'Premium floating glassmorphic bar' },
  { type: 'NavTransparent', label: 'Transparent', description: 'Fades in on scroll, hero-friendly' },
  { type: 'NavFull', label: 'Full', description: 'Standard sticky with cart & CTA' },
  { type: 'NavHealingBuds', label: 'Full Featured', description: 'KYC badge, cart & icon nav links' },
  { type: 'NavPill', label: 'Pill', description: 'Compact centered floating capsule' },
];

export const FOOTER_STYLES: { type: string; label: string; description: string }[] = [
  { type: 'FooterSimple', label: 'Simple', description: 'Minimal one-line copyright + links' },
  { type: 'FooterBrand', label: 'Brand', description: 'Premium dark with columns & contact' },
  { type: 'FooterFull', label: 'Full', description: 'Comprehensive multi-column layout' },
];

export const DEFAULT_NAV_LINKS = [
  { label: 'About Us', href: '/about' },
  { label: 'Research', href: '/conditions' },
  { label: 'The Wire', href: '/the-wire' },
  { label: 'Eligibility', href: '/consultation' },
  { label: 'Strains', href: '/products' },
  { label: 'Support', href: '/support' },
];

export const DEFAULT_FOOTER_SECTIONS = [
  {
    title: 'Company',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Products', href: '/products' },
      { label: 'The Wire', href: '/the-wire' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Patient Access', href: '/consultation' },
      { label: 'Conditions', href: '/conditions' },
      { label: 'FAQ', href: '/faq' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Regulatory', href: '/regulatory' },
    ],
  },
];

export const SOCIAL_PLATFORMS = [
  'facebook', 'instagram', 'x', 'tiktok', 'youtube', 'linkedin', 'pinterest', 'snapchat',
] as const;

export type SocialPlatform = typeof SOCIAL_PLATFORMS[number];

export interface SocialLink {
  platform: SocialPlatform;
  url: string;
}

// ─── Helper Functions ────────────────────────────────────────

/** Build a default config object for a section type from its schema */
export function getSectionDefaults(type: string): Record<string, any> {
  const schema = SECTION_SCHEMAS[type];
  if (!schema) return { heading: 'New Section', subtitle: 'Edit me' };

  const defaults: Record<string, any> = {};
  for (const field of schema.fields) {
    if (field.type !== 'array') {
      defaults[field.key] = field.default;
    }
  }
  return defaults;
}

/** Common textAlign field auto-injected for any section that has a heading but
 *  doesn't already declare its own textAlign. Keeps schemas concise while giving
 *  every header-bearing section a consistent alignment control. */
const AUTO_TEXT_ALIGN_FIELD: FieldSchema = {
  key: 'textAlign',
  label: 'Heading Alignment',
  type: 'select',
  default: 'center',
  options: ['left', 'center', 'right'],
};

/** Return editable fields for the editor form.
 *  Array fields with itemFields are included (rendered as item editors).
 *  Array fields WITHOUT itemFields are still excluded (no schema to render).
 *  textAlign is auto-injected after heading/subtitle when not already present. */
export function getEditableFields(type: string): FieldSchema[] {
  const schema = SECTION_SCHEMAS[type];
  if (!schema) return [];
  const filtered = schema.fields.filter(
    (f) => f.type !== 'array' || (f.itemFields && f.itemFields.length > 0),
  );
  const hasHeading = filtered.some((f) => f.key === 'heading');
  const hasTextAlign = filtered.some((f) => f.key === 'textAlign');
  if (!hasHeading || hasTextAlign) return filtered;
  const subtitleIdx = filtered.findIndex((f) => f.key === 'subtitle');
  const headingIdx = filtered.findIndex((f) => f.key === 'heading');
  const insertAfter = subtitleIdx >= 0 ? subtitleIdx : headingIdx;
  return [
    ...filtered.slice(0, insertAfter + 1),
    AUTO_TEXT_ALIGN_FIELD,
    ...filtered.slice(insertAfter + 1),
  ];
}

/** Group section types by category, excluding nav/footer */
export function getSectionsByCategory(): { category: string; label: string; types: { type: string; schema: SectionSchema }[] }[] {
  const groups: Record<string, { type: string; schema: SectionSchema }[]> = {
    hero: [],
    cta: [],
    content: [],
  };

  for (const [type, schema] of Object.entries(SECTION_SCHEMAS)) {
    groups[schema.category]?.push({ type, schema });
  }

  return [
    { category: 'hero', label: 'Heroes', types: groups.hero },
    { category: 'cta', label: 'Call to Actions', types: groups.cta },
    { category: 'content', label: 'Content Sections', types: groups.content },
  ];
}

/**
 * Migrate config from one section type to another.
 * Carries over matching keys, fills missing keys with new type's defaults.
 * Preserves array fields (items, categories, etc.) if the new type also has them.
 */
export function migrateSectionConfig(
  oldConfig: Record<string, any>,
  newType: string
): Record<string, any> {
  const schema = SECTION_SCHEMAS[newType];
  if (!schema) return { ...oldConfig };

  const migrated: Record<string, any> = {};

  for (const field of schema.fields) {
    if (field.key in oldConfig && oldConfig[field.key] !== undefined) {
      // Carry over existing value
      migrated[field.key] = oldConfig[field.key];
    } else if (field.type !== 'array') {
      // Fill with default for non-array fields
      migrated[field.key] = field.default;
    }
    // Array fields with no existing data are omitted — components use their own fallbacks
  }

  // Preserve auto-injected textAlign across migrations (any section with a heading
  // gets the alignment control, even if not explicitly declared in the schema).
  const newHasHeading = schema.fields.some((f) => f.key === 'heading');
  const newHasTextAlign = schema.fields.some((f) => f.key === 'textAlign');
  if (newHasHeading && !newHasTextAlign && oldConfig.textAlign !== undefined) {
    migrated.textAlign = oldConfig.textAlign;
  }

  return migrated;
}
