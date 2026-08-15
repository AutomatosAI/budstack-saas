import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { prisma } from "@/lib/db";
import type { PlatformLeadStatus } from "@prisma/client";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

const PAGE_SIZE = 50;

/** Chip colour per pipeline stage — worked leads read warmer than new ones. */
const STATUS_STYLES: Record<PlatformLeadStatus, string> = {
  NEW: "bg-bs-green-500/15 text-bs-green-300",
  CONTACTED: "bg-bs-gold-400/15 text-bs-gold-300",
  QUALIFIED: "bg-bs-gold-400/25 text-bs-gold-200",
  CONVERTED: "bg-bs-green-500/25 text-bs-green-200",
  UNSUBSCRIBED: "bg-bs-bg-2 text-bs-fg-2",
  REJECTED: "bg-bs-bg-2 text-bs-fg-2",
};

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Platform leads — prospective operators and investors captured on
 * budstacks.io (homepage CTA, Operator 101 download).
 *
 * Deliberately separate from tenant customers: these people have no store yet.
 */
export default async function SuperAdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const user = await currentUser();
  if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
    redirect("/auth/login");
  }

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const statusFilter = params.status;

  const where =
    statusFilter && statusFilter in STATUS_STYLES
      ? { status: statusFilter as PlatformLeadStatus }
      : {};

  const [leads, total, byStatus] = await Promise.all([
    prisma.platform_leads.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.platform_leads.count({ where }),
    prisma.platform_leads.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const counts = Object.fromEntries(
    byStatus.map((row) => [row.status, row._count._all]),
  ) as Partial<Record<PlatformLeadStatus, number>>;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="bs-page-title" style={sectionTitleStyle}>
          Leads
        </h1>
        <p className="bs-page-subtitle">
          Prospective operators and investors who asked to hear from us on
          budstacks.io. Every entry consented explicitly — the wording and
          timestamp are stored against the record.
        </p>
      </div>

      {/* Pipeline counts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {(Object.keys(STATUS_STYLES) as PlatformLeadStatus[]).map((status) => (
          <div key={status} className="bs-card p-4">
            <p className="text-2xl font-semibold text-bs-fg-0">
              {counts[status] ?? 0}
            </p>
            <p className="mt-1 text-xs uppercase tracking-wide text-bs-fg-2">
              {status.toLowerCase()}
            </p>
          </div>
        ))}
      </div>

      {leads.length === 0 ? (
        <div className="bs-card flex flex-col items-center gap-3 p-12 text-center">
          <UserPlus className="h-8 w-8 text-bs-fg-2" />
          <p className="text-bs-fg-1">No leads yet.</p>
          <p className="max-w-md text-sm text-bs-fg-2">
            The homepage guide form feeds this list. If it has been live a while
            and this is still empty, check that the capture endpoint is reachable
            and that the platform_leads table exists.
          </p>
        </div>
      ) : (
        <div className="bs-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-bs-border text-left text-xs uppercase tracking-wide text-bs-fg-2">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Captured</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-bs-border/50 last:border-0"
                  >
                    <td className="px-4 py-3">
                      <a
                        href={`mailto:${lead.email}`}
                        className="text-bs-fg-0 hover:text-bs-green-300"
                      >
                        {lead.email}
                      </a>
                      {lead.name && (
                        <span className="ml-2 text-bs-fg-2">{lead.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-bs-pill px-2.5 py-1 text-xs ${STATUS_STYLES[lead.status]}`}
                      >
                        {lead.status.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-bs-fg-1">{lead.source}</td>
                    <td className="px-4 py-3 text-bs-fg-1">
                      {lead.company || "—"}
                    </td>
                    <td className="px-4 py-3 text-bs-fg-2">
                      {formatDate(lead.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <p className="text-sm text-bs-fg-2">
          Page {page} of {totalPages} · {total} leads
        </p>
      )}
    </div>
  );
}
