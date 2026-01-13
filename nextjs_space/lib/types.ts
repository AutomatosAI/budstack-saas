// Multi-Tenant Types

export type UserType = "customer" | "tenant" | "admin";

export interface TenantContext {
  id: string;
  name: string;
  slug: string;
  subdomain: string | null;
  customDomain: string | null;
  templateId: string;
  primaryColor: string;
  secondaryColor: string;
  logo: string | null;
  logoWhite: string | null;
  subscriptionTier: string;
  country: string;
  currency: string;
  language: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  userType: UserType;
  tenantId?: string;
  role?: string;
}

// ============================================
// COMPREHENSIVE TENANT BRANDING & THEMING
// ============================================

export interface TenantSettings {
  // === BRANDING & IDENTITY ===
  tagline?: string;
  template?: "modern" | "minimalist" | "bold";

  // === COLORS (Tailwind compatible hex values) ===
  primaryColor?: string; // Main brand color (headers, primary buttons)
  secondaryColor?: string; // Secondary elements (links, secondary buttons)
  accentColor?: string; // Call-to-action highlights
  backgroundColor?: string; // Page background
  textColor?: string; // Body text color
  headingColor?: string; // Heading text color

  // === TYPOGRAPHY ===
  fontFamily?:
    | "inter"
    | "playfair"
    | "roboto"
    | "montserrat"
    | "lato"
    | "poppins";
  headingFontFamily?:
    | "inter"
    | "playfair"
    | "roboto"
    | "montserrat"
    | "lato"
    | "poppins";
  fontSize?: "small" | "medium" | "large";

  // === BUTTONS ===
  buttonStyle?: "rounded" | "square" | "pill"; // Border radius
  buttonSize?: "small" | "medium" | "large";

  // === LAYOUT & SPACING ===
  borderRadius?: "none" | "small" | "medium" | "large"; // Global border radius
  spacing?: "compact" | "normal" | "comfortable"; // Global spacing scale
  shadowStyle?: "none" | "soft" | "medium" | "bold"; // Card/button shadows

  // === IMAGES (S3 cloud storage paths) ===
  logoPath?: string;
  heroImagePath?: string;
  faviconPath?: string;

  // === HERO SECTION ===
  heroType?: "gradient" | "image" | "video";

  // === CONTACT ===
  contactInfo?: string;

  // === BUSINESS INFORMATION ===
  businessInfo?: {
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    country?: string;
    emergencyLine?: string;
    supportHours?: string; // e.g., "Mon-Fri: 9AM-6PM"
  };

  // === BUSINESS HOURS ===
  businessHours?: {
    monday?: { open?: string; close?: string; closed?: boolean };
    tuesday?: { open?: string; close?: string; closed?: boolean };
    wednesday?: { open?: string; close?: string; closed?: boolean };
    thursday?: { open?: string; close?: string; closed?: boolean };
    friday?: { open?: string; close?: string; closed?: boolean };
    saturday?: { open?: string; close?: string; closed?: boolean };
    sunday?: { open?: string; close?: string; closed?: boolean };
  };

  // === FOOTER CONTENT ===
  footer?: {
    description?: string;
    certifications?: Array<{ name: string; icon?: string }>;
    quickLinks?: Array<{ label: string; url: string }>;
    supportLinks?: Array<{ label: string; url: string }>;
    contactInfo?: {
      phone?: string;
      email?: string;
      address?: string;
      supportHours?: string;
    };
    socialMedia?: {
      facebook?: string;
      twitter?: string;
      instagram?: string;
      linkedin?: string;
    };
    legalLinks?: Array<{ label: string; url: string }>;
    copyrightText?: string;
    servingArea?: string; // e.g., "Serving All of Portugal"
    servingDetails?: string; // e.g., "From Lisbon to Porto, Algarve to Braga"
  };

  // === PAGE CONTENT (Personal Pages - Tenant Editable) ===
  pageContent?: {
    home?: {
      heroTitle?: string;
      heroSubtitle?: string;
      heroCtaText?: string;
      aboutSection?: string;
      featuresTitle?: string;
      features?: Array<{
        title: string;
        description: string;
        icon?: string;
      }>;
    };
    about?: {
      title?: string;
      subtitle?: string;
      content?: string;
      missionStatement?: string;
      teamSection?: string;
    };
    contact?: {
      title?: string;
      subtitle?: string;
      description?: string;
      formTitle?: string;
      formDescription?: string;
      emergencyNote?: string;
    };
    products?: {
      title?: string;
      subtitle?: string;
      description?: string;
      searchPlaceholder?: string;
    };
    howItWorks?: {
      title?: string;
      subtitle?: string;
      description?: string;
      steps?: Array<{
        number: number;
        title: string;
        description: string;
      }>;
      complianceTitle?: string;
      complianceItems?: Array<string>;
    };
    consultation?: {
      title?: string;
      subtitle?: string;
      description?: string;
    };
    conditions?: {
      title?: string;
      subtitle?: string;
      description?: string;
    };
    faq?: {
      title?: string;
      subtitle?: string;
      description?: string;
    };
    blog?: {
      title?: string;
      subtitle?: string;
      description?: string;
    };
  };

  // === ADVANCED ===
  customCSS?: string; // Custom CSS for advanced users

  // === DOCTOR GREEN API ===
  doctorGreenCredentials?: {
    clientId?: string;
    clientSecret?: string;
    nftContractId?: string;
    nftTokenId?: string;
  };
}
