import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { prisma } from "@/lib/db";
import { format } from "date-fns";
import TenantEditForm from "./tenant-edit-form";

export default async function TenantDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "SUPER_ADMIN") {
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
    <div className="p-8">

      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              {tenant.businessName}
            </h1>
            <p className="text-slate-600 mt-2">
              Manage tenant details and configuration
            </p>
          </div>
          {tenant.isActive ? (
            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-lg px-4 py-1.5">
              Active
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              className="bg-slate-200 text-lg px-4 py-1.5"
            >
              Inactive
            </Badge>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Edit Form & Users */}
        <div className="lg:col-span-2 space-y-6">
          <TenantEditForm tenant={tenant} />

          <Card className="bg-white rounded-2xl border border-slate-200/50 shadow-2xl">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="flex items-center justify-between">
                <span>Users ({tenant.users.length})</span>
                <Badge variant="outline">
                  {tenant.users.length}{" "}
                  {tenant.users.length === 1 ? "User" : "Users"}
                </Badge>
              </CardTitle>
              <CardDescription>
                All users associated with this tenant
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {tenant.users.map((user: any) => (
                  <div
                    key={user.id}
                    className="flex justify-between items-center p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center font-semibold text-white shadow-md">
                        {user.name?.charAt(0).toUpperCase() || "?"}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          {user.name}
                        </p>
                        <p className="text-sm text-slate-600">{user.email}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-white">
                      {user.role}
                    </Badge>
                  </div>
                ))}
                {tenant.users.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-slate-500">
                      No users associated with this tenant yet
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Stats & Actions */}
        <div className="space-y-6">
          <Card className="bg-white rounded-2xl border border-slate-200/50 shadow-2xl">
            <CardHeader className="border-b border-slate-100">
              <CardTitle>Statistics</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">
                  Total Products
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                    <span className="text-2xl font-bold text-purple-700">
                      {tenant._count.products}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">Products listed</p>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">
                  Total Orders
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                    <span className="text-2xl font-bold text-amber-700">
                      {tenant._count.orders}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">Orders placed</p>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">
                  Total Users
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                    <span className="text-2xl font-bold text-blue-700">
                      {tenant.users.length}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">Registered users</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white rounded-2xl border border-slate-200/50 shadow-2xl">
            <CardHeader className="border-b border-slate-100">
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <TenantActions tenant={tenant} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Import the actions component (activate/deactivate/delete only)
import TenantActions from "./tenant-actions";
