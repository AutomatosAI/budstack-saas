import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ShoppingBag,
  Package,
  ExternalLink,
  Users,
  Store,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getActiveAdminTenant } from "@/lib/tenant/active-admin-tenant";
import { getTenantUrl } from "@/lib/tenant/tenant-utils";
import { QuickActionsWidget } from "@/components/admin/QuickActionsWidget";
import { StatCard } from "@/components/admin/shared/StatCard";

export default async function TenantAdminDashboard() {
  // PRD-302: impersonation-aware — renders the impersonated tenant when a
  // super-admin is impersonating, else the admin's own (unchanged).
  const active = await getActiveAdminTenant();
  if (!active) {
    redirect("/auth/login");
  }

  const tenant = await prisma.tenants.findUnique({
    where: { id: active.tenantId },
    include: {
      _count: {
        select: {
          products: true,
          orders: true,
          users: true,
        },
      },
    },
  });

  if (!tenant) {
    redirect("/auth/login");
  }
  const tenantStoreUrl = getTenantUrl(tenant);

  return (
    <div className="space-y-8">
      <header className="bs-page-header-centered">
        <h1
          className="bs-page-title"
          style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
        >
          {tenant.businessName}
        </h1>
        <p className="bs-page-subtitle">
          Manage your storefront, branding, and operations with ease.
        </p>
      </header>

      {/* Store URL Card */}
      <section className="bs-card bs-card-pad">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="rounded-xl border border-bs-border-100 bg-bs-card-2 p-2.5">
              <Store className="h-5 w-5 text-bs-green-soft" aria-hidden="true" />
            </div>
            <div className="space-y-0.5">
              <p className="font-medium text-bs-fg">Your Store URL</p>
              <p className="font-mono text-sm text-bs-fg-muted">{tenantStoreUrl}</p>
            </div>
          </div>
          <Link href={tenantStoreUrl} target="_blank" className="bs-btn bs-btn-ghost">
            <span>Visit Store</span>
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <StatCard
          label="Total Products"
          value={tenant._count.products}
          icon={Package}
          hint="Active listings"
        />
        <StatCard
          label="Total Orders"
          value={tenant._count.orders}
          icon={ShoppingBag}
          hint="All-time orders"
        />
        <StatCard
          label="Team Members"
          value={tenant._count.users}
          icon={Users}
          hint="Active users"
        />
      </div>

      <QuickActionsWidget />

      {/* Store Information Card */}
      <section className="bs-card bs-card-pad">
        <h2
          className="mb-6 font-display text-[22px] text-bs-fg"
          style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
        >
          Store Information
        </h2>
        <div className="grid grid-cols-1 gap-6 rounded-bs-md border border-bs-border-100 bg-bs-card-2 p-6 md:grid-cols-2">
          <div className="space-y-2">
            <p className="bs-eyebrow">Store URL</p>
            <a
              href={tenantStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-mono text-sm font-medium text-bs-green-soft hover:underline"
            >
              {tenantStoreUrl}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="space-y-2">
            <p className="bs-eyebrow">Custom Domain</p>
            <p className="text-sm font-medium text-bs-fg">
              {tenant.customDomain || "Not configured"}
            </p>
          </div>
          <div className="space-y-2">
            <p className="bs-eyebrow">NFT Token ID</p>
            <p className="font-mono text-sm font-medium text-bs-fg">
              {tenant.nftTokenId || "Not set"}
            </p>
          </div>
          <div className="space-y-2">
            <p className="bs-eyebrow">Status</p>
            <span
              className={
                tenant.isActive ? "bs-chip bs-chip-green" : "bs-chip bs-chip-danger"
              }
            >
              {tenant.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
