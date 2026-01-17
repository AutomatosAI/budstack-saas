import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from "@clerk/nextjs/server";
import { createClient } from '@/lib/doctor-green-api';
import { prisma } from '@/lib/db';
import { getCurrentTenant } from '@/lib/tenant';
import { getTenantDrGreenConfig } from '@/lib/tenant-config';

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();

    if (!user?.emailAddresses?.[0]?.emailAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = user.emailAddresses[0].emailAddress;

    // Find linked DB user
    const dbUser = await prisma.users.findFirst({ where: { email } });
    if (!dbUser) {
      return NextResponse.json({ error: "User record not found" }, { status: 404 });
    }

    const body = await req.json();
    const { personal, address, medicalRecord } = body;

    // Validate required fields
    if (!personal || !address || !medicalRecord) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Get current tenant for Dr. Green API keys
    const tenant = await getCurrentTenant();

    // Resolve credentials (tenant-specific or platform env fallback)
    let config = {
      apiKey: process.env.DR_GREEN_API_KEY || '',
      secretKey: process.env.DR_GREEN_SECRET_KEY || '',
    };

    if (tenant?.id) {
      try {
        config = await getTenantDrGreenConfig(tenant.id);
      } catch (error) {
        console.warn(
          `Using platform Dr. Green credentials fallback: ${error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    if (!config.apiKey || !config.secretKey) {
      console.error("Missing Dr. Green API credentials for registration");
      // Continue anyway? The createClient might fail or we should block.
      // createClient throws 'MISSING_CREDENTIALS` if keys are missing.
      // We'll let it proceed and fail inside if needed, or handle it here.
    }

    // Parse phone number
    const phone = personal.phone || "";
    // Simple parsing assumption: +27... or 0...
    const phoneCode = phone.startsWith("+") ? phone.slice(0, 3) : "+27"; // Default to ZA
    const contactNumber = phone.startsWith("+") ? phone.slice(3) : phone;

    // Create client in Dr. Green system
    const result = await createClient(
      {
        firstName: personal.firstName,
        lastName: personal.lastName,
        email: personal.email,
        phoneCode: phoneCode,
        phoneCountryCode: "ZA", // Defaulting to ZA
        contactNumber: contactNumber,
        shipping: {
          address1: address.street,
          city: address.city,
          state: address.province || address.city,
          country: address.country, // Full name like "South Africa"
          countryCode: "ZA", // Provide code
          postalCode: address.postalCode,
        },
        // Cast medicalRecord to any because the internal type is extremely strict (20+ boolean flags)
        // and we only have partial date from the simple registration form.
        // We map what we can.
        medicalRecord: {
          dob: personal.dateOfBirth,
          gender: "Not Specified",
          medicalConditions: medicalRecord.conditions || [],
          medicinesTreatments: medicalRecord.currentMedications || [],
          // Pass the rest as-is in case the API is more lenient than the TS type
          ...medicalRecord
        } as any,
      },
      config,
    );

    // Update user with additional info
    await prisma.users.update({
      where: { id: dbUser.id },
      data: {
        name: `${personal.firstName} ${personal.lastName}`,
      },
    });

    return NextResponse.json({
      success: true,
      clientId: result.clientId,
      kycLink: result.kycLink,
    });
  } catch (error: any) {
    console.error("Patient registration error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to register patient" },
      { status: 500 },
    );
  }
}
