import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
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
import { CheckCircle2, UserPlus } from "lucide-react";
import { RowPill } from "@/components/admin/shared";
import OnboardingActions from "./onboarding-actions";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

export default async function OnboardingPage() {
  const user = await currentUser();

  if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
    redirect("/auth/login");
  }

  const pendingRequests = await prisma.tenants.findMany({
    where: { isActive: false },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <div className="bs-page-header-compact">
        <div className="bs-eyebrow inline-flex items-center gap-1.5">
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Onboarding
        </div>
        <h1 className="bs-page-title" style={sectionTitleStyle}>
          Onboarding Requests
        </h1>
        <p className="bs-page-subtitle">
          Review and approve new tenant applications.
        </p>
      </div>

      <div className="bs-card overflow-hidden">
        <div className="bs-card-pad border-b border-bs-border-100">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2
                className="text-[22px] leading-tight text-bs-fg"
                style={sectionTitleStyle}
              >
                Pending Approvals ({pendingRequests.length})
              </h2>
              <p className="text-sm text-bs-fg-muted">
                Review and approve new tenant applications
              </p>
            </div>
            {pendingRequests.length > 0 && (
              <RowPill tone="amber">
                {pendingRequests.length} Waiting
              </RowPill>
            )}
          </div>
        </div>
        <div>
          {pendingRequests.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-bs-green/10 border border-bs-green/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2
                  className="h-8 w-8 text-bs-green"
                  aria-hidden="true"
                />
              </div>
              <p className="text-bs-fg font-medium">
                No pending onboarding requests
              </p>
              <p className="text-bs-fg-muted text-sm mt-1">
                All applications have been processed
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-bs-card-2/50">
                    <TableHead className="font-semibold text-bs-fg-muted">
                      Business Name
                    </TableHead>
                    <TableHead className="font-semibold text-bs-fg-muted hidden md:table-cell">
                      NFT Token ID
                    </TableHead>
                    <TableHead className="font-semibold text-bs-fg-muted hidden md:table-cell">
                      Subdomain
                    </TableHead>
                    <TableHead className="font-semibold text-bs-fg-muted hidden sm:table-cell">
                      Requested
                    </TableHead>
                    <TableHead className="font-semibold text-bs-fg-muted">
                      Status
                    </TableHead>
                    <TableHead className="font-semibold text-bs-fg-muted">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRequests.map((request: any) => (
                    <TableRow
                      key={request.id}
                      className="hover:bg-bs-card-2/40 transition-colors"
                    >
                      <TableCell className="font-medium text-bs-fg">
                        <div className="min-w-0">
                          <span className="block truncate">
                            {request.businessName}
                          </span>
                          <span className="block text-xs text-bs-green font-mono mt-0.5 md:hidden">
                            {request.subdomain}.budstack.io
                          </span>
                          <span className="block text-[10px] text-bs-fg-muted font-mono mt-0.5">
                            ID: {request.id}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-bs-fg-muted hidden md:table-cell">
                        {request.nftTokenId || (
                          <span className="text-bs-fg-muted">Not provided</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell font-mono">
                        <span className="text-bs-green font-medium">
                          {request.subdomain}
                        </span>
                        <span className="text-bs-fg-muted">.budstack.io</span>
                      </TableCell>
                      <TableCell className="text-bs-fg-muted text-sm font-mono hidden sm:table-cell">
                        {format(new Date(request.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <RowPill tone="amber">Pending</RowPill>
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
