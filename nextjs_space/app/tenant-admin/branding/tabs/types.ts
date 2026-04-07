import type { Dispatch, SetStateAction } from "react";
import type { SocialLink } from "@/lib/section-schemas";

export interface LogoPlacement {
  // Navigation
  navPosition: "left" | "center" | "right";
  navSize: number | string;  // px value (24–120), legacy "small"|"medium"|"large" accepted by components
  showBusinessName: boolean;

  // Hero
  heroShowLogo: boolean;
  heroX: number;       // 0-100 percentage
  heroY: number;       // 0-100 percentage
  heroSize: number | string;  // px value (24–400), legacy string values accepted by components
  heroStyle: "plain" | "circular" | "badge";

  // Footer
  footerShowLogo: boolean;
}

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

  // Nav/footer color overrides
  navColorOverrides: Record<string, string>;
  footerColorOverrides: Record<string, string>;

  // Typography
  fontFamily: string;
  headingFontFamily: string;
  fontSize: string;
  heroFontSize: string;
  sectionFontSize: string;
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

  // Navigation & Footer
  navigationStyle: string;
  navigationConfig: {
    links: { label: string; href: string }[];
    cta: { label: string; href: string };
    cta2?: { label: string; href: string };
    showCart: boolean;
  };
  footerStyle: string;
  footerConfig: {
    tagline: string;
    sections: { title: string; links: { label: string; href: string }[] }[];
    socialLinks: SocialLink[];
    disclaimer: string;
    address: string;
    email: string;
  };

  // Interactive
  educationHotspots: any[];

  // Logo Placement
  logoPlacement: LogoPlacement;

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
