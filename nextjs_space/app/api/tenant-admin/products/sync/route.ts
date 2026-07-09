import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { withTenantAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { fetchProducts } from "@/lib/drgreen/doctor-green-api";
import { getTenantDrGreenConfig } from "@/lib/tenant/tenant-config";
import { apiError } from "@/lib/api-error";
import { withDeleted } from "@/lib/soft-delete";

/**
 * POST /api/tenant-admin/products/sync
 * Pulls all strains from the Dr Green API and upserts them into the
 * tenant's `products` table. Auth: TENANT_ADMIN or SUPER_ADMIN.
 */
export const POST = withTenantAuth(async (_request, { tenantId }) => {
  try {
    // Get tenant country for currency mapping
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { countryCode: true },
    });
    const country = tenant?.countryCode || "ZA";

    // Fetch Dr Green credentials and pull products
    const config = await getTenantDrGreenConfig(tenantId);
    const dgProducts = await fetchProducts(country, config);

    let created = 0;
    let updated = 0;

    for (const dg of dgProducts) {
      const slug = dg.name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^\w-]/g, "");

      // Map strain_type string to Prisma enum value
      const strainType =
        dg.strain_type === "SATIVA"
          ? "SATIVA"
          : dg.strain_type === "INDICA"
            ? "INDICA"
            : "HYBRID";

      // Collect all image URLs
      const images: string[] = [];
      if (dg.imageUrl) images.push(dg.imageUrl);
      if (dg.strainImages) {
        for (const si of dg.strainImages) {
          if (si.strainImageUrl && !images.includes(si.strainImageUrl)) {
            images.push(si.strainImageUrl);
          }
        }
      }

      const data = {
        name: dg.name,
        slug,
        drGreenStrainId: dg.id, // canonical Dr Green strain UUID (the id used for cart/orders)
        description: dg.description || "",
        category: dg.type?.toLowerCase() || "flower",
        strainType: strainType as "SATIVA" | "INDICA" | "HYBRID",
        thcContent: dg.thc_content ?? null,
        cbdContent: dg.cbd_content ?? null,
        price: dg.price || 0,
        stock: dg.stock_quantity ?? 0,
        images,
        updatedAt: new Date(),
      };

      // Upsert on the unique (slug, tenantId) constraint so each tenant
      // gets their own copy of every strain and re-syncs are idempotent.
      //
      // findFirst (not findUnique w/ the slug_tenantId compound key): the
      // tenant-scope extension rewrites findUnique→findFirst and injects the
      // bound tenantId + deletedAt, and findFirst rejects the compound key.
      //
      // withDeleted: the (slug, tenantId) UNIQUE constraint is NOT
      // soft-delete-aware, so a previously soft-deleted product would slip past
      // the default deletedAt:null read and make create() throw P2002. Look it
      // up INCLUDING soft-deleted rows and revive it (deletedAt:null) on update.
      const existing = await withDeleted(() =>
        prisma.products.findFirst({ where: { slug } }),
      );

      if (existing) {
        await prisma.products.update({
          where: { id: existing.id },
          data: { ...data, deletedAt: null },
        });
        updated++;
      } else {
        await prisma.products.create({
          data: {
            id: randomUUID(),
            tenantId,
            ...data,
            displayOrder: created,
            createdAt: new Date(),
          },
        });
        created++;
      }
    }

    return NextResponse.json({
      success: true,
      created,
      updated,
      total: dgProducts.length,
    });
  } catch (error) {
    console.error("[sync-products]", error);
    return apiError(error, {
      route: "POST /api/tenant-admin/products/sync",
      safeMessage: "Failed to sync products",
    });
  }
});
