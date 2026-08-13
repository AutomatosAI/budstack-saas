import { withTenantAuth } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";
import {
  STORE_SEO_PAGE_KEYS,
  dropLegacyStorePageSeoKeys,
} from "@/lib/seo/store-pages";

const seoPagesSchema = z
  .object({
    // SEO US-002: the enum IS the storefront's page list. A key the storefront
    // does not render (the retired `faq`, which /faq redirects away from) is no
    // longer writable, so the SEO Manager cannot offer an owner a page whose
    // metadata nothing would display.
    pageKey: z.enum(STORE_SEO_PAGE_KEYS),
    seo: z
      .object({
        title: z.string().max(300).optional(),
        description: z.string().max(1000).optional(),
        ogImage: z.string().max(2000).optional(),
      })
      .optional(),
  })
  .strict();

// GET - Fetch tenant page SEO
export const GET = withTenantAuth(async (_request, { tenantId }) => {
  const tenant = await prisma.tenants.findUnique({
    where: { id: tenantId },
    select: { pageSeo: true },
  });

  return NextResponse.json({ pageSeo: tenant?.pageSeo || {} });
});

// PUT - Update tenant page SEO
export const PUT = withTenantAuth(async (request, { tenantId }) => {
  let parsed;
  try {
    parsed = await parseJsonBody(request, seoPagesSchema);
  } catch (error) {
    return apiError(error, { route: "PUT /api/tenant-admin/seo/pages" });
  }
  const { pageKey, seo } = parsed;

  // Get current pageSeo
  const tenant = await prisma.tenants.findUnique({
    where: { id: tenantId },
    select: { pageSeo: true },
  });

  const currentPageSeo =
    (tenant?.pageSeo as Record<string, Record<string, string> | null>) || {};

  // Build SEO object for this page, removing empty values
  const pageSeoData: Record<string, string> = {};
  if (seo?.title?.trim()) pageSeoData.title = seo.title.trim();
  if (seo?.description?.trim())
    pageSeoData.description = seo.description.trim();
  if (seo?.ogImage?.trim()) pageSeoData.ogImage = seo.ogImage.trim();

  // Merge with existing data. Retiring the keys this one replaced is what keeps
  // the editor and the storefront honest: without it, clearing /support would
  // resurrect the old `faq` entry as the rendered metadata (readStorePageSeo
  // falls back to it) while the SEO Manager showed the page as Default.
  const updatedPageSeo: Record<string, Record<string, string> | null> = {
    ...dropLegacyStorePageSeoKeys(currentPageSeo, pageKey),
    [pageKey]: Object.keys(pageSeoData).length > 0 ? pageSeoData : null,
  };

  // Clean up null entries
  Object.keys(updatedPageSeo).forEach((key) => {
    if (updatedPageSeo[key] === null) {
      delete updatedPageSeo[key];
    }
  });

  const updated = await prisma.tenants.update({
    where: { id: tenantId },
    data: {
      pageSeo: Object.keys(updatedPageSeo).length > 0 ? updatedPageSeo : null,
      updatedAt: new Date(),
    },
    select: { pageSeo: true },
  });

  return NextResponse.json({ pageSeo: updated.pageSeo || {} });
});
