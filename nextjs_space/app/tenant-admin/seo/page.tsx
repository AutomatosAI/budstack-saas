import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Search } from "lucide-react";
import { SeoPageClient } from "./seo-page-client";

export default async function SeoPage() {
  const user = await currentUser();

  if (
    !user ||
    (user.publicMetadata.role !== "TENANT_ADMIN" &&
      user.publicMetadata.role !== "SUPER_ADMIN")
  ) {
    redirect("/sign-in");
  }

  const email = user.emailAddresses[0]?.emailAddress;

  if (!email) {
    redirect("/sign-in");
  }

  const localUser = await prisma.users.findUnique({
    where: { email: email },
    select: { tenantId: true },
  });

  if (!localUser?.tenantId) {
    redirect("/tenant-admin");
  }

  const tenantId = localUser.tenantId;

  // Fetch tenant with subdomain and products/posts for SEO management
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

  // Build base URL for previews
  const baseUrl = tenant.customDomain
    ? `https://${tenant.customDomain}`
    : `https://${tenant.subdomain}.budstack.to`;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="text-center max-w-2xl mx-auto mb-8">
        <div className="section-badge mb-4 inline-flex">
          <Search className="h-4 w-4" />
          SEO
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          SEO Manager
        </h1>
        <p className="mt-3 text-muted-foreground mx-auto">
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
