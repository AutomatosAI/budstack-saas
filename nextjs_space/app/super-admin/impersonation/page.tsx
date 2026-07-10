import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { listSessions } from "@/lib/impersonation/sessions";
import { ImpersonationClient } from "./impersonation-client";

export const dynamic = "force-dynamic";

/**
 * PRD-302 AC-1/AC-3: the super-admin impersonation dashboard — search a tenant
 * to impersonate, plus the active/past sessions table. Sessions render
 * server-side for first paint; the client refetches on filter change / actions.
 */
export default async function ImpersonationPage() {
  const user = await currentUser();
  if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
    redirect("/auth/login");
  }

  const { sessions, total } = await listSessions({
    status: "all",
    limit: 50,
    offset: 0,
  });

  return (
    <ImpersonationClient
      currentSuperAdminEmail={user.emailAddresses[0]?.emailAddress ?? ""}
      initialTotal={total}
      initialSessions={sessions.map((s) => ({
        id: s.id,
        superAdminEmail: s.superAdminEmail,
        tenantId: s.tenantId,
        tenantName: s.tenantName,
        tenantEmail: s.tenantEmail,
        startedAt: s.startedAt.toISOString(),
        endedAt: s.endedAt ? s.endedAt.toISOString() : null,
        endedReason: s.endedReason,
        durationSeconds: s.durationSeconds,
        status: s.status,
        ipAddress: s.ipAddress,
        notes: s.notes,
      }))}
    />
  );
}
