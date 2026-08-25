import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { emailsMatch } from "@/lib/security/email-ownership";
import { getVerifiedSessionEmail } from "@/lib/security/session-email";

import { createAuditLog, AUDIT_ACTIONS, getClientInfo } from "@/lib/audit-log";
import { triggerWebhook, WEBHOOK_EVENTS } from "@/lib/integrations/webhook";
import { getTenantDrGreenConfig } from "@/lib/tenant/tenant-config";
import { callDrGreenAPI } from "@/lib/drgreen/drgreen-api-client";
import { createSaIdClient, uploadIdentityDocument } from "@/lib/drgreen-identity";
import { recordIdDocumentOutcome } from "@/lib/verification/id-document-status";
import {
  getTenantVerificationMode,
  isSaIdUploadEnabled,
} from "@/lib/verification-mode";

import { prisma } from "@/lib/db";
import { mapMedicalConditionsForDrGreen } from '@/lib/drgreen/dr-green-mapping';
import crypto from "crypto";
import { z } from "zod";

import { toAlpha3 as convertToAlpha3CountryCode } from '@/lib/country-codes';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { getTenantFromRequest } from '@/lib/tenant/tenant';
import { resolveTenant } from '@/lib/tenant/tenant-resolver';
import { logger } from '@/lib/logger';
import { apiError, apiValidationError } from '@/lib/api-error';
import { checkPolicyGate } from '@/lib/legal/policy-gate';

/** 409 for "that address already belongs to an account you have not proven you own". */
function accountExistsResponse() {
  return apiError(new Error("Account already exists for this email"), {
    route: "POST /api/consultation/submit",
    status: 409,
    safeMessage:
      "An account already exists for this email address. Please sign in first, then complete your consultation.",
  });
}

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

  // US-023 (POPIA): explicit marketing opt-in from the signup form. Optional
  // and UNTICKED by default — absent or false records NO consent.
  marketingConsent: z.boolean().optional(),

  // SA ID-upload (idMode): document sent inline with registration so the
  // account + Dr Green client + document are created in one action.
  idDocument: z
    .object({
      fileBase64: z.string().min(1),
      mimeType: z.string().max(100),
      documentType: z.enum(["ID", "PASSPORT", "DRIVING_LICENCE"]),
      documentNumber: z.string().trim().min(1).max(100),
    })
    .optional(),

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
      return apiValidationError(
        `Validation error: ${firstError.path.join('.')} — ${firstError.message}`,
        "POST /api/consultation/submit",
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
      return apiValidationError(
        "Tenant mismatch between request host and submitted slug",
        "POST /api/consultation/submit",
      );
    }
    if (!tenant) {
      return apiError(new Error("Tenant not found for this request"), {
        route: "POST /api/consultation/submit",
        status: 404,
        safeMessage: "Tenant not found for this request",
      });
    }
    const tenantId = tenant.id;

    // A storefront with no published privacy notice tells visitors exactly that
    // — so taking a consultation here would collect special-category data with
    // no Art. 13 notice at all. Checked before ANY account or record is created.
    // Ships warn-only: enforcement begins on LEGAL_POLICY_ENFORCEMENT_DATE, so
    // deploying this cannot stop a live storefront taking orders.
    const policyGate = await checkPolicyGate(tenantId);
    if (!policyGate.allowed) {
      return apiError(new Error("No published privacy policy for tenant"), {
        route: "POST /api/consultation/submit",
        status: 503,
        safeMessage: policyGate.reason,
      });
    }

    // SECURITY (account takeover): this route is PUBLIC — the caller has not
    // proven they own `body.email`, anyone can type anyone's address. Creating
    // records for a BRAND-NEW address is fine; touching an address that
    // already has an account is not. Without the ownership gate below, an
    // anonymous caller could submit a victim's email, have Clerk's
    // "already exists" swallowed, and reach the linking step further down that
    // re-points the VICTIM's users row at a Dr Green client the ATTACKER
    // controls — so once the attacker's own (genuine-looking) ID is approved,
    // the victim's account inherits VERIFIED.
    //
    // Ownership over anything that already exists is provable ONE way: an
    // authenticated session for that address. Notably NOT by Clerk accepting a
    // new account below — that only proves nobody held the *Clerk* identity,
    // which says nothing about a local users row that predates this request
    // (legacy import, or a dropped Clerk delete-webhook).
    const sessionOwnsEmail = emailsMatch(await getVerifiedSessionEmail(), body.email);

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
        // The address already has an account. Continuing "to DB/DrGreen" here
        // is what let an anonymous caller operate on someone else's row —
        // refuse unless they are signed in as that address.
        if (clerkError.errors?.[0]?.code === "form_identifier_exists") {
          if (!sessionOwnsEmail) {
            logger.warn(
              "[Consultation] refused submission for an existing address by a caller not signed in as it",
              { tenantId },
            );
            return accountExistsResponse();
          }
          logger.info("[Consultation] existing Clerk account, caller is signed in as it", { tenantId });
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
      return apiValidationError(
        error?.errors?.[0]?.message || "Unable to create your account. Please check your details and try again.",
        "POST /api/consultation/submit",
      );
    }

    // Check if user already exists locally (email is globally unique, don't filter by tenantId)
    const existingUser = await prisma.users.findUnique({
      where: { email: body.email.toLowerCase() },
    });

    // THE ownership gate — the single choke point, ahead of every write in
    // this handler (the questionnaire, the Dr Green client, and the linking
    // update all come after it). A pre-existing row may only be adopted by a
    // caller signed in as its address.
    //
    // Deliberately NOT "…or Clerk just minted the account": for an address
    // that has a local row but no Clerk account (legacy import, dropped
    // delete-webhook), Clerk's createUser SUCCEEDS for anyone, so accepting
    // that as proof would re-open this hole from the opposite direction. Such
    // a caller now gets the 409 and can sign in with the account Clerk just
    // created for them, then re-submit.
    if (existingUser && !sessionOwnsEmail) {
      logger.warn(
        "[Consultation] refused submission for an existing local account by a caller not signed in as it",
        { tenantId, clerkAccountJustCreated: Boolean(clerkUser) },
      );
      return accountExistsResponse();
    }

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
            firstName: body.firstName,
            lastName: body.lastName,
            phone: [body.phoneCode, body.phoneNumber].filter(Boolean).join(" ").trim() || null,
            // US-023: a tick at signup grants consent; unticked NEVER clears
            // an earlier grant — withdrawal is unsubscribe/admin-only.
            ...(body.marketingConsent === true && {
              marketingConsentAt: new Date(),
            }),
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
            firstName: body.firstName,
            lastName: body.lastName,
            phone: [body.phoneCode, body.phoneNumber].filter(Boolean).join(" ").trim() || null,
            role: "PATIENT",
            tenantId,
            // US-023: consent only on an explicit tick — never inferred.
            marketingConsentAt: body.marketingConsent === true ? new Date() : null,
            updatedAt: new Date(),
          },
        });
        userId = newUser.id;
        logger.info("[Consultation] created local user mirror", { userId, tenantId });
      } catch (prismaError: any) {
        // Race condition: Clerk webhook may have created the user between our
        // check and create. Reaching here means the ownership gate above saw
        // NO pre-existing row, so this row appeared during this request — it
        // is the webhook's mirror of the Clerk account this request just
        // minted for this same address, not a stranger's record.
        if (prismaError.code === "P2002") {
          const raceUser = await prisma.users.findUnique({
            where: { email: body.email.toLowerCase() },
          });
          if (raceUser) {
            userId = raceUser.id;
            if (!raceUser.tenantId) {
              await prisma.users.update({
                where: { id: raceUser.id },
                data: {
                  tenantId,
                  role: "PATIENT",
                  // US-023: the webhook race must not lose an explicit tick.
                  ...(body.marketingConsent === true && {
                    marketingConsentAt: new Date(),
                  }),
                  updatedAt: new Date(),
                },
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

        // Article 9 special-category health data is deliberately NOT persisted.
        // It is validated on the way in, forwarded to Dr Green from `body` below
        // (see the drGreenPayload build), and then discarded with the request.
        // Dr Green is the controller for the clinical record; BudStacks has no
        // lawful basis or functional need to retain it (Art 5(1)(c)).
        // Do not add health fields here — tests/unit/no-article9-persistence.test.ts
        // will fail. See docs/PRDS/prd-data-protection-remediation.md (US-002).
        updatedAt: new Date(),
      },
    });

    try {
      // Fetch tenant credentials + API URL (respects tenant override > env var > platform config)
      const { apiKey, secretKey, apiUrl } = await getTenantDrGreenConfig(tenantId);
      logger.debug("[Consultation] Dr Green credentials loaded", { tenantId });

      // SA ID-upload path creates the client via verificationType "ID" (no
      // medical questionnaire). Otherwise the standard KYC/First-AML payload.
      const idMode =
        isSaIdUploadEnabled() &&
        getTenantVerificationMode(tenant) === "ID_UPLOAD";

      let clientId: string | undefined;
      let kycLink: string | null = null;

      if (idMode) {
        const created = await createSaIdClient({
          firstName: body.firstName,
          lastName: body.lastName,
          email: body.email.toLowerCase(),
          phoneCode: body.phoneCode.replace(/[^\+\d]/g, ""),
          phoneCountryCode: body.countryCode,
          contactNumber: body.phoneNumber.replace(/\D/g, ""),
          shipping: {
            address1: body.addressLine1,
            address2: body.addressLine2 || "",
            city: body.city,
            state: body.state,
            country: body.country,
            postalCode: body.postalCode,
          },
          config: { apiKey, secretKey },
          baseUrl: apiUrl,
        });
        clientId = created.clientId;

        // Inline ID upload — BEST-EFFORT. The account + Dr Green client are
        // already created above, so an upload failure must NOT fail the whole
        // registration: the client lands as verification-pending and can
        // re-upload the document from the dashboard. PRD-220 Part B: the
        // outcome is persisted either way so the failure is visible (customer
        // re-upload CTA + tenant-admin badge) instead of log-only.
        if (clientId && body.idDocument?.fileBase64) {
          try {
            await uploadIdentityDocument({
              clientId,
              documentType: body.idDocument.documentType,
              documentNumber: body.idDocument.documentNumber,
              file: Buffer.from(body.idDocument.fileBase64, "base64"),
              mimeType: body.idDocument.mimeType,
              config: { apiKey, secretKey },
              baseUrl: apiUrl,
            });
            await recordIdDocumentOutcome({
              questionnaireId: questionnaire.id,
              outcome: "UPLOADED",
            });
          } catch (uploadErr) {
            logger.error(
              "[Consultation] ID document upload failed; account + client created, document can be re-uploaded from the dashboard",
              {
                tenantId,
                clientId,
                error:
                  uploadErr instanceof Error
                    ? uploadErr.message
                    : String(uploadErr),
              },
            );
            await recordIdDocumentOutcome({
              questionnaireId: questionnaire.id,
              outcome: "UPLOAD_FAILED",
              error: uploadErr,
            });
          }
        }
      } else {
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
      clientId =
        drGreenResponse.data?.client?.id ||
        drGreenResponse.data?.id ||
        drGreenResponse.client?.id ||
        drGreenResponse.id;
      kycLink =
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
      } // end KYC/First-AML branch

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

      // Also update the User record with the Dr. Green Client ID — required
      // for the kyc-check, which reads the User table.
      //
      // SECURITY: the write an account-takeover targets. Safe by the ownership
      // gate above — `userId` is either a row THIS request created, or a
      // pre-existing row whose address the caller is signed in as. Enforced
      // there and regression-tested in
      // tests/unit/consultation-submit-ownership.test.ts; a re-check here
      // would be unfirable by construction (the mistake the first cut made).
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

      // Parse Dr Green error for user-friendly messages
      const errorMsg = drGreenError.message || "";
      let userMessage = "Registration failed. Please try again or contact support.";
      let statusCode = 500;
      let failureCode = "UNKNOWN";

      if (errorMsg.includes("Phone Number already exists") || errorMsg.includes("phone") && errorMsg.includes("exists")) {
        userMessage = "This phone number is already registered. Please use a different phone number or contact support.";
        statusCode = 409;
        failureCode = "PHONE_EXISTS";
      } else if (errorMsg.includes("email") && errorMsg.includes("exists")) {
        userMessage = "This email address is already registered. Please use a different email or try logging in.";
        statusCode = 409;
        failureCode = "EMAIL_EXISTS";
      } else if (errorMsg.includes("409")) {
        userMessage = "An account with these details already exists. Please use different details or contact support.";
        statusCode = 409;
        failureCode = "CONFLICT";
      } else if (errorMsg.includes("400")) {
        userMessage = "Invalid information provided. Please check your details and try again.";
        statusCode = 400;
        failureCode = "BAD_REQUEST";
      }

      // Persist a stable classification, NOT the upstream message. Dr Green
      // error bodies echo back submitted values (see the logger note above), so
      // writing `drGreenError.message` into a durable row would reintroduce the
      // Art. 9 data this endpoint no longer stores. Full detail stays in the
      // logs, which are redacted and rotate. Nothing reads submissionError.
      await prisma.consultation_questionnaires.update({
        where: { id: questionnaire.id },
        data: {
          submittedToDrGreen: false,
          submissionError: `${failureCode} (${statusCode})`,
        },
      });

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
