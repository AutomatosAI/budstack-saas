import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { prisma } from "@/lib/db";
import { getTenantDrGreenConfig } from "@/lib/tenant-config";
import { fetchClient, fetchClientByEmail } from "@/lib/doctor-green-api";

export const dynamic = "force-dynamic";

/**
 * Super-admin KYC diagnostic.
 *
 * GET /api/super-admin/kyc-diagnose?email=X&slug=Y
 *   Reports the full chain for a given user/tenant:
 *     - users row (drGreenClientId, tenantId)
 *     - consultation_questionnaires (isKycVerified, adminApproval)
 *     - Dr Green API client (isActive, isKYCVerified, adminApproval)
 *     - Computed dashboard verdict (what checkUserKycStatus would return)
 */
export async function GET(req: NextRequest) {
  const superUser = await getCurrentUser();
  if (!superUser || superUser.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  const slug = req.nextUrl.searchParams.get("slug")?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "email query param required" }, { status: 400 });
  }

  const report: Record<string, any> = { email, slug };

  const tenant = slug
    ? await prisma.tenants.findFirst({
        where: { subdomain: { equals: slug, mode: "insensitive" } },
        select: { id: true, subdomain: true, businessName: true },
      })
    : null;
  report.tenant = tenant;

  const whereUser = tenant
    ? { email: { equals: email, mode: "insensitive" as const }, tenantId: tenant.id }
    : { email: { equals: email, mode: "insensitive" as const } };

  const dbUsers = await prisma.users.findMany({
    where: whereUser,
    select: {
      id: true,
      email: true,
      tenantId: true,
      drGreenClientId: true,
      role: true,
      createdAt: true,
    },
  });
  report.users = dbUsers;

  const tenantId = tenant?.id || dbUsers[0]?.tenantId;
  report.resolvedTenantId = tenantId;

  if (tenantId) {
    const questionnaires = await prisma.consultation_questionnaires.findMany({
      where: {
        tenantId,
        email: { equals: email, mode: "insensitive" },
      },
      orderBy: [{ isKycVerified: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        isKycVerified: true,
        adminApproval: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    report.questionnaires = questionnaires;
  }

  const drGreenClientId = dbUsers.find((u: { drGreenClientId: string | null }) => u.drGreenClientId)?.drGreenClientId;
  report.drGreenClientId = drGreenClientId || null;

  if (tenantId) {
    try {
      const config = await getTenantDrGreenConfig(tenantId);
      report.drGreenConfig = { apiUrl: config.apiUrl, hasKeys: !!config.apiKey && !!config.secretKey };

      let client: any = null;
      if (drGreenClientId) {
        try {
          client = await fetchClient(drGreenClientId, config);
          report.fetchClient = {
            source: "id",
            id: client.id,
            isActive: client.isActive,
            isKYCVerified: client.isKYCVerified,
            adminApproval: client.adminApproval,
            verifiedAt: client.verifiedAt ?? null,
            rejectedAt: client.rejectedAt ?? null,
          };
        } catch (err) {
          report.fetchClient = { source: "id", error: err instanceof Error ? err.message : String(err) };
        }
      }

      if (!client) {
        try {
          const byEmail = await fetchClientByEmail(email, config);
          if (byEmail) {
            report.fetchClientByEmail = {
              id: byEmail.id,
              isActive: byEmail.isActive,
              isKYCVerified: byEmail.isKYCVerified,
              adminApproval: byEmail.adminApproval,
              verifiedAt: byEmail.verifiedAt ?? null,
              rejectedAt: byEmail.rejectedAt ?? null,
            };
            client = byEmail;
          } else {
            report.fetchClientByEmail = { found: false };
          }
        } catch (err) {
          report.fetchClientByEmail = { error: err instanceof Error ? err.message : String(err) };
        }
      }

      if (client) {
        const isVerified =
          client.isActive === true &&
          (client.isKYCVerified === true || client.adminApproval === "VERIFIED");
        report.computedDashboardVerdict = {
          kycVerified: isVerified,
          status: client.isActive ? "ACTIVE" : "INACTIVE",
        };
      }
    } catch (err) {
      report.drGreenConfigError = err instanceof Error ? err.message : String(err);
    }
  }

  return NextResponse.json(report);
}
