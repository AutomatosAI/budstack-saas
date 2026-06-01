import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";

import { createAuditLog, AUDIT_ACTIONS, getClientInfo } from "@/lib/audit-log";
import { triggerWebhook, WEBHOOK_EVENTS } from "@/lib/integrations/webhook";
import { getTenantDrGreenConfig } from "@/lib/tenant/tenant-config";
import { callDrGreenAPI } from "@/lib/drgreen/drgreen-api-client";

import { prisma } from "@/lib/db";
import { mapMedicalConditionsForDrGreen } from '@/lib/drgreen/dr-green-mapping';
import crypto from "crypto";
import { z } from "zod";

import { toAlpha3 as convertToAlpha3CountryCode } from '@/lib/country-codes';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { getTenantFromRequest } from '@/lib/tenant/tenant';
import { resolveTenant } from '@/lib/tenant/tenant-resolver';
import { logger } from '@/lib/logger';

// SECURITY (C1, C13): Strict whitelist schema — no `.passthrough()`. Every
// field that lands in the database or is forwarded to Dr. Green must be
// declared here and length-capped. The tenant is resolved server-side from
// the request host/path; clients must NOT send a tenantId UUID, only an
// optional tenantSlug used as a dev-time fallback when the request lacks
// tenant headers (localhost path-based routing).
const consultationSchema = z.object({
  // Tenant resolution fallback (subdomain slug only — never a UUID)
  tenantSlug: z.string().min(1).max(100).optional(),

  // Contact
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().max(254),
  phoneCode: z.string().max(10).optional().default(""),
  phoneNumber: z.string().max(30).optional().default(""),
  dateOfBirth: z.string().max(50).nullable().optional(),
  gender: z.string().max(50).optional().default(""),
  password: z.string().min(8).max(128),
  confirmPassword: z.string().max(128).optional(),

  // Shipping address
  addressLine1: z.string().max(300).optional().default(""),
  addressLine2: z.string().max(300).optional().default(""),
  city: z.string().max(100).optional().default(""),
  state: z.string().max(100).optional().default(""),
  postalCode: z.string().max(20).optional().default(""),
  country: z.string().max(100).optional().default(""),
  countryCode: z.string().min(2).max(3),

  // Business info (optional)
  businessType: z.string().max(100).optional().default(""),
  businessName: z.string().max(200).optional().default(""),
  businessAddress1: z.string().max(300).optional().default(""),
  businessAddress2: z.string().max(300).optional().default(""),
  businessCity: z.string().max(100).optional().default(""),
  businessState: z.string().max(100).optional().default(""),
  businessPostalCode: z.string().max(20).optional().default(""),
  businessCountry: z.string().max(100).optional().default(""),
  businessCountryCode: z.string().max(3).optional().default(""),

  // Medical conditions
  medicalConditions: z.array(z.string().max(100)).max(100).optional().default([]),
  otherCondition: z.string().max(1000).optional().default(""),
  prescribedMedications: z.array(z.string().max(200)).max(100).optional().default([]),
  prescribedSupplements: z.string().max(2000).optional().default(""),

  // Medical history (booleans + small strings)
  hasHeartProblems: z.boolean().optional().default(false),
  hasCancerTreatment: z.boolean().optional().default(false),
  hasImmunosuppressants: z.boolean().optional().default(false),
  hasLiverDisease: z.boolean().optional().default(false),
  hasPsychiatricHistory: z.boolean().optional().default(false),
  hasAlcoholAbuse: z.boolean().optional().default(false),
  hasDrugServices: z.boolean().optional().default(false),
  alcoholUnitsPerWeek: z.string().max(20).optional().default(""),
  cannabisReducesMeds: z.boolean().optional().default(false),
  cannabisFrequency: z.string().max(50).optional().default(""),
  cannabisAmountPerDay: z.string().max(50).optional().default(""),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP — public endpoint that creates accounts
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const rateLimitResult = await checkRateLimit(`consultation:${ip}`, { maxRequests: 5, windowMs: 60000 });
    if (!rateLimitResult.success) {
      return rateLimitResult.response;
    }

    const rawBody = await request.json();

    const parseResult = consultationSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0];
      return NextResponse.json(
        { error: `Validation error: ${firstError.path.join('.')} — ${firstError.message}` },
        { status: 400 },
      );
    }

    // SECURITY (C1, C13): Use ONLY the validated/whitelisted fields. Never
    // re-introduce `rawBody` here — that would re-open the mass-assignment
    // hole that allowed clients to inject tenantId, role, drGreenClientId,
    // adminApproval, etc.
    const body = parseResult.data;

    // SECURITY (C1): Resolve tenant from the request itself (host/path
    // headers set by middleware). Never trust a tenantId in the request
    // body. tenantSlug is accepted only as a dev fallback for path-based
    // localhost where middleware cannot derive tenant from the API URL.
    let tenant = await getTenantFromRequest(request);
    if (!tenant && body.tenantSlug) {
      // PRD-205 (AC-2b): tenant-by-slug resolution goes through the canonical
      // resolver (uniform isActive + lower-case retry) rather than an ad-hoc
      // findFirst, so this dev/localhost fallback can't drift from every other path.
      const resolved = await resolveTenant({ kind: 'slug', slug: body.tenantSlug });
      tenant = resolved?.tenant ?? null;
    }
    if (
      tenant &&
      body.tenantSlug &&
      tenant.subdomain.toLowerCase() !== body.tenantSlug.toLowerCase()
    ) {
      return NextResponse.json(
        { error: "Tenant mismatch between request host and submitted slug" },
        { status: 400 },
      );
    }
    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant not found for this request" },
        { status: 404 },
      );
    }
    const tenantId = tenant.id;

    // 1. Create Clerk User (Auth)
    let clerkUser;
    try {
      const client = await clerkClient();
      try {
        clerkUser = await client.users.createUser({
          emailAddress: [body.email],
          password: body.password,
          firstName: body.firstName,
          lastName: body.lastName,
          publicMetadata: {
            role: "PATIENT",
            tenantId,
            consultationCompleted: true
          },
        });
      } catch (clerkError: any) {
        // Ignore if user already exists in Clerk, proceed to DB/DrGreen
        if (clerkError.errors?.[0]?.code === "form_identifier_exists") {
          logger.info("[Consultation] user already exists in Clerk", { tenantId });
          // Optionally fetch the user to get their ID if needed, but for now we proceed
        } else {
          throw clerkError; // Re-throw other errors (e.g., weak password)
        }
      }
    } catch (error: any) {
      logger.error("[Consultation] Clerk user creation error", {
        tenantId,
        code: error?.errors?.[0]?.code,
        message: error?.errors?.[0]?.message ?? (error instanceof Error ? error.message : String(error)),
      });
      // Surface Clerk's structured, user-actionable validation message only
      // (e.g. "email taken", "weak password"); never the raw error.message.
      return NextResponse.json(
        { error: error?.errors?.[0]?.message || "Unable to create your account. Please check your details and try again." },
        { status: 400 }
      );
    }

    // Check if user already exists locally (email is globally unique, don't filter by tenantId)
    const existingUser = await prisma.users.findUnique({
      where: { email: body.email.toLowerCase() },
    });

    let userId: string | undefined;

    if (existingUser) {
      userId = existingUser.id;
      // Update tenantId if not set (e.g. user was created by Clerk webhook without tenant)
      if (!existingUser.tenantId) {
        await prisma.users.update({
          where: { id: existingUser.id },
          data: {
            tenantId,
            role: "PATIENT",
            name: `${body.firstName} ${body.lastName}`,
            updatedAt: new Date(),
          },
        });
      }
      logger.info("[Consultation] user already exists, using existing account", {
        userId,
        tenantId,
      });
    } else {
      // Create user account (Local Mirror)
      const newId = clerkUser ? clerkUser.id : crypto.randomUUID();

      try {
        const newUser = await prisma.users.create({
          data: {
            id: newId,
            email: body.email.toLowerCase(),
            password: "CLERK_MANAGED_ACCOUNT",
            name: `${body.firstName} ${body.lastName}`,
            role: "PATIENT",
            tenantId,
            updatedAt: new Date(),
          },
        });
        userId = newUser.id;
        logger.info("[Consultation] created local user mirror", { userId, tenantId });
      } catch (prismaError: any) {
        // Race condition: Clerk webhook may have created the user between our check and create
        if (prismaError.code === "P2002") {
          const raceUser = await prisma.users.findUnique({
            where: { email: body.email.toLowerCase() },
          });
          if (raceUser) {
            userId = raceUser.id;
            if (!raceUser.tenantId) {
              await prisma.users.update({
                where: { id: raceUser.id },
                data: { tenantId, role: "PATIENT", updatedAt: new Date() },
              });
            }
            logger.info("[Consultation] user created by webhook race, using existing account", {
              userId,
              tenantId,
            });
          } else {
            throw prismaError;
          }
        } else {
          throw prismaError;
        }
      }
    }

    // Save questionnaire to database
    const questionnaire = await prisma.consultation_questionnaires.create({
      data: {
        id: crypto.randomUUID(),
        tenantId,
        // Note: ConsultationQuestionnaire doesn't have userId field
        // User account is linked separately via email
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phoneCode: body.phoneCode,
        phoneNumber: body.phoneNumber,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : new Date(),
        gender: body.gender,
        password: "clerk_managed", // Placeholder in questionnaire too if it exists

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
        updatedAt: new Date(),
      },
    });

    try {
      // Fetch tenant credentials + API URL (respects tenant override > env var > platform config)
      const { apiKey, secretKey, apiUrl } = await getTenantDrGreenConfig(tenantId);
      logger.debug("[Consultation] Dr Green credentials loaded", { tenantId });

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
          address2: body.addressLine2 || '',
          landmark: '',
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
          medicalHistory4: body.hasPsychiatricHistory,
          medicalHistory5: body.hasPsychiatricHistory ? ["depression"] : ["none"],
          medicalHistory6: false, // Suicidal history
          medicalHistory7: ["none"], // Family history
          medicalHistory7Relation: "none",
          medicalHistory8: body.hasDrugServices,
          medicalHistory9: body.hasAlcoholAbuse,
          medicalHistory10: body.hasDrugServices,
          medicalHistory11: body.alcoholUnitsPerWeek || "0",
          medicalHistory12: body.cannabisReducesMeds,
          medicalHistory13: body.cannabisFrequency || "never",
          medicalHistory14: body.cannabisFrequency && body.cannabisFrequency !== "never" ? ["vaporizing"] : ["never"],
          medicalHistory15: body.cannabisAmountPerDay || "",
          medicalHistory16: false, // cannabisReaction
        },
      };

      // Submit to Dr. Green API via shared client
      const drGreenResponse = await callDrGreenAPI<any>('/dapp/clients', {
        method: 'POST',
        apiKey,
        secretKey,
        baseUrl: apiUrl,
        body: drGreenPayload,
      });

      // AC-2a: log a REDACTED summary of the Dr Green response — the top-level
      // keys and presence flags only — never the email and never the raw body
      // (which carries the client's special-category medical/KYC data).
      logger.debug("[Consultation] Dr Green response shape", {
        tenantId,
        topKeys: Object.keys(drGreenResponse || {}),
        hasData: Boolean(drGreenResponse?.data),
        hasClient: Boolean(drGreenResponse?.data?.client || drGreenResponse?.client),
      });

      // Extract KYC link and client ID from response
      // Dr Green API nests client under data.client (confirmed from live response)
      const clientIdPath =
        drGreenResponse.data?.client?.id ? 'data.client.id' :
        drGreenResponse.data?.id ? 'data.id' :
        drGreenResponse.client?.id ? 'client.id' :
        drGreenResponse.id ? 'id' : 'NONE';
      const clientId =
        drGreenResponse.data?.client?.id ||
        drGreenResponse.data?.id ||
        drGreenResponse.client?.id ||
        drGreenResponse.id;
      const kycLink =
        drGreenResponse.data?.client?.kycLink ||
        drGreenResponse.data?.kycLink ||
        drGreenResponse.client?.kycLink ||
        drGreenResponse.kycLink || null;

      // AC-2a: no email; client id is a non-PII Dr Green identifier, kycLink
      // presence is a boolean flag (the link itself is a redaction-set field).
      logger.info("[Consultation] submission result", {
        tenantId,
        clientId: clientId || 'MISSING',
        extractedFrom: clientIdPath,
        hasKycLink: Boolean(kycLink),
      });

      if (!clientId) {
        // Summary only — never dump the raw response (special-category data).
        logger.error("[Consultation] Dr Green response missing client ID", {
          tenantId,
          topKeys: Object.keys(drGreenResponse || {}),
        });
      }

      // Update questionnaire with Dr. Green client ID and KYC link
      await prisma.consultation_questionnaires.update({
        where: { id: questionnaire.id },
        data: {
          submittedToDrGreen: true,
          drGreenClientId: clientId,
          kycLink: kycLink,
          isKycVerified: false,
          adminApproval: "PENDING",
        },
      });

      // CRITICAL FIX: Also update the User record with the Dr. Green Client ID
      // This is required for the kyc-check to work, as it looks at the User table.
      if (userId) {
        await prisma.users.update({
          where: { id: userId },
          data: {
            drGreenClientId: clientId,
            tenantId,
            updatedAt: new Date(),
          },
        });
        logger.info("[Consultation] updated user with Dr Green client id", {
          userId,
          clientId,
        });
      }

      // Audit log for successful consultation submission
      const clientInfo = getClientInfo(request.headers);
      await createAuditLog({
        action: AUDIT_ACTIONS.CONSULTATION_SUBMITTED,
        entityType: "ConsultationQuestionnaire",
        entityId: questionnaire.id,
        userEmail: body.email,
        tenantId,
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
        tenantId,
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
      // Message only — the Dr Green error object/body can echo back the
      // submitted PHI; never log the whole thing.
      logger.error("[Consultation] Dr Green API error", {
        tenantId,
        message: drGreenError instanceof Error ? drGreenError.message : String(drGreenError),
      });

      // Update questionnaire with error
      await prisma.consultation_questionnaires.update({
        where: { id: questionnaire.id },
        data: {
          submittedToDrGreen: false,
          submissionError: drGreenError.message,
        },
      });

      // Parse Dr Green error for user-friendly messages
      const errorMsg = drGreenError.message || "";
      let userMessage = "Registration failed. Please try again or contact support.";
      let statusCode = 500;

      if (errorMsg.includes("Phone Number already exists") || errorMsg.includes("phone") && errorMsg.includes("exists")) {
        userMessage = "This phone number is already registered. Please use a different phone number or contact support.";
        statusCode = 409;
      } else if (errorMsg.includes("email") && errorMsg.includes("exists")) {
        userMessage = "This email address is already registered. Please use a different email or try logging in.";
        statusCode = 409;
      } else if (errorMsg.includes("409")) {
        userMessage = "An account with these details already exists. Please use different details or contact support.";
        statusCode = 409;
      } else if (errorMsg.includes("400")) {
        userMessage = "Invalid information provided. Please check your details and try again.";
        statusCode = 400;
      }

      return NextResponse.json(
        {
          success: false,
          error: userMessage,
          questionnaireId: questionnaire.id,
        },
        { status: statusCode },
      );
    }
  } catch (error: any) {
    logger.error("[Consultation] submission error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
