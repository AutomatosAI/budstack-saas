import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { getTenantFromRequest } from "@/lib/tenant";

export const GET = withAuth(async (req, { user }) => {
  try {
    const email = user.email;
    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenant = await getTenantFromRequest(req);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
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
    return NextResponse.json(
      { error: "Failed to fetch consultation status" },
      { status: 500 },
    );
  }
});
