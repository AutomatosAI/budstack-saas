import { NextResponse } from 'next/server';
import { withAuth } from "@/lib/api-auth";
import { createClient } from '@/lib/drgreen/doctor-green-api';
import { prisma } from '@/lib/db';
import { getCurrentTenant } from '@/lib/tenant/tenant';
import { getTenantDrGreenConfig } from '@/lib/tenant/tenant-config';
import { apiError, apiValidationError } from '@/lib/api-error';

export const POST = withAuth(async (req, { user }) => {
  try {
    const email = user.email;
    if (!email) {
      return apiError(new Error("Unauthorized"), {
        route: "POST /api/shop/register",
        status: 401,
        safeMessage: "Unauthorized",
      });
    }

    // Find linked DB user
    const dbUser = await prisma.users.findFirst({ where: { email } });
    if (!dbUser) {
      return apiError(new Error("User record not found"), {
        route: "POST /api/shop/register",
        status: 404,
        safeMessage: "User record not found",
      });
    }

    const body = await req.json();
    const { personal, address, medicalRecord } = body;

    // Validate required fields
    if (!personal || !address || !medicalRecord) {
      return apiValidationError("Missing required fields", "POST /api/shop/register");
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
      return apiValidationError("Phone number is required", "POST /api/shop/register");
    }

    // Strip all non-digit characters except leading +
    const cleanPhone = rawPhone.replace(/[^\d+]/g, '');

    if (cleanPhone.startsWith('+')) {
      // E.164 format validation and parsing
      const e164Match = cleanPhone.match(/^\+(\d{1,4})(\d{4,})$/);
      if (!e164Match) {
        return apiValidationError(
          "Invalid international phone number format. Expected format: +[country code][number]",
          "POST /api/shop/register",
        );
      }
      phoneCode = `+${e164Match[1]}`;
      contactNumber = e164Match[2];
    } else {
      // No + prefix - use tenant's country code
      const tenantDialCode = countryToDialCode[tenant?.countryCode || ''];
      if (!tenantDialCode) {
        return apiValidationError(
          `Cannot determine dial code for tenant country: ${tenant?.countryCode}. Please provide phone number with country code (e.g., +27...)`,
          "POST /api/shop/register",
        );
      }
      phoneCode = tenantDialCode;
      // Remove leading zeros from national number
      contactNumber = cleanPhone.replace(/^0+/, '');

      if (contactNumber.length < 4) {
        return apiValidationError("Phone number is too short", "POST /api/shop/register");
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
  } catch (error) {
    // SECURITY (H_e1): Dr Green client creation errors may include API
    // endpoints, request IDs, or PII fragments — never propagate raw.
    return apiError(error, {
      route: "shop.register",
      status: 500,
      safeMessage: "Failed to register patient",
    });
  }
});
