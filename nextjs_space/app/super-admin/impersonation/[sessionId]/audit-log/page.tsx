import { currentUser } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { prisma } from "@/lib/db";
import { runWithTenantContextAsync } from "@/lib/tenant/tenant-context";
import { getSessionById } from "@/lib/impersonation/sessions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const MAX_ROWS = 200;

interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  userEmail: string | null;
  ipAddress: string | null;
  createdAt: Date;
}

/**
 * PRD-302 AC-5: everything support did during one impersonation session —
 * every audit row stamped with this impersonationSessionId, super-admin
 * identity on each line, CSV download for compliance.
 */
export default async function ImpersonationAuditLogPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const user = await currentUser();
  if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
    redirect("/auth/login");
  }

  const session = await getSessionById(params.sessionId);
  if (!session) notFound();

  // audit_logs is a tenant-scoped model; bind an EXPLICIT null context for this
  // deliberate cross-tenant super-admin read (same convention as withSuperAdmin).
  const [rows, total] = await runWithTenantContextAsync(null, () =>
    Promise.all([
      prisma.audit_logs.findMany({
        where: { impersonationSessionId: session.id },
        orderBy: { createdAt: "asc" },
        take: MAX_ROWS,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          userEmail: true,
          ipAddress: true,
          createdAt: true,
        },
      }),
      prisma.audit_logs.count({
        where: { impersonationSessionId: session.id },
      }),
    ]),
  );
  const auditRows = rows as AuditRow[];

  const durationSeconds = Math.max(
    0,
    Math.floor(
      ((session.endedAt?.getTime() ?? Date.now()) -
        session.startedAt.getTime()) / 1000,
    ),
  );
  const durationLabel =
    durationSeconds >= 3600
      ? `${Math.floor(durationSeconds / 3600)}h ${Math.floor((durationSeconds % 3600) / 60)}m`
      : `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/super-admin/impersonation"
            className="mb-2 inline-flex items-center gap-1 text-sm text-bs-fg-muted hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> All sessions
          </Link>
          <h1 className="bs-page-title">Session audit log</h1>
          <p className="bs-page-subtitle">
            {session.tenantName} · impersonated by {session.superAdminEmail}
          </p>
        </div>
        <a
          href={`/api/super-admin/impersonation/sessions/${session.id}/audit-log?format=csv`}
          download
        >
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" aria-hidden /> Download CSV
          </Button>
        </a>
      </header>

      <section className="bs-card">
        <div className="bs-card-pad grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="bs-eyebrow">Started</p>
            <p>{session.startedAt.toLocaleString()}</p>
          </div>
          <div>
            <p className="bs-eyebrow">Status</p>
            <p>
              {session.endedAt ? (
                <>
                  Ended {session.endedAt.toLocaleString()}
                  <Badge variant="secondary" className="ml-2">
                    {session.endedReason ?? "completed"}
                  </Badge>
                </>
              ) : (
                <Badge className="bg-red-600 text-white hover:bg-red-600">
                  Active
                </Badge>
              )}
            </p>
          </div>
          <div>
            <p className="bs-eyebrow">Duration</p>
            <p>{durationLabel}</p>
          </div>
          <div>
            <p className="bs-eyebrow">Notes</p>
            <p className="text-sm">{session.notes ?? "—"}</p>
          </div>
        </div>
      </section>

      <section className="bs-card">
        <div className="bs-card-pad">
          <h2 className="bs-eyebrow mb-4">
            Actions ({total}
            {total > MAX_ROWS ? `, showing first ${MAX_ROWS}` : ""})
          </h2>
          <div className="overflow-x-auto">
            <table className="bs-table w-full">
              <thead>
                <tr>
                  <th className="text-left">Time</th>
                  <th className="text-left">Action</th>
                  <th className="text-left">Entity</th>
                  <th className="text-left">Super-Admin</th>
                  <th className="text-left">IP</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-bs-fg-muted">
                      No actions recorded in this session yet.
                    </td>
                  </tr>
                )}
                {auditRows.map((row) => (
                  <tr key={row.id}>
                    <td title={row.createdAt.toISOString()}>
                      {row.createdAt.toLocaleString()}
                    </td>
                    <td>
                      <code className="text-xs">{row.action}</code>
                    </td>
                    <td>
                      {row.entityType}
                      {row.entityId ? (
                        <span className="block max-w-[24ch] truncate text-xs text-bs-fg-muted">
                          {row.entityId}
                        </span>
                      ) : null}
                    </td>
                    <td>{row.userEmail ?? "—"}</td>
                    <td>{row.ipAddress ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
