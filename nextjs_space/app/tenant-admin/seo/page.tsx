import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getTenantBaseUrl } from "@/lib/tenant-utils";
import { Search } from "lucide-react";
import { SeoPageClient } from "./seo-page-client";

export default async function SeoPage() {
  const user = await currentUser();

  if (
    !user ||
    (user.publicMetadata.role !== "TENANT_ADMIN" &&
      user.publicMetadata.role !== "SUPER_ADMIN")
  ) {
    redirect("/auth/login");
  }

  const email = user.emailAddresses[0]?.emailAddress;

  if (!email) {
    redirect("/auth/login");
  }

  const localUser = await prisma.users.findUnique({
    where: { email: email },
    select: { tenantId: true },
  });

  if (!localUser?.tenantId) {
    redirect("/tenant-admin");
  }

  const tenantId = localUser.tenantId;

  const [tenant, products, posts] = await Promise.all([
    prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        subdomain: true,
        customDomain: true,
        businessName: true,
        pageSeo: true,
      },
    }),
    prisma.products.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        seo: true,
        images: true,
      },
    }),
    prisma.posts.findMany({
      where: { tenantId },
      orderBy: { title: "asc" },
      select: {
        id: true,
        title: true,
        slug: true,
        seo: true,
        coverImage: true,
      },
    }),
  ]);

  if (!tenant) {
    redirect("/tenant-admin");
  }

  const baseUrl = getTenantBaseUrl(tenant);

  return (
    <div>
      <div className="bs-page-header-centered">
        <h1 className="bs-page-title">SEO Manager</h1>
        <p className="bs-page-subtitle">
          Optimize how your store appears in search engines and social media.
        </p>
      </div>

      <SeoPageClient
        tenantId={tenantId}
        baseUrl={baseUrl}
        products={products}
        posts={posts}
        pageSeo={
          tenant.pageSeo as Record<
            string,
            { title?: string; description?: string; ogImage?: string }
          > | null
        }
      />
    </div>
  );
}
