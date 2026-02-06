import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getJsonFromS3, getTextFromS3 } from "@/lib/s3";
import { TemplateRenderer } from "@/components/template-renderer";
import type { TemplateLayout } from "@/lib/types/template-layout";
import type { SectionProps } from "@/lib/types/section-props";
import PreviewToolbar from "./preview-toolbar";

// Mock tenant for preview mode — no real tenant needed
const mockTenant = {
  id: "preview-000",
  businessName: "Your Business Name",
  subdomain: "preview",
  slug: "preview",
  domain: null,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  settings: {
    tagline: "Your Cannabis Tagline Here",
    pageContent: {
      homeHeroTitle: "Welcome to Your Store",
      homeHeroSubtitle: "Premium Cannabis, Delivered to Your Door",
      homeHeroDescription:
        "Discover our curated selection of premium medical cannabis products, backed by expert guidance and delivered with care.",
      aboutMission:
        "We are dedicated to providing the highest quality medical cannabis products and personalized care for your wellness journey.",
    },
  },
};

async function tryLoadJson<T>(key: string): Promise<T | null> {
  try {
    return await getJsonFromS3<T>(key);
  } catch {
    return null;
  }
}

export default async function TemplatePreviewPage({
  params,
}: {
  params: { templateSlug: string };
}) {
  const { templateSlug } = params;

  // Verify template exists in DB
  const dbTemplate = await prisma.templates.findFirst({
    where: { slug: templateSlug },
  });

  if (!dbTemplate) {
    notFound();
  }

  // Load layout.json from S3
  const layout = await tryLoadJson<TemplateLayout>(`templates/${templateSlug}/layout.json`);
  if (!layout) {
    notFound();
  }

  const defaults = await tryLoadJson<any>(`templates/${templateSlug}/defaults.json`);
  const customCss = await getTextFromS3(`templates/${templateSlug}/styles.css`);
  const googleFontsUrl = layout.settings?.googleFontsUrl || null;

  const sectionProps: SectionProps = {
    tenant: mockTenant,
    consultationUrl: "#consultation",
    productsUrl: "#products",
    contactUrl: "#contact",
    aboutUrl: "#about",
    heroImageUrl: null,
    logoUrl: null,
    designSystem: defaults?.designSystem || null,
    pageContent: defaults?.pageContent || null,
    navigation: defaults?.navigation || null,
    footer: defaults?.footer || null,
    valueProps: defaults?.valueProps || null,
    posts: [],
  };

  // No TenantThemeProvider for preview — the custom CSS from S3 provides
  // the :root CSS variables directly. TemplateRenderer injects the CSS.
  return (
    <>
      {googleFontsUrl && <link href={googleFontsUrl} rel="stylesheet" />}
      <PreviewToolbar templateName={dbTemplate.name || templateSlug} />
      <TemplateRenderer layout={layout} sectionProps={sectionProps} customCss={customCss} />
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
