import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ShoppingBag,
  Package,
  ExternalLink,
  Users,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getTenantUrl } from "@/lib/tenant";
import { QuickActionsWidget } from "@/components/admin/QuickActionsWidget";

export default async function TenantAdminDashboard() {
  const session = await getServerSession(authOptions);

  if (
    !session ||
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
    // Redirect to login if user has no tenant associated
    redirect("/auth/login");
  }

  const tenant = user.tenants;

  // If user is logged in with a different account or needs to access via store URL
  // Provide a helpful message with the correct URL
  const tenantStoreUrl = getTenantUrl(tenant);
  const tenantUrl = getTenantUrl(tenant);

  return (
    <div className="min-h-screen saas-shell">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <span className="saas-pill text-slate-600">Tenant Admin</span>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">
            {tenant.businessName}
          </h1>
          <p className="mt-2 max-w-2xl text-slate-500">
            Manage your storefront, branding, and operations with the same
            clarity as the public site.
          </p>

          {/* Store URL Info */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                <ExternalLink className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Your Store URL
                </p>
                <p className="text-xs text-slate-500">{tenantStoreUrl}</p>
              </div>
            </div>
            <Link href={tenantStoreUrl} target="_blank">
              <Button
                size="sm"
                className="border border-slate-200 bg-white text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900"
              >
                Visit Store
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

      {/* Stats Grid */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card className="saas-card border-0 p-5">
            <CardHeader className="space-y-3 p-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-600">
                  Total Products
                </CardTitle>
                <div className="rounded-full bg-emerald-100 p-2">
                  <Package className="h-4 w-4 text-emerald-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 pt-6">
              <div className="text-3xl font-semibold text-slate-900">
                {tenant._count.products}
              </div>
              <p className="mt-2 text-xs font-medium text-slate-500">
                Active listings
              </p>
            </CardContent>
          </Card>

          <Card className="saas-card border-0 p-5">
            <CardHeader className="space-y-3 p-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-600">
                  Total Orders
                </CardTitle>
                <div className="rounded-full bg-purple-100 p-2">
                  <ShoppingBag className="h-4 w-4 text-purple-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 pt-6">
              <div className="text-3xl font-semibold text-slate-900">
                {tenant._count.orders}
              </div>
              <p className="mt-2 text-xs font-medium text-slate-500">
                All-time orders
              </p>
            </CardContent>
          </Card>

          <Card className="saas-card border-0 p-5">
            <CardHeader className="space-y-3 p-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-600">
                  Team Members
                </CardTitle>
                <div className="rounded-full bg-cyan-100 p-2">
                  <Users className="h-4 w-4 text-cyan-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 pt-6">
              <div className="text-3xl font-semibold text-slate-900">
                {tenant._count.users}
              </div>
              <p className="mt-2 text-xs font-medium text-slate-500">
                Active users
              </p>
            </CardContent>
          </Card>
        </div>

      {/* Quick Actions Widget */}
      <div className="mb-8">
        <QuickActionsWidget />
      </div>

      {/* Store Info */}
        <div className="mt-8">
          <Card className="saas-card border-0 p-6">
            <CardHeader className="p-0 pb-6">
              <CardTitle className="text-2xl font-semibold text-slate-900">
                Store Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-5 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Store URL
                  </p>
                  <a
                    href={tenantUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline"
                  >
                    {tenantUrl}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Custom Domain
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {tenant.customDomain || "Not configured"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    NFT Token ID
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {tenant.nftTokenId || "Not set"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </p>
                  <div className="mt-2">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${tenant.isActive ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}
                    >
                      {tenant.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
