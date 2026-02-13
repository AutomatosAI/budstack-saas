import { notFound } from "next/navigation";
import fs from "fs";
import path from "path";
import { TEMPLATE_COMPONENTS } from "@/lib/template-registry";
import { TemplateRenderer } from "@/components/template-renderer";
import { getJsonFromS3, getTextFromS3 } from "@/lib/s3";
import type { TemplateLayout } from "@/lib/types/template-layout";
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

function loadLocalDefaults(templateSlug: string): any | null {
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

  // PATH 1: Try data-driven template (layout.json in S3)
  let layout: TemplateLayout | null = null;
  let customCss: string | null = null;
  let defaults: any = null;

  try {
    layout = await getJsonFromS3<TemplateLayout>(`templates/${templateSlug}/layout.json`);
    if (layout) {
      customCss = await getTextFromS3(`templates/${templateSlug}/styles.css`);
      defaults = await getJsonFromS3(`templates/${templateSlug}/defaults.json`).catch(() => null);
    }
  } catch {
    // No layout.json in S3
  }

  if (layout) {
    const sectionProps = {
      tenant: { ...mockTenant, subdomain: mockTenant.slug },
      consultationUrl: "#consultation",
      productsUrl: "#products",
      contactUrl: "#contact",
      aboutUrl: "#about",
      heroImageUrl: null,
      logoUrl: null,
      pageContent: defaults?.pageContent || {},
      navigation: defaults?.navigation || {},
      footer: defaults?.footer || {},
      valueProps: defaults?.valueProps || [],
    };

    return (
      <>
        <PreviewToolbar templateName={defaults?.template || templateSlug} />
        <TemplateRenderer
          layout={layout}
          sectionProps={sectionProps}
          customCss={customCss}
          renderChrome={true}
        />
      </>
    );
  }

  // PATH 2: Legacy React template (bundled at build time)
  const TemplateComponent = TEMPLATE_COMPONENTS[templateSlug];
  if (!TemplateComponent) {
    notFound();
  }

  const localDefaults = loadLocalDefaults(templateSlug);

  const templateProps = {
    tenant: mockTenant,
    consultationUrl: "#consultation",
    productsUrl: "#products",
    contactUrl: "#contact",
    aboutUrl: "#about",
    heroImageUrl: resolvePublicAsset(localDefaults?.heroImagePath),
    logoUrl: resolvePublicAsset(localDefaults?.logoPath),
    designSystem: localDefaults?.designSystem || null,
    pageContent: localDefaults?.pageContent || null,
    navigation: localDefaults?.navigation || null,
    footer: localDefaults?.footer || null,
    posts: [],
  };

  return (
    <>
      <PreviewToolbar templateName={localDefaults?.template || templateSlug} />
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
    title: `Preview: ${params.templateSlug} | BudStacks Templates`,
    description: `Template preview for ${params.templateSlug}`,
  };
}
