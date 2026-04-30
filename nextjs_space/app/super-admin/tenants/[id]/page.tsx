import { currentUser } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Package,
  ShoppingBag,
  Users as UsersIcon,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { RowPill } from "@/components/admin/shared";
import TenantEditForm from "./tenant-edit-form";
import TenantActions from "./tenant-actions";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

export default async function TenantDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await currentUser();

  if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
    redirect("/auth/login");
  }

  const tenant = await prisma.tenants.findUnique({
    where: { id: params.id },
    include: {
      users: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          products: true,
          orders: true,
        },
      },
    },
  });

  if (!tenant) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <Link
        href="/super-admin/tenants"
        className="inline-flex items-center text-sm text-bs-fg-muted hover:text-bs-fg"
      >
        <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
        Back to Tenants
      </Link>

      <div className="bs-page-header-centered">
        <div className="bs-eyebrow inline-flex items-center gap-1.5">
          <Building2 className="h-4 w-4" aria-hidden="true" />
          Tenant Detail
        </div>
        <h1 className="bs-page-title" style={sectionTitleStyle}>
          {tenant.businessName}
        </h1>
        <p className="bs-page-subtitle">
          Manage tenant details, configuration, and platform access.
        </p>
        <div className="mt-4 flex items-center justify-center gap-3 flex-wrap">
          <RowPill tone={tenant.isActive ? "emerald" : "slate"}>
            {tenant.isActive ? "Active" : "Inactive"}
          </RowPill>
          <span className="font-mono text-xs text-bs-fg-muted">
            ID: {tenant.id}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Edit Form & Users */}
        <div className="lg:col-span-2 space-y-6">
          <TenantEditForm tenant={tenant} />

          <section className="bs-card bs-card-pad">
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-[22px] leading-tight text-bs-fg"
                style={sectionTitleStyle}
              >
                Users ({tenant.users.length})
              </h2>
              <RowPill tone="blue">
                {tenant.users.length}{" "}
                {tenant.users.length === 1 ? "User" : "Users"}
              </RowPill>
            </div>
            <p className="text-sm text-bs-fg-muted mb-6">
              All users associated with this tenant.
            </p>

            <div className="space-y-3">
              {tenant.users.map((u: any) => (
                <div
                  key={u.id}
                  className="flex justify-between items-center p-4 rounded-bs-md bg-bs-card-2/50 hover:bg-bs-card-2 transition-colors border border-bs-border-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-bs-green text-bs-canvas flex items-center justify-center font-semibold">
                      {u.name?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="font-medium text-bs-fg">{u.name}</p>
                      <p className="text-sm text-bs-fg-muted font-mono">
                        {u.email}
                      </p>
                    </div>
                  </div>
                  <RowPill tone="slate">{u.role}</RowPill>
                </div>
              ))}
              {tenant.users.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-bs-fg-muted">
                    No users associated with this tenant yet.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Column - Stats & Actions */}
        <div className="space-y-6">
          <section className="bs-card bs-card-pad">
            <h2
              className="text-[22px] leading-tight text-bs-fg mb-6"
              style={sectionTitleStyle}
            >
              Statistics
            </h2>
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-bs-md bg-bs-card-2 border border-bs-border-100 flex items-center justify-center">
                  <Package
                    className="h-5 w-5 text-bs-green"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <p className="text-2xl font-medium text-bs-fg leading-none">
                    {tenant._count.products}
                  </p>
                  <p className="text-sm text-bs-fg-muted mt-1">
                    Products listed
                  </p>
                </div>
              </div>
              <div className="border-t border-bs-border-100" />
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-bs-md bg-bs-card-2 border border-bs-border-100 flex items-center justify-center">
                  <ShoppingBag
                    className="h-5 w-5 text-bs-gold"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <p className="text-2xl font-medium text-bs-fg leading-none">
                    {tenant._count.orders}
                  </p>
                  <p className="text-sm text-bs-fg-muted mt-1">
                    Orders placed
                  </p>
                </div>
              </div>
              <div className="border-t border-bs-border-100" />
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-bs-md bg-bs-card-2 border border-bs-border-100 flex items-center justify-center">
                  <UsersIcon
                    className="h-5 w-5 text-bs-info"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <p className="text-2xl font-medium text-bs-fg leading-none">
                    {tenant.users.length}
                  </p>
                  <p className="text-sm text-bs-fg-muted mt-1">
                    Registered users
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="bs-card bs-card-pad">
            <h2
              className="text-[22px] leading-tight text-bs-fg mb-4"
              style={sectionTitleStyle}
            >
              Actions
            </h2>
            <TenantActions tenant={tenant} />
          </section>
        </div>
      </div>
    </div>
  );
}
