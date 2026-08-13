"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ContactDetailsStep } from "./steps/contact-details-step";
import { AddressStep } from "./steps/address-step";
import { MedicalConditionsStep } from "./steps/medical-conditions-step";
import { MedicalHistoryPart1Step } from "./steps/medical-history-part1-step";
import { MedicalHistoryPart2Step } from "./steps/medical-history-part2-step";
import { toast } from "@/components/ui/sonner";
import { useRouter } from "next/navigation";
import type { ConsultationFormData } from "./consultation-form-types";

const TOTAL_STEPS = 5;
const STEP_NAMES = [
  "Contact Details",
  "Address Information",
  "Medical Conditions",
  "Medical History (Part 1)",
  "Medical History (Part 2)",
];

interface ConsultationFormProps {
  tenantSlug: string;
}

export function ConsultationForm({
  tenantSlug,
}: ConsultationFormProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ConsultationFormData>({
    firstName: "",
    lastName: "",
    email: "",
    phoneCode: "+44",
    phoneNumber: "",
    dateOfBirth: null,
    gender: "",
    password: "",
    confirmPassword: "",
    marketingConsent: false,

    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "United Kingdom",
    countryCode: "GB",

    businessType: "",
    businessName: "",
    businessAddress1: "",
    businessAddress2: "",
    businessCity: "",
    businessState: "",
    businessPostalCode: "",
    businessCountry: "",
    businessCountryCode: "",

    medicalConditions: [],
    otherCondition: "",
    prescribedMedications: [],
    prescribedSupplements: "",

    hasHeartProblems: false,
    hasCancerTreatment: false,
    hasImmunosuppressants: false,
    hasLiverDisease: false,
    hasPsychiatricHistory: false,

    hasAlcoholAbuse: false,
    hasDrugServices: false,
    alcoholUnitsPerWeek: "",
    cannabisReducesMeds: false,
    cannabisFrequency: "",
    cannabisAmountPerDay: "",
  });

  const progress = (currentStep / TOTAL_STEPS) * 100;

  const formRef = useRef<HTMLDivElement>(null);

  const scrollToFormTop = () => {
    if (formRef.current) {
      // 120px offset to gracefully account for the sticky glassmorphic header
      const yOffset = -120;
      const y = formRef.current.getBoundingClientRect().top + window.scrollY + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
      scrollToFormTop();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      scrollToFormTop();
    }
  };

  const handleUpdateFormData = (data: Partial<ConsultationFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/consultation/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          // SECURITY: Send the tenant SLUG (public, in URL) — NEVER the
          // internal tenantId UUID. Server resolves tenant from request
          // host first; this slug is only used as a localhost dev fallback.
          tenantSlug,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to submit consultation");
      }

      toast.success("Consultation submitted successfully!");

      // All storefronts use subdomain routing ([slug].budstacks.io)
      // Middleware rewrites bare paths → /store/slug/... automatically
      const successParams = new URLSearchParams({
        id: result.questionnaireId || "",
        clientId: result.drGreenClientId || "",
        ...(result.kycLink && { kycLink: result.kycLink }),
        approval: result.adminApproval || "PENDING",
      }).toString();

      router.push(`/consultation/success?${successParams}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to submit consultation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <ContactDetailsStep
            data={formData}
            onUpdate={handleUpdateFormData}
            onNext={handleNext}
          />
        );
      case 2:
        return (
          <AddressStep
            data={formData}
            onUpdate={handleUpdateFormData}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 3:
        return (
          <MedicalConditionsStep
            data={formData}
            onUpdate={handleUpdateFormData}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 4:
        return (
          <MedicalHistoryPart1Step
            data={formData}
            onUpdate={handleUpdateFormData}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 5:
        return (
          <MedicalHistoryPart2Step
            data={formData}
            onUpdate={handleUpdateFormData}
            onSubmit={handleSubmit}
            onBack={handleBack}
            isSubmitting={isSubmitting}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4" ref={formRef}>
      <Card>
        <CardContent className="pt-6">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Step {currentStep} of {TOTAL_STEPS}
              </span>
              <span className="text-sm font-medium text-gray-700">
                {STEP_NAMES[currentStep - 1]}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Step Content */}
          {renderStep()}
        </CardContent>
      </Card>
    </div>
  );
}
