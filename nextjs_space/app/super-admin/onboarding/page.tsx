import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { format } from "date-fns";
import { UserPlus } from "lucide-react";
import OnboardingActions from "./onboarding-actions";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "SUPER_ADMIN") {
    redirect("/auth/login");
  }

  // Get pending onboarding requests (inactive tenants)
  const pendingRequests = await prisma.tenants.findMany({
    where: { isActive: false },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8">
      {/* Centered Header */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="section-badge mb-4 inline-flex">
          <UserPlus className="h-4 w-4" />
          Onboarding
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Onboarding Requests
        </h1>
        <p className="mt-3 text-muted-foreground">
          Review and approve new tenant applications
        </p>
      </div>

      {/* Pending Approvals Table */}
      <div className="card-floating overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">
                Pending Approvals ({pendingRequests.length})
              </h2>
              <p className="text-sm text-muted-foreground">
                Review and approve new tenant applications
              </p>
            </div>
            {pendingRequests.length > 0 && (
              <Badge className="bg-primary hover:bg-primary/90">
                {pendingRequests.length} Waiting
              </Badge>
            )}
          </div>
        </div>
        <div>
          {pendingRequests.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">✓</span>
              </div>
              <p className="text-foreground font-medium">
                No pending onboarding requests
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                All applications have been processed
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead className="font-semibold">
                      Business Name
                    </TableHead>
                    <TableHead className="font-semibold hidden md:table-cell">
                      NFT Token ID
                    </TableHead>
                    <TableHead className="font-semibold hidden md:table-cell">
                      Subdomain
                    </TableHead>
                    <TableHead className="font-semibold hidden sm:table-cell">
                      Requested
                    </TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRequests.map((request: any) => (
                    <TableRow
                      key={request.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <TableCell className="font-medium text-foreground">
                        <div className="min-w-0">
                          <span className="block truncate">
                            {request.businessName}
                          </span>
                          {/* Show subdomain on mobile where it's hidden from column */}
                          <span className="block text-xs text-accent mt-0.5 md:hidden">
                            {request.subdomain}.budstack.io
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground hidden md:table-cell">
                        {request.nftTokenId || (
                          <span className="text-slate-400">Not provided</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-accent font-medium">
                          {request.subdomain}
                        </span>
                        <span className="text-slate-400">.budstack.io</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm hidden sm:table-cell">
                        {format(new Date(request.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="bg-amber-100 text-amber-700 hover:bg-amber-200"
                        >
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
        </div>
      </div>
    </div>
  );
}
