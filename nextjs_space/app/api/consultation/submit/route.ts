import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createAuditLog, AUDIT_ACTIONS, getClientInfo } from "@/lib/audit-log";
import { triggerWebhook, WEBHOOK_EVENTS } from "@/lib/webhook";
import { getTenantDrGreenConfig } from "@/lib/tenant-config";
import { getPlatformConfig } from "@/lib/platform-config";
import { prisma } from "@/lib/db";
import { mapMedicalConditionsForDrGreen } from '@/lib/dr-green-mapping';

/**
 * Generate ECDSA signature for API request (using Node.js crypto)
 */
function generateSignature(payload: string, secretKey: string): string {
  try {
    const crypto = require("crypto");

    // Decode the base64 private key - Handle both raw and base64 encoded keys if needed,
    // but assuming standard base64 from config.
    const privateKeyPEM = Buffer.from(secretKey, "base64").toString("utf-8");

    // Sign the payload with SHA256
    const sign = crypto.createSign("SHA256");
    sign.update(payload);
    sign.end();

    // Generate signature and return as base64
    const signature = sign.sign(privateKeyPEM);
    return signature.toString("base64");
  } catch (error) {
    console.error("Error generating signature:", error);
    throw new Error("Failed to generate API signature");
  }
}

/**
 * Convert ISO 3166-1 Alpha-2 to Alpha-3 country codes
 * Dr Green API requires Alpha-3 codes
 */
function convertToAlpha3CountryCode(alpha2: string): string {
  const mapping: Record<string, string> = {
    PT: "PRT", // Portugal
    GB: "GBR", // United Kingdom
    IE: "IRL", // Ireland
    ES: "ESP", // Spain
    FR: "FRA", // France
    DE: "DEU", // Germany
    IT: "ITA", // Italy
    NL: "NLD", // Netherlands
    BE: "BEL", // Belgium
    US: "USA", // United States
    // Add more as needed
  };
  return mapping[alpha2.toUpperCase()] || alpha2;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Hash the password before storing
    const hashedPassword = await bcrypt.hash(body.password, 10);

    // Check if user already exists
    const existingUser = await prisma.users.findFirst({
      where: {
        email: body.email.toLowerCase(),
        ...(body.tenantId ? { tenantId: body.tenantId } : {}),
      },
    });

    let userId: string | undefined;

    // Create user account if doesn't exist
    if (!existingUser) {
      const newUser = await prisma.users.create({
        data: {
          email: body.email.toLowerCase(), // Ensure lowercase
          password: hashedPassword,
          name: `${body.firstName} ${body.lastName}`,
          role: "PATIENT",
          tenantId: body.tenantId, // Fixed: was || null, now always uses provided tenantId
        },
      });
      userId = newUser.id;
      console.log(`✅ Created user account for ${body.email}`);
    } else {
      userId = existingUser.id;
      console.log(
        `⚠️  User ${body.email} already exists, using existing account`,
      );
    }

    // Save questionnaire to database
    const questionnaire = await prisma.consultationQuestionnaire.create({
      data: {
        tenantId: body.tenantId || null,
        // Note: ConsultationQuestionnaire doesn't have userId field
        // User account is linked separately via email
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phoneCode: body.phoneCode,
        phoneNumber: body.phoneNumber,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : new Date(),
        gender: body.gender,
        password: hashedPassword,

        addressLine1: body.addressLine1,
        addressLine2: body.addressLine2,
        city: body.city,
        state: body.state,
        postalCode: body.postalCode,
        country: body.country,
        countryCode: body.countryCode,

        businessType: body.businessType,
        businessName: body.businessName,
        businessAddress1: body.businessAddress1,
        businessAddress2: body.businessAddress2,
        businessCity: body.businessCity,
        businessState: body.businessState,
        businessPostalCode: body.businessPostalCode,
        businessCountry: body.businessCountry,
        businessCountryCode: body.businessCountryCode,

        medicalConditions: body.medicalConditions,
        otherCondition: body.otherCondition,
        prescribedMedications: body.prescribedMedications,
        prescribedSupplements: body.prescribedSupplements,

        hasHeartProblems: body.hasHeartProblems,
        hasCancerTreatment: body.hasCancerTreatment,
        hasImmunosuppressants: body.hasImmunosuppressants,
        hasLiverDisease: body.hasLiverDisease,
        hasPsychiatricHistory: body.hasPsychiatricHistory,

        hasAlcoholAbuse: body.hasAlcoholAbuse,
        hasDrugServices: body.hasDrugServices,
        alcoholUnitsPerWeek: body.alcoholUnitsPerWeek,
        cannabisReducesMeds: body.cannabisReducesMeds,
        cannabisFrequency: body.cannabisFrequency,
        cannabisAmountPerDay: body.cannabisAmountPerDay,
      },
    });

    // Determine Tenant and Config
    // If no tenantId, we cannot submit to Dr. Green as we need tenant credentials
    if (!body.tenantId) {
      console.warn(
        "Consultation submitted without Tenant ID, skipping Dr. Green submission.",
      );
      return NextResponse.json({
        success: true,
        message:
          "Consultation saved (skipped Dr. Green submission due to missing Tenant ID)",
        questionnaireId: questionnaire.id,
      });
    }

    try {
      // Fetch Configuration dynamically
      // 1. Platform Config for API URL
      const platformConfig = await getPlatformConfig();
      const drGreenApiUrl =
        platformConfig.drGreenApiUrl || "https://api.drgreennft.com/api/v1";

      // 2. Tenant Credentials
      const { apiKey, secretKey } = await getTenantDrGreenConfig(body.tenantId);

      // Format date for Dr. Green API (YYYY-MM-DD)
      const dobFormatted = body.dateOfBirth
        ? new Date(body.dateOfBirth).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];

      // Prepare Dr. Green API payload
      const drGreenPayload = {
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email.toLowerCase(), // Dr Green requires lowercase
        phoneCode: body.phoneCode.replace(/[^\+\d]/g, ""), // e.g. "+351"
        phoneCountryCode: body.countryCode, // e.g. "PT" (2-letter ISO code)
        contactNumber: body.phoneNumber.replace(/\D/g, ""), // e.g. "7970433737" (digits only, NO prefix)

        shipping: {
          address1: body.addressLine1,
          address2: body.address2 || "",
          landmark: "",
          city: body.city,
          state: body.state,
          postalCode: body.postalCode,
          country: body.country,
          countryCode: convertToAlpha3CountryCode(body.countryCode), // Convert PT → PRT
        },

        ...(body.businessType && body.businessName
          ? {
              clientBusiness: {
                businessType: body.businessType,
                name: body.businessName,
                address1: body.businessAddress1 || "",
                address2: body.businessAddress2 || "",
                city: body.businessCity || "",
                state: body.businessState || "",
                postalCode: body.businessPostalCode || "",
                country: body.businessCountry || "",
                countryCode: body.businessCountryCode || "",
              },
            }
          : {}),

        medicalRecord: {
          dob: dobFormatted,
          gender: body.gender,
          medicalConditions: mapMedicalConditionsForDrGreen(
            body.medicalConditions || [],
          ),
          // Only include otherMedicalCondition if we have conditions that map to 'other_medical_condition'
          ...(body.medicalConditions?.includes("lupus") ||
          body.medicalConditions?.includes("asthma") ||
          body.medicalConditions?.includes("glaucoma") ||
          body.medicalConditions?.includes("other_medical_condition") ||
          body.medicalConditions?.includes("other") ||
          body.otherCondition
            ? {
                otherMedicalCondition:
                  body.medicalConditions
                    ?.filter((c: string) =>
                      [
                        "lupus",
                        "asthma",
                        "glaucoma",
                        "other_medical_condition",
                        "other",
                      ].includes(c),
                    )
                    .map((c: string) => c.charAt(0).toUpperCase() + c.slice(1))
                    .join(", ") ||
                  body.otherCondition ||
                  "Other medical condition",
              }
            : {}),
          otherMedicalTreatments: "",
          prescribedSupplements: body.prescribedSupplements || "",

          // Medical History - Dr Green uses specific field names
          medicalHistory0: body.hasHeartProblems,
          medicalHistory1: body.hasCancerTreatment,
          medicalHistory2: body.hasImmunosuppressants,
          medicalHistory3: body.hasLiverDisease,
          medicalHistory4: false, // Placeholder for other condition
          medicalHistory5: body.hasPsychiatricHistory
            ? ["depression"]
            : ["none"], // Must be array
          medicalHistory6: body.hasAlcoholAbuse,
          medicalHistory7: body.hasDrugServices ? ["anxiety"] : ["none"], // Must be array
          medicalHistory7Relation: "", // Required string
          medicalHistory8: false, // Placeholder
          medicalHistory9: false, // Placeholder
          medicalHistory10: false, // Placeholder
          medicalHistory12: body.cannabisReducesMeds,
          medicalHistory13: body.cannabisFrequency || "never",
          medicalHistory14:
            body.cannabisFrequency && body.cannabisFrequency !== "never"
              ? ["vaporizing"]
              : ["never"],
        },
      };

      // Submit to Dr. Green API
      const payloadStr = JSON.stringify(drGreenPayload);

      console.log("\n=== DR GREEN API DEBUG ===");
      console.log("API URL:", `${drGreenApiUrl}/dapp/clients`);
      console.log("Has API Key:", !!apiKey);
      console.log("Has Secret Key:", !!secretKey);
      console.log("\n=== PHONE FIELDS DEBUG ===");
      console.log("Raw phoneCode from form:", JSON.stringify(body.phoneCode));
      console.log(
        "Raw phoneNumber from form:",
        JSON.stringify(body.phoneNumber),
      );
      console.log(
        "Cleaned phoneCode:",
        JSON.stringify(body.phoneCode.replace(/[^\+\d]/g, "")),
      );
      console.log(
        "Cleaned contactNumber:",
        JSON.stringify(body.phoneNumber.replace(/\D/g, "")),
      );
      console.log("\n=== PAYLOAD ===");
      console.log(JSON.stringify(drGreenPayload, null, 2));
      console.log("\n===================\n");

      const signature = generateSignature(payloadStr, secretKey);

      const response = await fetch(`${drGreenApiUrl}/dapp/clients`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-apikey": apiKey,
          "x-auth-signature": signature,
        },
        body: payloadStr,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }

        console.error("Dr. Green API Error Response:", {
          status: response.status,
          statusText: response.statusText,
          body: errorData,
          headers: Object.fromEntries(response.headers.entries()),
        });

        throw new Error(
          `Dr.Green API Error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`,
        );
      }

      const drGreenResponse = await response.json();
      console.log("Dr. Green API Success:", drGreenResponse);

      // Extract KYC link and client ID from response
      // Handle potentially different response structures
      const clientId = drGreenResponse.data?.id || drGreenResponse.id;
      const kycLink =
        drGreenResponse.data?.kycLink || drGreenResponse.kycLink || null;

      // Update questionnaire with Dr. Green client ID and KYC link
      await prisma.consultationQuestionnaire.update({
        where: { id: questionnaire.id },
        data: {
          submittedToDrGreen: true,
          drGreenClientId: clientId,
          kycLink: kycLink,
          isKycVerified: false,
          adminApproval: "PENDING",
        },
      });

      // Audit log for successful consultation submission
      const clientInfo = getClientInfo(request.headers);
      await createAuditLog({
        action: AUDIT_ACTIONS.CONSULTATION_SUBMITTED,
        entityType: "ConsultationQuestionnaire",
        entityId: questionnaire.id,
        userEmail: body.email,
        tenantId: body.tenantId || undefined,
        metadata: {
          drGreenClientId: clientId,
          firstName: body.firstName,
          lastName: body.lastName,
        },
        ...clientInfo,
      });

      // Trigger webhook for consultation submitted
      await triggerWebhook({
        event: WEBHOOK_EVENTS.CONSULTATION_SUBMITTED,
        tenantId: body.tenantId || undefined,
        data: {
          questionnaireId: questionnaire.id,
          drGreenClientId: clientId,
          customerEmail: body.email,
          customerName: `${body.firstName} ${body.lastName}`,
          medicalConditions: body.medicalConditions || [],
          submittedAt: new Date().toISOString(),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Consultation submitted successfully",
        questionnaireId: questionnaire.id,
        drGreenClientId: clientId,
        kycLink: kycLink,
        adminApproval: "PENDING",
      });
    } catch (drGreenError: any) {
      console.error("Dr. Green API Error:", drGreenError);

      // Update questionnaire with error
      await prisma.consultationQuestionnaire.update({
        where: { id: questionnaire.id },
        data: {
          submittedToDrGreen: false,
          submissionError: drGreenError.message,
        },
      });

      // We return a 200 OK because the *questionnaire* was saved, but the external sync failed.
      // Or we can return 500. Logic here returns 500 to alert frontend.
      return NextResponse.json(
        {
          success: false,
          error: "Failed to submit to Dr. Green API",
          details: drGreenError.message,
          questionnaireId: questionnaire.id,
        },
        { status: 500 },
      );
    }
  } catch (error: any) {
    console.error("Consultation submission error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
