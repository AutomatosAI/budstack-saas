/**
 * Section Schema System
 *
 * Single source of truth for what fields each section type supports.
 * Drives the Store Editor form rendering and section type migration.
 */

export type FieldType = 'text' | 'textarea' | 'image' | 'video' | 'url' | 'select' | 'number' | 'array' | 'boolean' | 'product-picker';

/** Reusable background image + overlay fields for sections that support optional bg images */
const BG_IMAGE_FIELDS = [
  { key: 'backgroundImageUrl', label: 'Background Image (optional)', type: 'image' as const, default: '' },
  { key: 'overlayOpacity', label: 'Background Overlay Opacity', type: 'select' as const, default: '0.5', options: ['0', '0.1', '0.2', '0.3', '0.4', '0.5', '0.6', '0.7', '0.8', '0.9'] },
];

/** Shape of a single sub-field inside an array item (e.g. title, description inside a feature) */
export interface ArrayItemField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'image' | 'select';
  default: string | number;
  options?: string[];
  placeholder?: string;
}

export interface FieldSchema {
  key: string;
  label: string;
  type: FieldType;
  default: string | number;
  options?: string[]; // For 'select' type
  placeholder?: string;
  /** For 'array' type: defines the shape of each item in the array */
  itemFields?: ArrayItemField[];
  /** For 'array' type: label for the "Add" button, e.g. "Add Feature" */
  itemLabel?: string;
}

export interface SectionSchema {
  label: string;
  category: 'hero' | 'cta' | 'content' | 'navigation' | 'footer';
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
      { key: 'videoUrl', label: 'Video', type: 'video', default: '' },
      { key: 'imageUrl', label: 'Fallback Image', type: 'image', default: '' },
      { key: 'watermarkUrl', label: 'Watermark Image', type: 'image', default: '' },
      { key: 'textAlign', label: 'Text Alignment', type: 'select', default: 'center', options: ['left', 'center', 'right'] },
      { key: 'heroType', label: 'Background Style', type: 'select', default: 'video', options: ['video', 'image', 'gradient', 'gradient-image'] },
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
  HeroWarpShader: {
    label: 'Warp Shader Hero',
    category: 'hero',
    description: 'Animated fluid warp shader background with configurable pattern',
    fields: [
      { key: 'title', label: 'Title', type: 'text', default: 'Welcome' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'Your tagline here' },
      { key: 'description', label: 'Description', type: 'textarea', default: '' },
      { key: 'ctaText', label: 'CTA Button Text', type: 'text', default: 'Get Started' },
      { key: 'secondaryCtaText', label: 'Secondary CTA Text', type: 'text', default: '' },
      { key: 'secondaryCtaHref', label: 'Secondary CTA Link', type: 'url', default: '' },
      { key: 'shaderShape', label: 'Shader Pattern', type: 'select', default: 'checks', options: ['checks', 'stripes', 'edge'] },
      { key: 'shaderSpeed', label: 'Animation Speed', type: 'select', default: '0.8', options: ['0.3', '0.5', '0.8', '1.2', '2'] },
      { key: 'shaderSwirl', label: 'Swirl Intensity', type: 'select', default: '0.8', options: ['0.2', '0.5', '0.8', '1.2', '2'] },
      { key: 'primaryColor', label: 'Primary Colour Override', type: 'text', default: '', placeholder: 'e.g. 280 80% 50% (HSL)' },
      { key: 'accentColor', label: 'Accent Colour Override', type: 'text', default: '', placeholder: 'e.g. 320 70% 60% (HSL)' },
    ],
  },
  HeroMeshGradient: {
    label: 'Mesh Gradient Hero',
    category: 'hero',
    description: 'Dark cinematic hero with layered animated mesh gradients',
    fields: [
      { key: 'title', label: 'Title', type: 'text', default: 'Welcome' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'Your tagline here' },
      { key: 'description', label: 'Description', type: 'textarea', default: '' },
      { key: 'ctaText', label: 'CTA Button Text', type: 'text', default: 'Get Started' },
      { key: 'secondaryCtaText', label: 'Secondary CTA Text', type: 'text', default: '' },
      { key: 'secondaryCtaHref', label: 'Secondary CTA Link', type: 'url', default: '' },
      { key: 'textAlign', label: 'Text Alignment', type: 'select', default: 'left', options: ['left', 'center'] },
      { key: 'shaderSpeed', label: 'Animation Speed', type: 'select', default: '0.3', options: ['0.1', '0.3', '0.5', '0.8', '1'] },
      { key: 'primaryColor', label: 'Primary Colour Override', type: 'text', default: '', placeholder: 'e.g. 280 80% 50% (HSL)' },
      { key: 'accentColor', label: 'Accent Colour Override', type: 'text', default: '', placeholder: 'e.g. 320 70% 60% (HSL)' },
    ],
  },
  HeroAurora: {
    label: 'Aurora Hero',
    category: 'hero',
    description: 'Animated aurora gradient with per-letter text reveal animation',
    fields: [
      { key: 'title', label: 'Title', type: 'text', default: 'Welcome' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'Your tagline here' },
      { key: 'description', label: 'Description', type: 'textarea', default: '' },
      { key: 'ctaText', label: 'CTA Button Text', type: 'text', default: 'Get Started' },
      { key: 'secondaryCtaText', label: 'Secondary CTA Text', type: 'text', default: '' },
      { key: 'secondaryCtaHref', label: 'Secondary CTA Link', type: 'url', default: '' },
      { key: 'auroraIntensity', label: 'Aurora Intensity', type: 'select', default: 'medium', options: ['subtle', 'medium', 'vivid'] },
      { key: 'primaryColor', label: 'Primary Colour Override', type: 'text', default: '', placeholder: 'e.g. 280 80% 50% (HSL)' },
      { key: 'accentColor', label: 'Accent Colour Override', type: 'text', default: '', placeholder: 'e.g. 320 70% 60% (HSL)' },
    ],
  },
  HeroShaderGlass: {
    label: 'Shader Glass Hero',
    category: 'hero',
    description: 'Dark glassmorphic hero with mesh gradient and pulsing border glow',
    fields: [
      { key: 'title', label: 'Title', type: 'text', default: 'Welcome' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'Your tagline here' },
      { key: 'description', label: 'Description', type: 'textarea', default: '' },
      { key: 'ctaText', label: 'CTA Button Text', type: 'text', default: 'Get Started' },
      { key: 'secondaryCtaText', label: 'Secondary CTA Text', type: 'text', default: '' },
      { key: 'secondaryCtaHref', label: 'Secondary CTA Link', type: 'url', default: '' },
      { key: 'shaderSpeed', label: 'Animation Speed', type: 'select', default: '0.4', options: ['0.2', '0.4', '0.6', '0.8', '1.2'] },
      { key: 'glowColor', label: 'Glow Colour', type: 'select', default: 'primary', options: ['primary', 'accent', 'white'] },
      { key: 'primaryColor', label: 'Primary Colour Override', type: 'text', default: '', placeholder: 'e.g. 280 80% 50% (HSL)' },
      { key: 'accentColor', label: 'Accent Colour Override', type: 'text', default: '', placeholder: 'e.g. 320 70% 60% (HSL)' },
    ],
  },
  HeroDesignali: {
    label: 'Designali Hero',
    category: 'hero',
    description: 'Clean modern hero with gradient text, radial glow, and optional showcase image',
    fields: [
      { key: 'title', label: 'Title', type: 'text', default: 'Welcome' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'Your tagline here' },
      { key: 'description', label: 'Description', type: 'textarea', default: '' },
      { key: 'ctaText', label: 'CTA Button Text', type: 'text', default: 'Get Started' },
      { key: 'secondaryCtaText', label: 'Secondary CTA Text', type: 'text', default: '' },
      { key: 'secondaryCtaHref', label: 'Secondary CTA Link', type: 'url', default: '' },
      { key: 'badgeText', label: 'Badge Text', type: 'text', default: '' },
      { key: 'imageUrl', label: 'Showcase Image', type: 'image', default: '' },
      { key: 'glowIntensity', label: 'Glow Intensity', type: 'select', default: 'medium', options: ['subtle', 'medium', 'vivid'] },
      { key: 'primaryColor', label: 'Primary Colour Override', type: 'text', default: '', placeholder: 'e.g. 280 80% 50% (HSL)' },
      { key: 'accentColor', label: 'Accent Colour Override', type: 'text', default: '', placeholder: 'e.g. 320 70% 60% (HSL)' },
    ],
  },
  HeroSplitImages: {
    label: 'Split Images Hero',
    category: 'hero',
    description: 'Two-column hero with text and a 3-image asymmetric grid',
    fields: [
      { key: 'title', label: 'Title', type: 'text', default: 'Welcome' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'Your tagline here' },
      { key: 'description', label: 'Description', type: 'textarea', default: '' },
      { key: 'ctaText', label: 'CTA Button Text', type: 'text', default: 'Get Started' },
      { key: 'secondaryCtaText', label: 'Secondary CTA Text', type: 'text', default: 'Book a Call' },
      { key: 'secondaryCtaHref', label: 'Secondary CTA Link', type: 'url', default: '/contact' },
      { key: 'badgeText', label: 'Badge Text', type: 'text', default: '' },
      { key: 'imageUrl', label: 'Image 1 (Large)', type: 'image', default: '' },
      { key: 'imageUrl2', label: 'Image 2 (Top Right)', type: 'image', default: '' },
      { key: 'imageUrl3', label: 'Image 3 (Bottom Right)', type: 'image', default: '' },
      { key: 'layout', label: 'Text Side', type: 'select', default: 'left', options: ['left', 'right'] },
      { key: 'primaryColor', label: 'Primary Colour Override', type: 'text', default: '', placeholder: 'e.g. 280 80% 50% (HSL)' },
      { key: 'accentColor', label: 'Accent Colour Override', type: 'text', default: '', placeholder: 'e.g. 320 70% 60% (HSL)' },
    ],
  },
  HeroFuturistic: {
    label: 'Futuristic Hero',
    category: 'hero',
    description: 'Dark cyberpunk hero with animated grid, scanning line, and particle effects',
    fields: [
      { key: 'title', label: 'Title', type: 'text', default: 'Welcome' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'Your tagline here' },
      { key: 'description', label: 'Description', type: 'textarea', default: '' },
      { key: 'ctaText', label: 'CTA Button Text', type: 'text', default: 'Get Started' },
      { key: 'secondaryCtaText', label: 'Secondary CTA Text', type: 'text', default: '' },
      { key: 'secondaryCtaHref', label: 'Secondary CTA Link', type: 'url', default: '' },
      { key: 'glowColor', label: 'Glow Colour', type: 'select', default: 'primary', options: ['primary', 'accent', 'cyan'] },
      { key: 'gridDensity', label: 'Grid Density', type: 'select', default: 'medium', options: ['sparse', 'medium', 'dense'] },
      { key: 'scanLine', label: 'Scanning Line', type: 'select', default: 'true', options: ['true', 'false'] },
      { key: 'primaryColor', label: 'Primary Colour Override', type: 'text', default: '', placeholder: 'e.g. 280 80% 50% (HSL)' },
      { key: 'accentColor', label: 'Accent Colour Override', type: 'text', default: '', placeholder: 'e.g. 320 70% 60% (HSL)' },
    ],
  },

  HeroCollage: {
    label: 'Collage Hero',
    category: 'hero',
    description: 'Editorial collage with split images, translucent watermark overlay, and bold typography',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'Your Brand' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: '' },
      { key: 'imageUrl', label: 'Left Image', type: 'image', default: '' },
      { key: 'rightImageUrl', label: 'Right Image (optional)', type: 'image', default: '' },
      { key: 'watermarkUrl', label: 'Center Watermark', type: 'image', default: '' },
      { key: 'splitRatio', label: 'Split Ratio (Left/Right)', type: 'select', default: '40/60', options: ['30/70', '40/60', '50/50', '60/40', '70/30'] },
      { key: 'watermarkOpacity', label: 'Watermark Opacity', type: 'select', default: '0.4', options: ['0.1', '0.2', '0.3', '0.4', '0.5', '0.6', '0.7', '0.8'] },
      { key: 'textPosition', label: 'Text Position', type: 'select', default: 'bottom-right', options: ['bottom-right', 'bottom-left', 'center-right', 'center', 'vertical-right'] },
      { key: 'showVerticalText', label: 'Show Vertical Side Text', type: 'select', default: 'yes', options: ['yes', 'no'] },
      { key: 'borderWidth', label: 'Border/Frame', type: 'select', default: 'medium', options: ['none', 'thin', 'medium', 'thick'] },
      { key: 'height', label: 'Height', type: 'select', default: 'large', options: ['medium', 'large', 'full'] },
      { key: 'ctaText', label: 'CTA Button Text', type: 'text', default: '' },
      { key: 'ctaHref', label: 'CTA Link', type: 'url', default: '/products' },
    ],
  },

  HeroFramed: {
    label: 'Framed Hero',
    category: 'hero',
    description: 'Full background image with a text frame panel (left or right) for readability',
    fields: [
      { key: 'title', label: 'Title', type: 'text', default: 'Welcome' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'Your tagline here' },
      { key: 'description', label: 'Description', type: 'textarea', default: '' },
      { key: 'ctaText', label: 'CTA Button Text', type: 'text', default: 'Shop Now' },
      { key: 'ctaHref', label: 'CTA Link', type: 'url', default: '/products' },
      { key: 'secondaryCtaText', label: 'Secondary CTA Text', type: 'text', default: '' },
      { key: 'secondaryCtaHref', label: 'Secondary CTA Link', type: 'url', default: '' },
      { key: 'imageUrl', label: 'Background Image', type: 'image', default: '' },
      { key: 'framePosition', label: 'Frame Position', type: 'select', default: 'left', options: ['left', 'right'] },
      { key: 'frameStyle', label: 'Frame Style', type: 'select', default: 'solid', options: ['solid', 'glass', 'gradient'] },
      { key: 'frameOpacity', label: 'Frame Opacity', type: 'select', default: '0.85', options: ['0.5', '0.6', '0.7', '0.8', '0.85', '0.9', '0.95', '1'] },
      { key: 'overlayOpacity', label: 'Image Overlay Darkness', type: 'select', default: '0.3', options: ['0', '0.1', '0.2', '0.3', '0.4', '0.5', '0.6'] },
      { key: 'heroHeight', label: 'Hero Height', type: 'select', default: 'large', options: ['medium', 'large', 'full'] },
    ],
  },

  // ─── CTAs ──────────────────────────────────────────────────
  Newsletter: {
    label: 'Newsletter Signup',
    category: 'cta',
    description: 'Email signup section with heading, input, and subscribe button',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'Stay in the Loop' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'Get the latest news and offers delivered to your inbox.' },
      { key: 'placeholder', label: 'Input Placeholder', type: 'text', default: 'you@example.com' },
      { key: 'buttonText', label: 'Button Text', type: 'text', default: 'Subscribe' },
      ...BG_IMAGE_FIELDS,
    ],
  },
  CTABanner: {
    label: 'CTA Banner',
    category: 'cta',
    description: 'Full-width call-to-action banner',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'Ready to Get Started?' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: "Let's go" },
      { key: 'ctaText', label: 'Button Text', type: 'text', default: 'Start Now' },
      { key: 'ctaHref', label: 'Button Link', type: 'url', default: '', placeholder: 'Leave empty to use consultation URL' },
      { key: 'showButton', label: 'Show Button', type: 'select', default: 'yes', options: ['yes', 'no'] },
      ...BG_IMAGE_FIELDS,
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
      { key: 'ctaHref', label: 'Button Link', type: 'url', default: '', placeholder: 'Leave empty to use consultation URL' },
      { key: 'showButton', label: 'Show Button', type: 'select', default: 'yes', options: ['yes', 'no'] },
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
      { key: 'ctaHref', label: 'Button Link', type: 'url', default: '', placeholder: 'Leave empty to use consultation URL' },
      { key: 'showButton', label: 'Show Button', type: 'select', default: 'yes', options: ['yes', 'no'] },
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
      { key: 'items', label: 'Items', type: 'array', default: '', itemLabel: 'Value Prop', itemFields: [
        { key: 'title', label: 'Title', type: 'text', default: 'Benefit' },
        { key: 'description', label: 'Description', type: 'textarea', default: '' },
        { key: 'icon', label: 'Icon', type: 'text', default: 'Star', placeholder: 'Lucide icon name' },
      ]},
    ],
  },
  ProductShowcase: {
    label: 'Product Showcase',
    category: 'content',
    description: 'Display real products or manual categories from your store',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'Our Products' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'Explore our range' },
      { key: 'dataSource', label: 'Data Source', type: 'select', default: 'manual', options: ['manual', 'products'] },
      { key: 'productIds', label: 'Select Products', type: 'product-picker' as FieldType, default: '' },
      { key: 'categories', label: 'Categories', type: 'array', default: '', itemLabel: 'Category', itemFields: [
        { key: 'title', label: 'Title', type: 'text', default: 'Category' },
        { key: 'description', label: 'Description', type: 'text', default: '' },
        { key: 'href', label: 'Link', type: 'text', default: '/products' },
        { key: 'imageUrl', label: 'Image', type: 'image', default: '' },
      ]},
      { key: 'ctaText', label: 'Button Text', type: 'text', default: 'View All Products' },
      { key: 'ctaHref', label: 'Button Link', type: 'url', default: '', placeholder: 'Leave empty to use products page' },
      { key: 'showButton', label: 'Show Button', type: 'select', default: 'yes', options: ['yes', 'no'] },
      { key: 'imageMode', label: 'Image Fit', type: 'select', default: 'cover', options: ['cover', 'contain'] },
      ...BG_IMAGE_FIELDS,
    ],
  },
  Testimonials: {
    label: 'Testimonials',
    category: 'content',
    description: 'Customer reviews and testimonials',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'What They Say' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'Customer feedback' },
      { key: 'items', label: 'Items', type: 'array', default: '', itemLabel: 'Testimonial', itemFields: [
        { key: 'quote', label: 'Quote', type: 'textarea', default: '' },
        { key: 'name', label: 'Name', type: 'text', default: 'Customer' },
        { key: 'role', label: 'Role / Title', type: 'text', default: '' },
        { key: 'rating', label: 'Rating (1-5)', type: 'number', default: 5 },
      ]},
      ...BG_IMAGE_FIELDS,
    ],
  },
  About: {
    label: 'About',
    category: 'content',
    description: 'About your business with image and stats',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'About Us' },
      { key: 'content', label: 'Content', type: 'textarea', default: 'Our story' },
      { key: 'imageUrl', label: 'Featured Image', type: 'image', default: '' },
      { key: 'backgroundImageUrl', label: 'Background Image (optional)', type: 'image', default: '' },
      { key: 'overlayOpacity', label: 'Background Overlay Opacity', type: 'select', default: '0.4', options: ['0', '0.1', '0.2', '0.3', '0.4', '0.5', '0.6', '0.7', '0.8', '0.9'] },
      { key: 'contentPosition', label: 'Layout', type: 'select', default: 'right', options: ['left', 'right'] },
      { key: 'ctaText', label: 'Button Text', type: 'text', default: 'Learn More About Us' },
      { key: 'stats', label: 'Stats', type: 'array', default: '', itemLabel: 'Stat', itemFields: [
        { key: 'label', label: 'Label', type: 'text', default: 'Stat' },
        { key: 'value', label: 'Value', type: 'text', default: '100+' },
      ]},
    ],
  },
  Gallery: {
    label: 'Gallery',
    category: 'content',
    description: 'Image gallery or portfolio section',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'Gallery' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'See our work' },
      { key: 'items', label: 'Items', type: 'array', default: '', itemLabel: 'Image', itemFields: [
        { key: 'title', label: 'Title', type: 'text', default: '' },
        { key: 'imageUrl', label: 'Image', type: 'image', default: '' },
      ]},
    ],
  },
  Stats: {
    label: 'Stats',
    category: 'content',
    description: 'Key numbers and statistics',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'By The Numbers' },
      { key: 'items', label: 'Items', type: 'array', default: '', itemLabel: 'Stat', itemFields: [
        { key: 'label', label: 'Label', type: 'text', default: 'Stat' },
        { key: 'value', label: 'Value', type: 'text', default: '100+' },
      ]},
      ...BG_IMAGE_FIELDS,
    ],
  },
  FAQ: {
    label: 'FAQ',
    category: 'content',
    description: 'Frequently asked questions accordion',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'Frequently Asked Questions' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'Find answers here' },
      { key: 'items', label: 'Items', type: 'array', default: '', itemLabel: 'Question', itemFields: [
        { key: 'question', label: 'Question', type: 'text', default: 'Question?' },
        { key: 'answer', label: 'Answer', type: 'textarea', default: '' },
      ]},
      ...BG_IMAGE_FIELDS,
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
      { key: 'posts', label: 'Posts', type: 'array', default: '', itemLabel: 'Post', itemFields: [
        { key: 'title', label: 'Title', type: 'text', default: 'Blog Post' },
        { key: 'excerpt', label: 'Excerpt', type: 'textarea', default: '' },
        { key: 'imageUrl', label: 'Image', type: 'image', default: '' },
        { key: 'url', label: 'Link', type: 'text', default: '' },
      ]},
    ],
  },
  Features: {
    label: 'Features',
    category: 'content',
    description: 'Feature list with icons or images',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'Features' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'What we offer' },
      { key: 'imageUrl', label: 'Background Image', type: 'image', default: '' },
      { key: 'overlayOpacity', label: 'Overlay Opacity', type: 'select', default: '0.7', options: ['0.3', '0.5', '0.6', '0.7', '0.8', '0.9'] },
      { key: 'items', label: 'Items', type: 'array', default: '', itemLabel: 'Feature', itemFields: [
        { key: 'title', label: 'Title', type: 'text', default: 'Feature' },
        { key: 'description', label: 'Description', type: 'textarea', default: '' },
        { key: 'icon', label: 'Icon', type: 'text', default: 'Star', placeholder: 'Lucide icon name' },
        { key: 'imageUrl', label: 'Card Background Image', type: 'image', default: '' },
      ]},
    ],
  },
  LogoMarquee: {
    label: 'Logo Marquee',
    category: 'content',
    description: 'Infinite scrolling brand logo carousel with edge fade',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'Trusted By' },
      { key: 'logos', label: 'Logos', type: 'array', default: '', itemLabel: 'Logo', itemFields: [
        { key: 'alt', label: 'Brand Name', type: 'text', default: 'Brand' },
        { key: 'src', label: 'Logo Image', type: 'image', default: '' },
      ]},
      { key: 'speed', label: 'Speed (1-100)', type: 'number', default: 60 },
      { key: 'reverse', label: 'Reverse Direction', type: 'select', default: 'false', options: ['false', 'true'] },
    ],
  },
  BentoGrid: {
    label: 'Bento Grid',
    category: 'content',
    description: 'Asymmetric card grid with variable spans for a modern bento layout',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'Why We Stand Out' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: '' },
      { key: 'cards', label: 'Cards', type: 'array', default: '', itemLabel: 'Card', itemFields: [
        { key: 'title', label: 'Title', type: 'text', default: 'Card Title' },
        { key: 'description', label: 'Description', type: 'textarea', default: '' },
        { key: 'icon', label: 'Icon', type: 'text', default: 'Star', placeholder: 'Lucide icon name' },
        { key: 'span', label: 'Span', type: 'select', default: 'normal', options: ['normal', 'wide', 'tall'] },
      ]},
    ],
  },
  Pricing: {
    label: 'Pricing',
    category: 'content',
    description: 'Pricing tier cards with feature lists and highlighted popular tier',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'Simple, Transparent Pricing' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'Choose the plan that works for you' },
      { key: 'tiers', label: 'Tiers', type: 'array', default: '', itemLabel: 'Tier', itemFields: [
        { key: 'name', label: 'Plan Name', type: 'text', default: 'Basic' },
        { key: 'price', label: 'Price', type: 'text', default: '$0', placeholder: '$29/mo' },
        { key: 'description', label: 'Description', type: 'text', default: '' },
        { key: 'cta', label: 'CTA Text', type: 'text', default: 'Get Started' },
      ]},
      ...BG_IMAGE_FIELDS,
    ],
  },
  TeamGrid: {
    label: 'Team Grid',
    category: 'content',
    description: 'Team member avatars with name, role, and bio',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'Meet Our Team' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'The experts behind your wellness journey' },
      { key: 'imageUrl', label: 'Background Image', type: 'image', default: '' },
      { key: 'overlayOpacity', label: 'Overlay Opacity', type: 'select', default: '0.6', options: ['0', '0.2', '0.4', '0.6', '0.8', '1'] },
      { key: 'members', label: 'Members', type: 'array', default: '', itemLabel: 'Member', itemFields: [
        { key: 'name', label: 'Name', type: 'text', default: 'Team Member' },
        { key: 'role', label: 'Role', type: 'text', default: '' },
        { key: 'avatar', label: 'Avatar URL', type: 'image', default: '' },
        { key: 'bio', label: 'Bio', type: 'textarea', default: '' },
      ]},
    ],
  },
  Timeline: {
    label: 'Timeline',
    category: 'content',
    description: 'Vertical timeline with dot indicators and year labels',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'Our Journey' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: '' },
      { key: 'entries', label: 'Entries', type: 'array', default: '', itemLabel: 'Entry', itemFields: [
        { key: 'year', label: 'Year', type: 'text', default: '2024' },
        { key: 'title', label: 'Title', type: 'text', default: 'Milestone' },
        { key: 'description', label: 'Description', type: 'textarea', default: '' },
      ]},
    ],
  },
  ComparisonTable: {
    label: 'Comparison Table',
    category: 'content',
    description: 'Feature comparison grid with check/x icons across tiers',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'Compare Plans' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'Find the right fit for your needs' },
      { key: 'tiers', label: 'Tier Names', type: 'array', default: '', itemLabel: 'Tier', itemFields: [
        { key: 'name', label: 'Tier Name', type: 'text', default: 'Tier' },
      ]},
      { key: 'features', label: 'Features', type: 'array', default: '', itemLabel: 'Feature', itemFields: [
        { key: 'name', label: 'Feature Name', type: 'text', default: 'Feature' },
      ]},
    ],
  },
  Parallax: {
    label: 'Parallax Section',
    category: 'content',
    description: 'Full-width background image with parallax scroll effect and overlay text',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'Experience the Difference' },
      { key: 'description', label: 'Description', type: 'textarea', default: 'Premium quality products crafted with care.' },
      { key: 'imageUrl', label: 'Background Image', type: 'image', default: '' },
      { key: 'ctaText', label: 'CTA Button Text', type: 'text', default: '' },
      { key: 'ctaHref', label: 'CTA Link', type: 'url', default: '' },
      { key: 'overlayOpacity', label: 'Overlay Opacity (%)', type: 'number', default: 50 },
    ],
  },
  SocialProof: {
    label: 'Social Proof',
    category: 'content',
    description: 'Avatar stack badge with trust text and optional testimonial',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: '' },
      { key: 'count', label: 'Customer Count', type: 'number', default: 10000 },
      { key: 'label', label: 'Label', type: 'text', default: 'Happy Customers' },
      { key: 'rating', label: 'Rating (1-5)', type: 'number', default: 4.9 },
      { key: 'testimonial', label: 'Testimonial Text', type: 'textarea', default: '' },
      { key: 'testimonialAuthor', label: 'Testimonial Author', type: 'text', default: '' },
      { key: 'avatars', label: 'Avatar URLs', type: 'array', default: '', itemLabel: 'Avatar', itemFields: [
        { key: 'imageUrl', label: 'Avatar Image', type: 'image', default: '' },
      ]},
      ...BG_IMAGE_FIELDS,
    ],
  },
  TabsShowcase: {
    label: 'Tabs Showcase',
    category: 'content',
    description: 'Tabbed content with icon triggers, per-tab image and description',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'What Sets Us Apart' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: '' },
      { key: 'tabs', label: 'Tabs', type: 'array', default: '', itemLabel: 'Tab', itemFields: [
        { key: 'label', label: 'Tab Label', type: 'text', default: 'Tab' },
        { key: 'icon', label: 'Icon', type: 'text', default: 'Star', placeholder: 'Lucide icon name' },
        { key: 'title', label: 'Content Title', type: 'text', default: '' },
        { key: 'description', label: 'Content Description', type: 'textarea', default: '' },
        { key: 'imageUrl', label: 'Image', type: 'image', default: '' },
      ]},
    ],
  },
  VideoGallery: {
    label: 'Video Gallery',
    category: 'content',
    description: 'Video/image grid with click-to-expand modal',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'Gallery' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: '' },
      { key: 'items', label: 'Items', type: 'array', default: '', itemLabel: 'Item', itemFields: [
        { key: 'title', label: 'Title', type: 'text', default: '' },
        { key: 'thumbnailUrl', label: 'Thumbnail', type: 'image', default: '' },
        { key: 'videoUrl', label: 'Video URL', type: 'text', default: '', placeholder: 'https://youtube.com/...' },
      ]},
    ],
  },
  ProcessSteps: {
    label: 'Process Steps',
    category: 'content',
    description: 'Numbered steps with connecting lines and icons',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'How It Works' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'Getting started is simple' },
      { key: 'orientation', label: 'Orientation', type: 'select', default: 'horizontal', options: ['horizontal', 'vertical'] },
      { key: 'steps', label: 'Steps', type: 'array', default: '', itemLabel: 'Step', itemFields: [
        { key: 'title', label: 'Title', type: 'text', default: 'Step' },
        { key: 'description', label: 'Description', type: 'textarea', default: '' },
        { key: 'icon', label: 'Icon', type: 'text', default: 'CheckCircle', placeholder: 'Lucide icon name' },
      ]},
      ...BG_IMAGE_FIELDS,
    ],
  },
  StatsCounter: {
    label: 'Stats Counter',
    category: 'content',
    description: 'Animated digit roller with spring physics and icons',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: '' },
      { key: 'items', label: 'Items', type: 'array', default: '', itemLabel: 'Counter', itemFields: [
        { key: 'label', label: 'Label', type: 'text', default: 'Metric' },
        { key: 'value', label: 'Target Number', type: 'number', default: 100 },
        { key: 'suffix', label: 'Suffix', type: 'text', default: '+', placeholder: '+, %, k, etc.' },
        { key: 'icon', label: 'Icon', type: 'text', default: 'TrendingUp', placeholder: 'Lucide icon name' },
      ]},
      ...BG_IMAGE_FIELDS,
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
  TextMarquee: {
    label: 'Text Marquee',
    category: 'content',
    description: 'Scrolling text banner with optional icon separator',
    fields: [
      { key: 'text', label: 'Marquee Text', type: 'text', default: 'Premium wellness products crafted with care' },
      { key: 'icon', label: 'Separator Icon', type: 'select', default: 'leaf', options: ['leaf', 'cannabis', 'droplet', 'sparkle', 'none'] },
      { key: 'logoUrl', label: 'Custom Separator Image (overrides icon)', type: 'image', default: '' },
      { key: 'speed', label: 'Scroll Speed', type: 'number', default: 40 },
      { key: 'reverse', label: 'Reverse Direction', type: 'boolean', default: '' },
      { key: 'fontSize', label: 'Text Size', type: 'select', default: 'lg', options: ['sm', 'md', 'lg', 'xl'] },
      { key: 'fontStyle', label: 'Font Style', type: 'select', default: 'italic-serif', options: ['serif', 'sans', 'italic-serif', 'italic-sans', 'mono', 'uppercase-sans', 'uppercase-serif', 'light-serif', 'light-sans', 'bold-sans'] },
      { key: 'showBorder', label: 'Show Top/Bottom Border', type: 'boolean', default: '' },
      { key: 'repeat', label: 'Repeat Count', type: 'number', default: 4 },
    ],
  },
  FeaturesShowcase: {
    label: 'Features Showcase',
    category: 'content',
    description: 'Split layout with center image and feature cards on each side',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', default: '' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: '' },
      { key: 'imageUrl', label: 'Center Image', type: 'image', default: '' },
      { key: 'imageAlt', label: 'Image Alt Text', type: 'text', default: 'Product showcase' },
      { key: 'leftFeatures', label: 'Left Features', type: 'array', default: '', itemLabel: 'Feature', itemFields: [
        { key: 'icon', label: 'Icon', type: 'select', default: 'leaf', options: ['leaf', 'cannabis', 'heart', 'shield', 'brain', 'sleep', 'pain', 'anxiety', 'appetite', 'muscle', 'blood-pressure', 'droplet', 'sun', 'flower', 'pill', 'dna'] },
        { key: 'title', label: 'Title', type: 'text', default: 'Feature' },
        { key: 'description', label: 'Description', type: 'textarea', default: '' },
      ]},
      { key: 'rightFeatures', label: 'Right Features', type: 'array', default: '', itemLabel: 'Feature', itemFields: [
        { key: 'icon', label: 'Icon', type: 'select', default: 'leaf', options: ['leaf', 'cannabis', 'heart', 'shield', 'brain', 'sleep', 'pain', 'anxiety', 'appetite', 'muscle', 'blood-pressure', 'droplet', 'sun', 'flower', 'pill', 'dna'] },
        { key: 'title', label: 'Title', type: 'text', default: 'Feature' },
        { key: 'description', label: 'Description', type: 'textarea', default: '' },
      ]},
    ],
  },
};

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

/** Return editable fields for the editor form.
 *  Array fields with itemFields are included (rendered as item editors).
 *  Array fields WITHOUT itemFields are still excluded (no schema to render). */
export function getEditableFields(type: string): FieldSchema[] {
  const schema = SECTION_SCHEMAS[type];
  if (!schema) return [];
  return schema.fields.filter((f) => f.type !== 'array' || (f.itemFields && f.itemFields.length > 0));
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
