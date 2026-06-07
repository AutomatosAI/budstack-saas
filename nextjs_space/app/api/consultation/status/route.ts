import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { getTenantFromRequest } from "@/lib/tenant/tenant";
import { apiError } from "@/lib/api-error";

export const GET = withAuth(async (req, { user }) => {
  try {
    const email = user.email;
    if (!email) {
      return apiError(new Error("Unauthorized"), {
        route: "GET /api/consultation/status",
        status: 401,
        safeMessage: "Unauthorized",
      });
    }

    const tenant = await getTenantFromRequest(req);
    if (!tenant) {
      return apiError(new Error("Tenant not found"), {
        route: "GET /api/consultation/status",
        status: 404,
        safeMessage: "Tenant not found",
      });
    }

    const consultation = await prisma.consultation_questionnaires.findFirst({
      where: {
        email: email,
        tenantId: tenant.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        drGreenClientId: true,
        kycLink: true,
        isKycVerified: true,
        adminApproval: true,
      },
    });

    if (!consultation) {
      return NextResponse.json({
        drGreenClientId: null,
        kycLink: null,
        isKycVerified: false,
        adminApproval: "PENDING",
      });
    }

    return NextResponse.json({
      drGreenClientId: consultation.drGreenClientId,
      kycLink: consultation.kycLink,
      isKycVerified: consultation.isKycVerified,
      adminApproval: consultation.adminApproval,
    });
  } catch (error: any) {
    console.error("Error fetching consultation status:", error);
    return apiError(error, {
      route: "GET /api/consultation/status",
      safeMessage: "Failed to fetch consultation status",
    });
  }
});
