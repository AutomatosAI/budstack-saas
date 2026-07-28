import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions/require-page-permission";
import { getActiveAdminTenant } from "@/lib/tenant/active-admin-tenant";
import {
  OBJECTION_WINDOW_DAYS,
  type SubprocessorRecord,
} from "@/lib/legal/subprocessor-notice";
import OperatorSubprocessorView from "./objections-client";

/**
 * What operators see: who processes their customers' data, what is changing,
 * and how to object.
 *
 * The objection endpoint existed with nothing reaching it. A right that can
 * only be exercised by finding an email address on a legal page is not much of
 * a right. See docs/PRDS/prd-data-protection-remediation.md (WS3, US-014).
 */

export const dynamic = "force-dynamic";

export default async function OperatorSubprocessorsPage() {
  await requirePagePermission("canEditSettings");

  const active = await getActiveAdminTenant();
  if (!active) redirect("/auth/login");

  const entries: SubprocessorRecord[] = await prisma.subprocessors.findMany({
    where: { status: { in: ["active", "pending"] } },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  const mine = await prisma.subprocessor_objections.findMany({
    where: { tenantId: active.tenantId },
    orderBy: { createdAt: "desc" },
    include: { subprocessor: { select: { name: true } } },
  });

  return (
    <OperatorSubprocessorView
      entries={JSON.parse(JSON.stringify(entries))}
      objections={JSON.parse(JSON.stringify(mine))}
      objectionWindowDays={OBJECTION_WINDOW_DAYS}
    />
  );
}
