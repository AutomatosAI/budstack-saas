
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingBag, Package, Palette, Settings, ExternalLink, BarChart3, Shield, Webhook, Newspaper, Users } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getTenantUrl } from '@/lib/tenant';
import { QuickActionsWidget } from '@/components/admin/QuickActionsWidget';

export default async function TenantAdminDashboard() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user.role !== 'TENANT_ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    redirect('/auth/login');
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
    redirect('/auth/login');
  }

  const tenant = user.tenants;

  // If user is logged in with a different account or needs to access via store URL
  // Provide a helpful message with the correct URL
  const tenantStoreUrl = getTenantUrl(tenant);
  const tenantUrl = getTenantUrl(tenant);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Tenant Admin Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Managing: <span className="font-semibold">{tenant.businessName}</span>
        </p>

        {/* Store URL Info */}
        <div className="mt-4 p-4 bg-accent/10 border border-accent/20 rounded-lg flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ExternalLink className="h-5 w-5 text-accent" />
            <div>
              <p className="text-sm font-medium">Your Store URL</p>
              <p className="text-xs text-muted-foreground">{tenantStoreUrl}</p>
            </div>
          </div>
          <Link href={tenantStoreUrl} target="_blank">
            <Button
              size="sm"
              className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium shadow-sm hover:shadow transition-all"
            >
              Visit Store
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-white text-slate-900 border-slate-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b bg-gradient-to-r from-emerald-50 to-teal-50">
            <CardTitle className="text-sm font-semibold text-slate-900">Total Products</CardTitle>
            <Package className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">{tenant._count.products}</div>
            <p className="text-xs text-slate-600 font-medium tracking-wide mt-1">Active listings</p>
          </CardContent>
        </Card>

        <Card className="bg-white text-slate-900 border-slate-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b bg-gradient-to-r from-purple-50 to-pink-50">
            <CardTitle className="text-sm font-semibold text-slate-900">Total Orders</CardTitle>
            <ShoppingBag className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">{tenant._count.orders}</div>
            <p className="text-xs text-slate-600 font-medium tracking-wide mt-1">All time</p>
          </CardContent>
        </Card>

        <Card className="bg-white text-slate-900 border-slate-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b bg-gradient-to-r from-cyan-50 to-blue-50">
            <CardTitle className="text-sm font-semibold text-slate-900">Team Members</CardTitle>
            <Users className="h-5 w-5 text-cyan-600" />
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">{tenant._count.users}</div>
            <p className="text-xs text-slate-600 font-medium tracking-wide mt-1">Active users</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions Widget */}
      <div className="mb-8">
        <QuickActionsWidget />
      </div>

      {/* Store Info */}
      <div className="mt-8">
        <Card className="bg-white text-slate-900 border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Store Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
              <div>
                <p className="text-sm font-semibold text-slate-500 uppercase">Store URL</p>
                <a href={tenantUrl} target="_blank" rel="noopener noreferrer" className="text-base text-blue-600 font-medium hover:underline flex items-center gap-1 mt-1">
                  {tenantUrl}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 uppercase">Custom Domain</p>
                <p className="text-base text-slate-900 font-medium mt-1">{tenant.customDomain || 'Not configured'}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 uppercase">NFT Token ID</p>
                <p className="text-base text-slate-900 font-medium mt-1">{tenant.nftTokenId || 'Not set'}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 uppercase">Status</p>
                <div className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${tenant.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {tenant.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
