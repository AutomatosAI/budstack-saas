import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find the most recent consultation for this user
    const consultation = await prisma.consultation_questionnaires.findFirst({
      where: {
        email: session.user.email,
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
}
