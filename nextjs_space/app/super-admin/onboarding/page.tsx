
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { prisma } from '@/lib/db';
import { format } from 'date-fns';
import OnboardingActions from './onboarding-actions';
import { Breadcrumbs } from '@/components/admin/shared';

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'SUPER_ADMIN') {
    redirect('/auth/login');
  }

  // Get pending onboarding requests (inactive tenants)
  const pendingRequests = await prisma.tenants.findMany({
    where: { isActive: false },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="p-8">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/super-admin' },
          { label: 'Onboarding' },
        ]}
        className="mb-4"
      />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Onboarding Requests</h1>
        <p className="text-slate-600 mt-2">Review and approve new tenant applications</p>
      </div>

      {/* Pending Approvals Table */}
      <Card className="shadow-lg border-slate-200">
        <CardHeader className="border-b bg-gradient-to-r from-amber-50 to-orange-50">
          <CardTitle className="flex items-center justify-between">
            <span>Pending Approvals ({pendingRequests.length})</span>
            {pendingRequests.length > 0 && (
              <Badge className="bg-amber-500 hover:bg-amber-600">
                {pendingRequests.length} Waiting
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Review and approve new tenant applications</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {pendingRequests.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">✓</span>
              </div>
              <p className="text-slate-500 font-medium">No pending onboarding requests</p>
              <p className="text-slate-400 text-sm mt-1">All applications have been processed</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead className="font-semibold">Business Name</TableHead>
                    <TableHead className="font-semibold">NFT Token ID</TableHead>
                    <TableHead className="font-semibold">Subdomain</TableHead>
                    <TableHead className="font-semibold">Requested</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRequests.map((request: any) => (
                    <TableRow key={request.id} className="hover:bg-slate-50 transition-colors">
                      <TableCell className="font-medium text-slate-900">{request.businessName}</TableCell>
                      <TableCell className="font-mono text-sm text-slate-600">
                        {request.nftTokenId || <span className="text-slate-400">Not provided</span>}
                      </TableCell>
                      <TableCell>
                        <span className="text-cyan-600 font-medium">{request.subdomain}</span>
                        <span className="text-slate-400">.budstack.io</span>
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">
                        {format(new Date(request.createdAt), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-200">
                          Pending
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <OnboardingActions tenantId={request.id} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
