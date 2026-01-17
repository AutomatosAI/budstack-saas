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

    // Robust phone number parsing and validation
    const rawPhone = personal.phone || "";

    // Country code to dial code mapping
    const countryToDialCode: Record<string, string> = {
      'ZA': '+27', 'US': '+1', 'GB': '+44', 'NG': '+234', 'KE': '+254',
      'GH': '+233', 'UG': '+256', 'TZ': '+255', 'ZW': '+263', 'BW': '+267',
      'MW': '+265', 'ZM': '+260', 'MZ': '+258', 'NA': '+264', 'AO': '+244',
      'CA': '+1', 'AU': '+61', 'NZ': '+64', 'IN': '+91', 'PK': '+92'
    };

    let phoneCode = "";
    let contactNumber = "";

    if (!rawPhone.trim()) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      );
    }

    // Strip all non-digit characters except leading +
    const cleanPhone = rawPhone.replace(/[^\d+]/g, '');

    if (cleanPhone.startsWith('+')) {
      // E.164 format validation and parsing
      const e164Match = cleanPhone.match(/^\+(\d{1,4})(\d{4,})$/);
      if (!e164Match) {
        return NextResponse.json(
          { error: "Invalid international phone number format. Expected format: +[country code][number]" },
          { status: 400 }
        );
      }
      phoneCode = `+${e164Match[1]}`;
      contactNumber = e164Match[2];
    } else {
      // No + prefix - use tenant's country code
      const tenantDialCode = countryToDialCode[tenant?.countryCode || ''];
      if (!tenantDialCode) {
        return NextResponse.json(
          { error: `Cannot determine dial code for tenant country: ${tenant?.countryCode}. Please provide phone number with country code (e.g., +27...)` },
          { status: 400 }
        );
      }
      phoneCode = tenantDialCode;
      // Remove leading zeros from national number
      contactNumber = cleanPhone.replace(/^0+/, '');

      if (contactNumber.length < 4) {
        return NextResponse.json(
          { error: "Phone number is too short" },
          { status: 400 }
        );
      }
    }

    // Create client in Dr. Green system
    const result = await createClient(
      {
        firstName: personal.firstName,
        lastName: personal.lastName,
        email: personal.email,
        phoneCode: phoneCode,
        phoneCountryCode: tenant?.countryCode || "ZA",
        contactNumber: contactNumber,
        shipping: {
          address1: address.street,
          city: address.city,
          state: address.province || address.city,
          country: address.country, // Full name like "South Africa"
          countryCode: tenant?.countryCode || address.countryCode || "ZA",
          postalCode: address.postalCode,
        },
        // Cast medicalRecord to any because the internal type is extremely strict (20+ boolean flags)
        // and we only have partial data from the simple registration form.
        // Spread first, then override with our explicit mappings
        medicalRecord: {
          ...medicalRecord,
          dob: personal.dateOfBirth,
          gender: "Not Specified",
          medicalConditions: medicalRecord.conditions || [],
          medicinesTreatments: medicalRecord.currentMedications || [],
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
