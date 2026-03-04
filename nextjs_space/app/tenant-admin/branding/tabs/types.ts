import type { Dispatch, SetStateAction } from "react";

export interface EditorFormData {
  // Dynamic Section Configuration
  sectionConfigs: Record<string, Record<string, any>>;
  layoutSections: any[];

  // Business
  businessName: string;
  tagline: string;

  // Colors
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  headingColor: string;

  // Per-section color overrides (sectionId -> { colorKey -> hex })
  sectionColorOverrides: Record<string, Record<string, string>>;

  // Typography
  fontFamily: string;
  headingFontFamily: string;
  fontSize: string;
  fontWeight: string;
  headingFontWeight: string;
  letterSpacingPreset: string;

  // Layout
  template: string;
  buttonStyle: string;
  buttonSize: string;
  borderRadius: string;
  spacing: string;
  shadowStyle: string;

  // Premium Styling
  glassEffect: string;
  animationType: string;
  dividerStyle: string;
  buttonHoverEffect: string;

  // Hero
  heroType: string;

  // Interactive
  educationHotspots: any[];

  // Page Content - Home
  homeHeroTitle: string;
  homeHeroSubtitle: string;
  homeHeroCtaText: string;
  homeHeroAlignment: string;
  homeHeroHeight: string;
  homeHeroOverlayStyle: string;
  homeHeroOverlayOpacity: number;

  // Page Content - About
  aboutTitle: string;
  aboutContent: string;

  // Page Content - Contact
  contactTitle: string;
  contactDescription: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;

  // Advanced
  customCSS: string;
}

export type SetFormData = Dispatch<SetStateAction<EditorFormData>>;
