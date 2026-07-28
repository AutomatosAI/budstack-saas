import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { MIN_NOTICE_DAYS, type SubprocessorRecord } from "@/lib/legal/subprocessor-notice";
import SubprocessorRegister from "./register-client";

/**
 * Sub-processor register management.
 *
 * Adding a vendor here starts a clock that ends in an email to every operator,
 * so the screen is deliberately explicit about the difference between saving a
 * draft and announcing it. See docs/PRDS/prd-data-protection-remediation.md
 * (WS3, US-012).
 */

export const dynamic = "force-dynamic";

interface RegisterRow extends SubprocessorRecord {
  _count: { objections: number };
}

export default async function SubprocessorsAdminPage() {
  const user = await currentUser();

  if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
    redirect("/auth/login");
  }

  // Annotated because `prisma` is exported as `any`.
  const entries: RegisterRow[] = await prisma.subprocessors.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: { _count: { select: { objections: { where: { status: "open" } } } } },
  });

  const openObjections = await prisma.subprocessor_objections.findMany({
    where: { status: "open" },
    orderBy: { createdAt: "desc" },
    include: {
      subprocessor: { select: { name: true } },
      tenants: { select: { businessName: true } },
    },
  });

  return (
    <SubprocessorRegister
      entries={JSON.parse(JSON.stringify(entries))}
      objections={JSON.parse(JSON.stringify(openObjections))}
      minNoticeDays={MIN_NOTICE_DAYS}
      todayIso={new Date().toISOString()}
    />
  );
}
