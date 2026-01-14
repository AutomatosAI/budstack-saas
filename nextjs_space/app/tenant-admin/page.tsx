import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ShoppingBag,
  Package,
  ExternalLink,
  Users,
  LayoutDashboard,
  Store,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getTenantUrl } from "@/lib/tenant";
import { QuickActionsWidget } from "@/components/admin/QuickActionsWidget";

export default async function TenantAdminDashboard() {
  const session = await getServerSession(authOptions);

  if (
    !session ||
    !session.user?.id ||
    (session.user.role !== "TENANT_ADMIN" &&
      session.user.role !== "SUPER_ADMIN")
  ) {
    redirect("/auth/login");
  }

  const user = await prisma.users.findUnique({
    where: { id: session.user.id },
    include: {
      tenants: {
        include: {
          _count: {
            select: {
              products: true,
              orders: true,
              users: true,
            },
          },
        },
      },
    },
  });

  if (!user?.tenants) {
    redirect("/auth/login");
  }

  const tenant = user.tenants;
  const tenantStoreUrl = getTenantUrl(tenant);

  return (
    <div className="space-y-8">
      {/* Header */}
      {/* Centered Header */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <div className="section-badge mb-4 inline-flex">
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {tenant.businessName}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground mx-auto">
          Manage your storefront, branding, and operations with ease.
        </p>
      </div>

      {/* Store URL Card */}
      <div className="card-floating p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="icon-badge">
              <Store className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-medium text-foreground">Your Store URL</p>
              <p className="text-sm text-muted-foreground">{tenantStoreUrl}</p>
            </div>
          </div>
          <Link href={tenantStoreUrl} target="_blank">
            <Button variant="outline" className="rounded-xl">
              Visit Store
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Products Card */}
        <div className="card-floating p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                Total Products
              </p>
              <p className="font-display text-3xl font-bold tracking-tight text-foreground">
                {tenant._count.products}
              </p>
              <p className="text-xs text-muted-foreground">Active listings</p>
            </div>
            <div className="rounded-2xl bg-emerald-500 p-3">
              <Package className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>

        {/* Orders Card */}
        <div className="card-floating p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                Total Orders
              </p>
              <p className="font-display text-3xl font-bold tracking-tight text-foreground">
                {tenant._count.orders}
              </p>
              <p className="text-xs text-muted-foreground">All-time orders</p>
            </div>
            <div className="rounded-2xl bg-purple-600 p-3">
              <ShoppingBag className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>

        {/* Team Card */}
        <div className="card-floating p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                Team Members
              </p>
              <p className="font-display text-3xl font-bold tracking-tight text-foreground">
                {tenant._count.users}
              </p>
              <p className="text-xs text-muted-foreground">Active users</p>
            </div>
            <div className="rounded-2xl bg-primary p-3">
              <Users className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Widget */}
      <QuickActionsWidget />

      {/* Store Information Card */}
      <div className="card-floating p-8">
        <h2 className="font-display text-xl font-bold text-foreground mb-6">
          Store Information
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 rounded-2xl bg-slate-50 border border-slate-200 p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Store URL
            </p>
            <a
              href={tenantStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm font-medium text-accent hover:underline"
            >
              {tenantStoreUrl}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Custom Domain
            </p>
            <p className="text-sm font-medium text-foreground">
              {tenant.customDomain || "Not configured"}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              NFT Token ID
            </p>
            <p className="text-sm font-medium text-foreground">
              {tenant.nftTokenId || "Not set"}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Status
            </p>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${tenant.isActive
                ? "bg-emerald-100 text-emerald-700"
                : "bg-rose-100 text-rose-700"
                }`}
            >
              {tenant.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
