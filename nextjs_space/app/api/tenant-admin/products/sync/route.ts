import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { withTenantAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { fetchProducts } from "@/lib/drgreen/doctor-green-api";
import { getTenantDrGreenConfig } from "@/lib/tenant/tenant-config";
import { apiError } from "@/lib/api-error";

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

      // Idempotent upsert on the (slug, tenantId) UNIQUE constraint.
      //
      // Why upsert (not findUnique/findFirst + create):
      //  - findUnique w/ the slug_tenantId compound key crashes: the tenant-scope
      //    extension rewrites findUnique→findFirst, which rejects the compound key.
      //  - a plain findFirst has `deletedAt: null` injected, so a previously
      //    SOFT-DELETED strain is invisible to it → create() collides on the
      //    unique constraint (P2002).
      //  upsert is NOT rewritten by the extension and matches on the real unique
      //  index (including soft-deleted rows), reviving them (deletedAt: null)
      //  instead of colliding. `tenantId` is injected into `create` by the
      //  extension (also passed explicitly here).
      //
      // The existence check only drives the created/updated tally shown to the
      // admin — the upsert is authoritative for the write. (A previously
      // soft-deleted strain is hidden from this read and so counts as "created"
      // even though the upsert revives it — a cosmetic tally detail only.)
      const existing = await prisma.products.findFirst({
        where: { slug },
        select: { id: true },
      });

      await prisma.products.upsert({
        where: { slug_tenantId: { slug, tenantId } },
        update: { ...data, deletedAt: null },
        create: {
          id: randomUUID(),
          tenantId,
          ...data,
          displayOrder: created,
          createdAt: new Date(),
        },
      });

      if (existing) {
        updated++;
      } else {
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
