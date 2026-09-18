import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/drgreen/dr-green-mapping", () => ({
  mapMedicalConditionsForDrGreen: (conditions: string[]) =>
    conditions.map((c) => `mapped:${c}`),
}));

import {
  buildKycClientPayload,
  type KycRegistrationInput,
} from "@/lib/drgreen/kyc-client-payload";

/**
 * The KYC payload builder was lifted out of the consultation submit route
 * unchanged. These pin the mappings a regression would silently break.
 */
const base: KycRegistrationInput = {
  firstName: "Ana",
  lastName: "Silva",
  email: "Ana.Silva@Example.com",
  phoneCode: "+351 ",
  phoneNumber: "912 345 678",
  countryCode: "PT",
  dateOfBirth: "1990-01-15T00:00:00.000Z",
  gender: "Female",
  addressLine1: "Rua A 1",
  addressLine2: "",
  city: "Lisboa",
  state: "Lisboa",
  postalCode: "1000-001",
  country: "Portugal",
  medicalConditions: ["anxiety"],
  otherCondition: "",
  prescribedSupplements: "",
  hasHeartProblems: false,
  hasCancerTreatment: false,
  hasImmunosuppressants: false,
  hasLiverDisease: false,
  hasPsychiatricHistory: true,
  hasAlcoholAbuse: false,
  hasDrugServices: false,
  alcoholUnitsPerWeek: "",
  cannabisReducesMeds: false,
  cannabisFrequency: "weekly",
  cannabisAmountPerDay: "1g",
};

describe("buildKycClientPayload", () => {
  it("normalises contact fields and converts the shipping country to alpha-3", () => {
    const payload = buildKycClientPayload(base);
    expect(payload.email).toBe("ana.silva@example.com");
    expect(payload.phoneCode).toBe("+351");
    expect(payload.contactNumber).toBe("912345678");
    expect(payload.phoneCountryCode).toBe("PT");
    expect(payload.shipping.countryCode).toBe("PRT");
    expect(payload.shipping.landmark).toBe("");
    expect("clientBusiness" in payload).toBe(false);
  });

  it("formats the date of birth as YYYY-MM-DD and maps the history flags", () => {
    const payload = buildKycClientPayload(base);
    expect(payload.medicalRecord.dob).toBe("1990-01-15");
    expect(payload.medicalRecord.medicalConditions).toEqual(["mapped:anxiety"]);
    expect(payload.medicalRecord.medicalHistory4).toBe(true);
    expect(payload.medicalRecord.medicalHistory5).toEqual(["depression"]);
    expect(payload.medicalRecord.medicalHistory13).toBe("weekly");
    expect(payload.medicalRecord.medicalHistory14).toEqual(["vaporizing"]);
    expect(payload.medicalRecord.medicalHistory11).toBe("0");
    expect("otherMedicalCondition" in payload.medicalRecord).toBe(false);
  });

  it("fills otherMedicalCondition from the mapped keys, then free text, then the fallback", () => {
    expect(
      buildKycClientPayload({ ...base, medicalConditions: ["asthma", "other"] }).medicalRecord
        .otherMedicalCondition,
    ).toBe("Asthma, Other");
    expect(
      buildKycClientPayload({ ...base, medicalConditions: [], otherCondition: "Migraine" })
        .medicalRecord.otherMedicalCondition,
    ).toBe("Migraine");
  });

  it("includes clientBusiness only when both type and name are present", () => {
    const withBusiness = buildKycClientPayload({
      ...base,
      businessType: "pharmacy",
      businessName: "Farmácia A",
    });
    expect(withBusiness.clientBusiness).toEqual(
      expect.objectContaining({ businessType: "pharmacy", name: "Farmácia A", countryCode: "" }),
    );
    expect(
      "clientBusiness" in buildKycClientPayload({ ...base, businessType: "pharmacy" }),
    ).toBe(false);
  });
});
