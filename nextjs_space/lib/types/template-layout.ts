export interface SectionColorOverrides {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  surface?: string;
  text?: string;
  heading?: string;
  border?: string;
}

export interface LayoutSection {
  type: string;
  id?: string;
  config?: Record<string, any>;
  visible?: boolean;
  colorOverrides?: SectionColorOverrides;
}

/**
 * S3 asset keys that appear in section configs and need signing/stripping.
 * Single source of truth — used by store page, editor page, preview page,
 * and both branding API routes. Add new asset fields here only.
 */
export const SECTION_ASSET_KEYS = [
  'imageUrl', 'imageUrl2', 'imageUrl3',
  'videoUrl', 'watermarkUrl', 'rightImageUrl',
  'backgroundImageUrl',
] as const;

export interface TemplateLayout {
  version: string;
  navigation: string;
  navigationConfig?: Record<string, any>;
  sections: LayoutSection[];
  footer: string;
  footerConfig?: Record<string, any>;
  settings?: {
    wrapperClass?: string;
    googleFontsUrl?: string;
    sectionPadding?: string; // e.g. "2rem" or "2rem/3rem/3.5rem" (mobile/sm/md)
    /**
     * When true, suppresses TENANT_SCOPED_CSS hardcoded section padding so
     * the template's own py-* / spacing classes win. Opt-in per template;
     * existing templates that don't set this flag are unaffected.
     */
    useTemplatePadding?: boolean;
  };
}
