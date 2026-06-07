/**
 * Blank Template Defaults
 *
 * Constants and helpers for creating a fresh "blank canvas" tenant template.
 * Also exports getOrCreateCustomBase() used by both upload-from-GitHub and
 * create-blank flows to satisfy the tenant_templates.baseTemplateId FK.
 */

import { prisma } from "@/lib/db";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Shared FK helper — find or lazily create the "custom-base" placeholder
// ---------------------------------------------------------------------------

export async function getOrCreateCustomBase() {
  let customBase = await prisma.templates.findUnique({
    where: { slug: "custom-base" },
  });
  if (!customBase) {
    customBase = await prisma.templates.create({
      data: {
        id: randomUUID(),
        name: "Custom Base",
        slug: "custom-base",
        description: "Placeholder base template for custom tenant uploads",
        category: "system",
        sourceType: "SYSTEM",
        isActive: false,
        isPublic: false,
        updatedAt: new Date(),
      },
    });
  }
  return customBase;
}

// ---------------------------------------------------------------------------
// Blank layout — minimal starter sections
// ---------------------------------------------------------------------------

export const BLANK_LAYOUT = {
  navigation: "NavMinimal",
  footer: "FooterSimple",
  sections: [
    {
      id: "hero-1",
      type: "HeroMinimal",
      config: {
        title: "Welcome to Your Store",
        subtitle: "Start building your brand right here.",
        ctaText: "Get Started",
        ctaUrl: "/products",
      },
    },
    {
      id: "value-props-1",
      type: "ValueProps",
      config: {
        heading: "Why Choose Us",
        items: [
          { title: "Quality Products", description: "Carefully curated for your needs." },
          { title: "Expert Guidance", description: "Personalised support every step of the way." },
          { title: "Fast Delivery", description: "Reliable shipping you can count on." },
        ],
      },
    },
    {
      id: "cta-banner-1",
      type: "CTABanner",
      config: {
        heading: "Ready to Get Started?",
        description: "Browse our collection and find what works for you.",
        ctaText: "Shop Now",
        ctaUrl: "/products",
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Blank design system — neutral green palette (HSL), Inter, medium sizing
// ---------------------------------------------------------------------------

export const BLANK_DESIGN_SYSTEM = {
  colors: {
    primary: "160 84% 39%",
    secondary: "160 64% 52%",
    accent: "160 76% 46%",
    background: "0 0% 100%",
    text: "220 13% 18%",
    heading: "220 14% 11%",
  },
  typography: {
    fontFamily: { body: "inter", heading: "inter" },
    fontSize: { base: "medium" },
    fontWeight: { body: "400", heading: "700" },
    letterSpacing: "normal",
  },
  borderRadius: { container: "medium", button: "rounded" },
  spacing: { scale: "normal" },
  button: { size: "medium" },
  shadows: { card: "soft" },
};

// ---------------------------------------------------------------------------
// Blank page content — placeholder text
// ---------------------------------------------------------------------------

export const BLANK_PAGE_CONTENT = {
  home: {
    heroTitle: "Welcome to Your Store",
    heroSubtitle: "Start building your brand right here.",
    heroCtaText: "Get Started",
    heroAlignment: "center",
    heroHeight: "large",
    heroOverlayStyle: "gradient-dark",
    heroOverlayOpacity: 60,
  },
  about: {
    title: "About Us",
    content: "Tell your story here. What makes your business unique?",
  },
  contact: {
    title: "Get in Touch",
    description: "We'd love to hear from you.",
    email: "",
    phone: "",
    address: "",
  },
};

// ---------------------------------------------------------------------------
// Blank navigation
// ---------------------------------------------------------------------------

export const BLANK_NAVIGATION = {
  links: [
    { label: "Products", href: "/products" },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
    { label: "FAQ", href: "/faq" },
  ],
};

// ---------------------------------------------------------------------------
// Blank footer
// ---------------------------------------------------------------------------

export const BLANK_FOOTER = {
  sections: [
    {
      title: "Company",
      links: [
        { label: "About", href: "/about" },
        { label: "Contact", href: "/contact" },
      ],
    },
    {
      title: "Resources",
      links: [
        { label: "FAQ", href: "/faq" },
        { label: "Blog", href: "/blog" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms of Service", href: "/terms" },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Blank CSS variables
// ---------------------------------------------------------------------------

export const BLANK_STYLES_CSS = `:root {
  --primary: 160 84% 39%;
  --secondary: 160 64% 52%;
  --accent: 160 76% 46%;
  --background: 0 0% 100%;
  --foreground: 220 13% 18%;
}
`;
