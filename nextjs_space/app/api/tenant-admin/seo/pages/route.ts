import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";
import { requirePermission } from "@/lib/permissions/require-permission";
import { STORE_SEO_PAGE_KEYS } from "@/lib/seo/store-pages";
import { writeStorePageSeo } from "@/lib/seo/page-seo-write";

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
export const GET = requirePermission("canViewSeo", async (_request, { tenantId }) => {
  const tenant = await prisma.tenants.findUnique({
    where: { id: tenantId },
    select: { pageSeo: true },
  });

  return NextResponse.json({ pageSeo: tenant?.pageSeo || {} });
});

// PUT - Update tenant page SEO
export const PUT = requirePermission("canEditSeo", async (request, { tenantId }) => {
  let parsed;
  try {
    parsed = await parseJsonBody(request, seoPagesSchema);
  } catch (error) {
    return apiError(error, { route: "PUT /api/tenant-admin/seo/pages" });
  }
  const { pageKey, seo } = parsed;

  // US-010: ONE statement, not read-modify-write. Every authorable page shares
  // this single `tenants.pageSeo` blob, so the old SELECT-merge-UPDATE lost a
  // concurrent save of a DIFFERENT page — see lib/seo/page-seo-write.ts.
  const pageSeo = await writeStorePageSeo(tenantId, pageKey, seo);

  if (pageSeo === null) {
    return apiError(new Error("Tenant not found"), {
      route: "PUT /api/tenant-admin/seo/pages",
      status: 404,
      safeMessage: "Store not found",
    });
  }

  return NextResponse.json({ pageSeo });
});
