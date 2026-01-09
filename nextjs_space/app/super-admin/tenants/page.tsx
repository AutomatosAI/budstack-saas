
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { prisma } from '@/lib/db';
import { format } from 'date-fns';
import { getTenantUrl } from '@/lib/tenant';
import { ExternalLink } from 'lucide-react';

export default async function TenantsPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'SUPER_ADMIN') {
    redirect('/auth/login');
  }

  const tenants = await prisma.tenants.findMany({
    include: {
      _count: {
        select: {
          users: true,
          products: true,
          orders: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Tenant Management</h1>
            <p className="text-slate-600 mt-2">Manage all tenant accounts and NFT holders</p>
          </div>
          <Link href="/super-admin/onboarding">
            <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-medium shadow-md hover:shadow-lg transition-all">
              Review Applications
            </Button>
          </Link>
        </div>
      </div>

      {/* Tenants Table */}
      <Card className="shadow-lg border-slate-200">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-slate-100">
          <CardTitle className="flex items-center justify-between">
            <span>All Tenants ({tenants.length})</span>
            <Badge variant="outline" className="text-sm font-normal">
              {tenants.filter((t: any) => t.isActive).length} Active
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="font-semibold">Business Name</TableHead>
                  <TableHead className="font-semibold">NFT Token ID</TableHead>
                  <TableHead className="font-semibold">Store URL</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold text-center">Users</TableHead>
                  <TableHead className="font-semibold text-center">Products</TableHead>
                  <TableHead className="font-semibold text-center">Orders</TableHead>
                  <TableHead className="font-semibold">Created</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant: any) => {
                  const tenantUrl = getTenantUrl(tenant);
                  return (
                    <TableRow key={tenant.id} className="hover:bg-slate-50 transition-colors">
                      <TableCell className="font-medium text-slate-900">{tenant.businessName}</TableCell>
                      <TableCell className="text-slate-600 font-mono text-sm">
                        {tenant.nftTokenId || <span className="text-slate-400">N/A</span>}
                      </TableCell>
                      <TableCell>
                        <a
                          href={tenantUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-600 hover:text-cyan-700 hover:underline flex items-center gap-1 transition-colors"
                        >
                          <span className="truncate max-w-[200px]">{tenantUrl}</span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                      </TableCell>
                      <TableCell>
                        {tenant.isActive ? (
                          <Badge className="bg-emerald-500 hover:bg-emerald-600">Active</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-slate-200">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
                          {tenant._count.users}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-700 text-sm font-medium">
                          {tenant._count.products}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-700 text-sm font-medium">
                          {tenant._count.orders}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">
                        {format(new Date(tenant.createdAt), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Link href={`/super-admin/tenants/${tenant.id}`}>
                          <Button variant="outline" size="sm" className="hover:bg-cyan-50 hover:text-cyan-700 hover:border-cyan-300 transition-colors">
                            Manage
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
