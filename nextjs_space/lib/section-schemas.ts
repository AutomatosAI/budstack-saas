/**
 * Section Schema System
 *
 * Single source of truth for what fields each section type supports.
 * Drives the Store Editor form rendering and section type migration.
 */

export type FieldType = 'text' | 'textarea' | 'image' | 'url' | 'select' | 'number' | 'array';

export interface FieldSchema {
  key: string;
  label: string;
  type: FieldType;
  default: string | number;
  options?: string[]; // For 'select' type
  placeholder?: string;
}

export interface SectionSchema {
  label: string;
  category: 'hero' | 'cta' | 'content';
  description: string;
  fields: FieldSchema[];
}

export const SECTION_SCHEMAS: Record<string, SectionSchema> = {
  // ─── Heroes ────────────────────────────────────────────────
  HeroFullScreen: {
    label: 'Full Screen Hero',
    category: 'hero',
    description: 'Full-width hero with background image or gradient',
    fields: [
      { key: 'title', label: 'Title', type: 'text', default: 'Welcome' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'Your tagline here' },
      { key: 'description', label: 'Description', type: 'textarea', default: '' },
      { key: 'ctaText', label: 'CTA Button Text', type: 'text', default: 'Book Consultation' },
      { key: 'secondaryCtaText', label: 'Secondary CTA Text', type: 'text', default: '' },
      { key: 'secondaryCtaHref', label: 'Secondary CTA Link', type: 'url', default: '' },
      { key: 'imageUrl', label: 'Background Image', type: 'image', default: '' },
      { key: 'textAlign', label: 'Text Alignment', type: 'select', default: 'center', options: ['left', 'center', 'right'] },
      { key: 'heroType', label: 'Background Style', type: 'select', default: 'gradient-image', options: ['image', 'gradient', 'gradient-image'] },
      { key: 'heroHeight', label: 'Hero Height', type: 'select', default: 'large', options: ['medium', 'large', 'full'] },
    ],
  },
  HeroSplit: {
    label: 'Split Hero',
    category: 'hero',
    description: 'Two-column hero with text and image side by side',
    fields: [
      { key: 'title', label: 'Title', type: 'text', default: 'Welcome' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'Your tagline here' },
      { key: 'description', label: 'Description', type: 'textarea', default: '' },
      { key: 'ctaText', label: 'CTA Button Text', type: 'text', default: 'Get Started' },
      { key: 'secondaryCtaText', label: 'Secondary CTA Text', type: 'text', default: '' },
      { key: 'secondaryCtaHref', label: 'Secondary CTA Link', type: 'url', default: '' },
      { key: 'imageUrl', label: 'Hero Image', type: 'image', default: '' },
    ],
  },
  HeroVideo: {
    label: 'Video Hero',
    category: 'hero',
    description: 'Hero section with background video',
    fields: [
      { key: 'title', label: 'Title', type: 'text', default: 'Watch This' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'Your tagline here' },
      { key: 'ctaText', label: 'CTA Button Text', type: 'text', default: 'Learn More' },
      { key: 'videoUrl', label: 'Video URL', type: 'url', default: '' },
      { key: 'imageUrl', label: 'Fallback Image', type: 'image', default: '' },
      { key: 'watermarkUrl', label: 'Watermark Image', type: 'image', default: '' },
      { key: 'textAlign', label: 'Text Alignment', type: 'select', default: 'center', options: ['left', 'center', 'right'] },
      { key: 'heroType', label: 'Background Style', type: 'select', default: 'image', options: ['image', 'gradient', 'gradient-image'] },
      { key: 'overlayOpacity', label: 'Overlay Opacity (%)', type: 'number', default: 50 },
      { key: 'heroHeight', label: 'Hero Height', type: 'select', default: 'large', options: ['medium', 'large', 'full'] },
    ],
  },
  HeroMinimal: {
    label: 'Minimal Hero',
    category: 'hero',
    description: 'Clean, text-focused hero with minimal styling',
    fields: [
      { key: 'title', label: 'Title', type: 'text', default: 'Clean & Simple' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'Minimalist hero block' },
      { key: 'description', label: 'Description', type: 'textarea', default: '' },
      { key: 'ctaText', label: 'CTA Button Text', type: 'text', default: 'Get Started' },
    ],
  },

  // ─── CTAs ──────────────────────────────────────────────────
  CTABanner: {
    label: 'CTA Banner',
    category: 'cta',
    description: 'Full-width call-to-action banner',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'Ready to Get Started?' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: "Let's go" },
      { key: 'ctaText', label: 'Button Text', type: 'text', default: 'Start Now' },
    ],
  },
  CTASplit: {
    label: 'CTA Split',
    category: 'cta',
    description: 'Two-column CTA with image',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'Contact Us' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'We are here to help' },
      { key: 'ctaText', label: 'Button Text', type: 'text', default: 'Get in Touch' },
      { key: 'imageUrl', label: 'Image', type: 'image', default: '' },
    ],
  },
  CTAWithImage: {
    label: 'CTA with Image',
    category: 'cta',
    description: 'Call-to-action with featured image',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'Join Us' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: "Don't wait" },
      { key: 'ctaText', label: 'Button Text', type: 'text', default: 'Sign Up' },
      { key: 'imageUrl', label: 'Image', type: 'image', default: '' },
    ],
  },

  // ─── Content Sections ─────────────────────────────────────
  ValueProps: {
    label: 'Value Propositions',
    category: 'content',
    description: 'Highlight key benefits or selling points',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'Why Choose Us' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: '' },
      { key: 'items', label: 'Items', type: 'array', default: '' },
    ],
  },
  ProductShowcase: {
    label: 'Product Showcase',
    category: 'content',
    description: 'Display product categories from your store',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'Our Products' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'Explore our range' },
      { key: 'categories', label: 'Categories', type: 'array', default: '' },
    ],
  },
  Testimonials: {
    label: 'Testimonials',
    category: 'content',
    description: 'Customer reviews and testimonials',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'What They Say' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'Customer feedback' },
      { key: 'items', label: 'Items', type: 'array', default: '' },
    ],
  },
  About: {
    label: 'About',
    category: 'content',
    description: 'About your business with image and stats',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'About Us' },
      { key: 'content', label: 'Content', type: 'textarea', default: 'Our story' },
      { key: 'imageUrl', label: 'Image', type: 'image', default: '' },
      { key: 'stats', label: 'Stats', type: 'array', default: '' },
    ],
  },
  Gallery: {
    label: 'Gallery',
    category: 'content',
    description: 'Image gallery or portfolio section',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'Gallery' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'See our work' },
      { key: 'items', label: 'Items', type: 'array', default: '' },
    ],
  },
  Stats: {
    label: 'Stats',
    category: 'content',
    description: 'Key numbers and statistics',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'By The Numbers' },
      { key: 'items', label: 'Items', type: 'array', default: '' },
    ],
  },
  FAQ: {
    label: 'FAQ',
    category: 'content',
    description: 'Frequently asked questions accordion',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'Frequently Asked Questions' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'Find answers here' },
      { key: 'items', label: 'Items', type: 'array', default: '' },
    ],
  },
  BlogFeed: {
    label: 'Blog Feed',
    category: 'content',
    description: 'Display recent blog posts',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'Latest News' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'Read our blog' },
      { key: 'blogUrl', label: 'Blog URL', type: 'url', default: '' },
      { key: 'posts', label: 'Posts', type: 'array', default: '' },
    ],
  },
  Features: {
    label: 'Features',
    category: 'content',
    description: 'Feature list with icons or images',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'Features' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'What we offer' },
      { key: 'items', label: 'Items', type: 'array', default: '' },
    ],
  },
  ImageShowcase: {
    label: 'Image Showcase',
    category: 'content',
    description: 'Full-width image with text overlay',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'Showcase' },
      { key: 'content', label: 'Content', type: 'textarea', default: '' },
      { key: 'ctaText', label: 'CTA Button Text', type: 'text', default: '' },
      { key: 'ctaHref', label: 'CTA Link', type: 'url', default: '' },
      { key: 'imageUrl', label: 'Image', type: 'image', default: '' },
      { key: 'overlayStyle', label: 'Overlay Style', type: 'select', default: 'gradient', options: ['gradient', 'solid', 'none'] },
    ],
  },
};

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

/** Return only non-array fields suitable for the editor form */
export function getEditableFields(type: string): FieldSchema[] {
  const schema = SECTION_SCHEMAS[type];
  if (!schema) return [];
  return schema.fields.filter((f) => f.type !== 'array');
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

  return migrated;
}
