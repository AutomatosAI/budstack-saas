import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { fetchProducts } from "@/lib/doctor-green-api";
import { getTenantDrGreenConfig } from "@/lib/tenant-config";

/**
 * POST /api/tenant-admin/products/sync
 * Pulls all strains from the Dr Green API and upserts them into the
 * tenant's `products` table. Auth: TENANT_ADMIN or SUPER_ADMIN.
 */
export async function POST() {
  try {
    const user = await currentUser();
    if (
      !user ||
      (user.publicMetadata.role !== "TENANT_ADMIN" &&
        user.publicMetadata.role !== "SUPER_ADMIN")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = user.emailAddresses[0]?.emailAddress;
    const localUser = await prisma.users.findFirst({
      where: { email },
      select: { tenantId: true },
    });

    if (!localUser?.tenantId) {
      return NextResponse.json(
        { error: "No tenant linked to this account" },
        { status: 400 },
      );
    }

    const tenantId = localUser.tenantId;

    // Get tenant country for currency mapping
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { countryCode: true },
    });
    const country = tenant?.countryCode || "SA";

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

      // Use Dr Green strain ID as the product ID so re-syncs are idempotent
      const existing = await prisma.products.findUnique({
        where: { id: dg.id },
      });

      if (existing && existing.tenantId === tenantId) {
        await prisma.products.update({ where: { id: dg.id }, data });
        updated++;
      } else if (!existing) {
        await prisma.products.create({
          data: {
            id: dg.id,
            tenantId,
            ...data,
            displayOrder: created,
            createdAt: new Date(),
          },
        });
        created++;
      }
      // If exists but belongs to another tenant, skip
    }

    return NextResponse.json({
      success: true,
      created,
      updated,
      total: dgProducts.length,
    });
  } catch (error) {
    console.error("[sync-products]", error);
    const message =
      error instanceof Error ? error.message : "Failed to sync products";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
