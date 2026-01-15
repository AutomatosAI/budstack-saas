import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const user = await currentUser();

    if (!user?.emailAddresses?.[0]?.emailAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = user.emailAddresses[0].emailAddress;

    // Find the most recent consultation for this user
    const consultation = await prisma.consultation_questionnaires.findFirst({
      where: {
        email: email,
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
