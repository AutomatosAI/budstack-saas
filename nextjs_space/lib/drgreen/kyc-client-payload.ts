/**
 * The Dr Green `POST /dapp/clients` payload for a KYC (First-AML)
 * registration, lifted out of app/api/consultation/submit/route.ts so that
 * route stays under the 800-line lint ceiling and the mapping is testable on
 * its own. Behaviour-preserving: field names, defaults and the medicalHistory*
 * mapping are exactly what the route sent before the lift.
 *
 * The input is structural (what the builder reads), not the route's zod type,
 * so this module never imports the route and no import cycle can form.
 */
import { mapMedicalConditionsForDrGreen } from "@/lib/drgreen/dr-green-mapping";
import { toAlpha3 } from "@/lib/country-codes";

const OTHER_CONDITION_KEYS = [
  "lupus",
  "asthma",
  "glaucoma",
  "other_medical_condition",
  "other",
];

export interface KycRegistrationInput {
  firstName: string;
  lastName: string;
  email: string;
  phoneCode: string;
  phoneNumber: string;
  countryCode: string;
  dateOfBirth?: string | null;
  gender: string;

  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;

  businessType?: string;
  businessName?: string;
  businessAddress1?: string;
  businessAddress2?: string;
  businessCity?: string;
  businessState?: string;
  businessPostalCode?: string;
  businessCountry?: string;
  businessCountryCode?: string;

  medicalConditions?: string[];
  otherCondition?: string;
  prescribedSupplements?: string;

  hasHeartProblems: boolean;
  hasCancerTreatment: boolean;
  hasImmunosuppressants: boolean;
  hasLiverDisease: boolean;
  hasPsychiatricHistory: boolean;
  hasAlcoholAbuse: boolean;
  hasDrugServices: boolean;
  alcoholUnitsPerWeek?: string;
  cannabisReducesMeds: boolean;
  cannabisFrequency?: string;
  cannabisAmountPerDay?: string;

  // Phase 3 (BS-301): optional on Dr Green (US-301/302); stripped by its DTO
  // whitelist before that release. Consent is only ever an explicit true.
  title?: string | null;
  marketingConsent?: boolean;
  consentSource?: string;
}

/** YYYY-MM-DD; today when the form sent nothing (unchanged legacy default). */
function formatDateOfBirth(dateOfBirth: string | null | undefined): string {
  const date = dateOfBirth ? new Date(dateOfBirth) : new Date();
  return date.toISOString().split("T")[0];
}

// Only present when a condition maps to Dr Green's free-text slot, or the
// customer typed one. Capitalised list of the mapped keys wins over the free
// text, which wins over the fixed fallback — the order the route always used.
function otherMedicalCondition(
  body: KycRegistrationInput,
): { otherMedicalCondition: string } | Record<string, never> {
  const conditions = body.medicalConditions ?? [];
  const mapped = conditions.filter((c) => OTHER_CONDITION_KEYS.includes(c));
  if (mapped.length === 0 && !body.otherCondition) return {};
  return {
    otherMedicalCondition:
      mapped.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(", ") ||
      body.otherCondition ||
      "Other medical condition",
  };
}

function clientBusiness(
  body: KycRegistrationInput,
): { clientBusiness: Record<string, string> } | Record<string, never> {
  if (!body.businessType || !body.businessName) return {};
  return {
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
  };
}

export function buildKycClientPayload(body: KycRegistrationInput) {
  return {
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email.toLowerCase(), // Dr Green requires lowercase
    phoneCode: body.phoneCode.replace(/[^\+\d]/g, ""), // e.g. "+351"
    phoneCountryCode: body.countryCode, // e.g. "PT" (2-letter ISO code)
    contactNumber: body.phoneNumber.replace(/\D/g, ""), // digits only, NO prefix

    shipping: {
      address1: body.addressLine1,
      address2: body.addressLine2 || "",
      landmark: "",
      city: body.city,
      state: body.state,
      postalCode: body.postalCode,
      country: body.country,
      countryCode: toAlpha3(body.countryCode), // Convert PT → PRT
    },

    ...clientBusiness(body),

    ...(body.title ? { title: body.title } : {}),
    marketingConsent: body.marketingConsent === true,
    ...(body.consentSource ? { consentSource: body.consentSource } : {}),

    medicalRecord: {
      dob: formatDateOfBirth(body.dateOfBirth),
      gender: body.gender,
      medicalConditions: mapMedicalConditionsForDrGreen(body.medicalConditions || []),
      ...otherMedicalCondition(body),
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
      medicalHistory14:
        body.cannabisFrequency && body.cannabisFrequency !== "never"
          ? ["vaporizing"]
          : ["never"],
      medicalHistory15: body.cannabisAmountPerDay || "",
      medicalHistory16: false, // cannabisReaction
    },
  };
}
