import { notFound } from "next/navigation";
import fs from "fs";
import path from "path";
import { TEMPLATE_COMPONENTS } from "@/lib/template-registry";
import { Tenant } from "@/types/client";
import PreviewToolbar from "./preview-toolbar";

// Mock tenant for preview mode — no database needed
const mockTenant: Tenant = {
  id: "preview-000",
  businessName: "Your Business Name",
  slug: "preview",
  domain: null,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  subdomain: "preview",
  settings: {
    tagline: "Your Cannabis Tagline Here",
    pageContent: {
      home: {
        heroTitle: "Welcome to Your Store",
        heroSubtitle: "Premium Cannabis, Delivered to Your Door",
      },
      homeHeroTitle: "Welcome to Your Store",
      homeHeroSubtitle: "Premium Cannabis, Delivered to Your Door",
      homeHeroDescription:
        "Discover our curated selection of premium medical cannabis products, backed by expert guidance and delivered with care.",
      aboutMission:
        "We are dedicated to providing the highest quality medical cannabis products and personalized care for your wellness journey.",
    },
  },
};

function loadDefaults(templateSlug: string): any | null {
  try {
    const defaultsPath = path.join(
      process.cwd(),
      "templates",
      templateSlug,
      "defaults.json"
    );
    if (fs.existsSync(defaultsPath)) {
      const raw = fs.readFileSync(defaultsPath, "utf-8");
      return JSON.parse(raw);
    }
  } catch {
    // defaults.json is optional
  }
  return null;
}

/** Only return the path if the file actually exists in /public */
function resolvePublicAsset(
  assetPath: string | null | undefined
): string | null {
  if (!assetPath) return null;
  if (!assetPath.startsWith("/")) return null;
  const fullPath = path.join(process.cwd(), "public", assetPath);
  return fs.existsSync(fullPath) ? assetPath : null;
}

export default async function TemplatePreviewPage({
  params,
}: {
  params: { templateSlug: string };
}) {
  const { templateSlug } = params;

  // Check if template exists in registry
  const TemplateComponent = TEMPLATE_COMPONENTS[templateSlug];
  if (!TemplateComponent) {
    notFound();
  }

  // Load template defaults for design system
  const defaults = loadDefaults(templateSlug);

  // Build template props matching what the real store provides
  const templateProps = {
    tenant: mockTenant,
    consultationUrl: "#consultation",
    productsUrl: "#products",
    contactUrl: "#contact",
    aboutUrl: "#about",
    heroImageUrl: resolvePublicAsset(defaults?.heroImagePath),
    logoUrl: resolvePublicAsset(defaults?.logoPath),
    designSystem: defaults?.designSystem || null,
    pageContent: defaults?.pageContent || null,
    navigation: defaults?.navigation || null,
    footer: defaults?.footer || null,
    posts: [],
  };

  // NO TenantThemeProvider here — templates bring their own styles.css
  // which defines :root CSS variables with raw HSL values.
  // TenantThemeProvider would double-wrap HSL in hsl() causing
  // hsl(hsl(270 15% 8%)) which is invalid CSS.
  // Templates use hsl(var(--tenant-color-*)) in their components,
  // which resolves correctly against the raw :root values.
  return (
    <>
      <PreviewToolbar templateName={defaults?.template || templateSlug} />
      <TemplateComponent {...templateProps} />
    </>
  );
}

export function generateMetadata({
  params,
}: {
  params: { templateSlug: string };
}) {
  return {
    title: `Preview: ${params.templateSlug} | BudStack Templates`,
    description: `Template preview for ${params.templateSlug}`,
  };
}
