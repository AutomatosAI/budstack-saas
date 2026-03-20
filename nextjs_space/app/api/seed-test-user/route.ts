import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * TEMPORARY: Seed test user for order flow testing.
 * DELETE THIS FILE after testing is complete.
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-seed-secret");
  if (secret !== "budstack-test-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { userId, email, firstName, lastName, phone, tenantId, drGreenClientId, address } = body;

  try {
    // Upsert user
    const user = await prisma.users.upsert({
      where: { email },
      create: {
        id: userId,
        email,
        password: "clerk-managed",
        name: `${firstName} ${lastName}`,
        firstName,
        lastName,
        phone,
        role: "PATIENT",
        tenantId,
        drGreenClientId,
        isActive: true,
        address: address || {},
        updatedAt: new Date(),
      },
      update: {
        id: userId,
        drGreenClientId,
        firstName,
        lastName,
        phone,
        address: address || {},
        updatedAt: new Date(),
      },
    });

    // Upsert KYC questionnaire
    const existingKyc = await prisma.consultation_questionnaires.findFirst({
      where: { email, tenantId },
    });

    let kyc;
    if (existingKyc) {
      kyc = await prisma.consultation_questionnaires.update({
        where: { id: existingKyc.id },
        data: {
          isKycVerified: true,
          adminApproval: "VERIFIED",
          drGreenClientId,
          updatedAt: new Date(),
        },
      });
    } else {
      kyc = await prisma.consultation_questionnaires.create({
        data: {
          id: crypto.randomUUID(),
          tenantId,
          firstName,
          lastName,
          email,
          phoneCode: "+27",
          phoneNumber: phone || "",
          dateOfBirth: new Date("1990-01-01"),
          gender: "Female",
          password: "clerk-managed",
          addressLine1: address?.address1 || "",
          city: address?.city || "",
          state: address?.state || "",
          postalCode: address?.postalCode || "",
          country: address?.country || "South Africa",
          countryCode: address?.countryCode || "ZAF",
          drGreenClientId,
          submittedToDrGreen: true,
          isKycVerified: true,
          adminApproval: "VERIFIED",
          updatedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, drGreenClientId: user.drGreenClientId },
      kyc: { id: kyc.id, isKycVerified: kyc.isKycVerified },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
