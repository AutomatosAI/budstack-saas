// Shared form-data shape for the multi-step consultation flow. Extracted from
// consultation-form.tsx so step components can import the type without creating
// an import cycle back into the form component (PRD-209 AC-6, import/no-cycle).
export interface ConsultationFormData {
  // Contact Details
  firstName: string;
  lastName: string;
  email: string;
  phoneCode: string;
  phoneNumber: string;
  dateOfBirth: Date | null;
  gender: string;
  password: string;
  confirmPassword: string;
  // US-023 (POPIA): explicit marketing opt-in — UNTICKED by default.
  marketingConsent: boolean;

  // Shipping Address
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  countryCode: string;

  // Business Info (Optional)
  businessType: string;
  businessName: string;
  businessAddress1: string;
  businessAddress2: string;
  businessCity: string;
  businessState: string;
  businessPostalCode: string;
  businessCountry: string;
  businessCountryCode: string;

  // Medical Conditions
  medicalConditions: string[];
  otherCondition: string;
  prescribedMedications: string[];
  prescribedSupplements: string;

  // Medical History Part 1
  hasHeartProblems: boolean;
  hasCancerTreatment: boolean;
  hasImmunosuppressants: boolean;
  hasLiverDisease: boolean;
  hasPsychiatricHistory: boolean;

  // Medical History Part 2
  hasAlcoholAbuse: boolean;
  hasDrugServices: boolean;
  alcoholUnitsPerWeek: string;
  cannabisReducesMeds: boolean;
  cannabisFrequency: string;
  cannabisAmountPerDay: string;
}
