"use client";

import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ContactDetailsStep } from "./steps/contact-details-step";
import { AddressStep } from "./steps/address-step";
import { IdUploadStep, type IdDocumentType } from "./steps/id-upload-step";
import { toast } from "@/components/ui/sonner";
import { useRouter } from "next/navigation";
import type { ConsultationFormData } from "./consultation-form-types";

/**
 * SA ID-upload registration — the same stepped UI as the medical consultation,
 * but only Step 1 (Contact) + Step 2 (Address) + a Step 3 ID upload. The medical
 * steps are dropped. The final action creates the account + Dr Green ID-client
 * and uploads the document in one server call (see /api/consultation/submit's
 * idMode path), then lands on the pending-review screen.
 */
const TOTAL_STEPS = 3;
const STEP_NAMES = ["Contact Details", "Address Information", "Verify Identity"];

interface IdUploadFormProps {
  tenantSlug: string;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // strip the "data:<mime>;base64," prefix
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export function IdUploadForm({ tenantSlug }: IdUploadFormProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [idFile, setIdFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<IdDocumentType>("ID");
  const [documentNumber, setDocumentNumber] = useState("");

  const [formData, setFormData] = useState<ConsultationFormData>({
    firstName: "",
    lastName: "",
    email: "",
    phoneCode: "+27",
    phoneNumber: "",
    dateOfBirth: null,
    gender: "",
    password: "",
    confirmPassword: "",

    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "South Africa",
    countryCode: "ZA",

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

  const scrollToTop = () => {
    if (formRef.current) {
      const y =
        formRef.current.getBoundingClientRect().top + window.scrollY - 120;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((s) => s + 1);
      scrollToTop();
    }
  };
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
      scrollToTop();
    }
  };
  const handleUpdateFormData = (data: Partial<ConsultationFormData>) =>
    setFormData((prev) => ({ ...prev, ...data }));

  const handleSubmit = async () => {
    if (!idFile) {
      toast.error("Please upload your ID.");
      return;
    }
    setIsSubmitting(true);
    try {
      const fileBase64 = await fileToBase64(idFile);
      const response = await fetch("/api/consultation/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          tenantSlug,
          idDocument: {
            fileBase64,
            mimeType: idFile.type,
            documentType,
            documentNumber,
          },
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Registration failed");
      }

      toast.success("Account created — your ID is pending review.");
      const params = new URLSearchParams({
        id: result.questionnaireId || "",
        clientId: result.drGreenClientId || "",
        approval: result.adminApproval || "PENDING",
        flow: "id", // success page renders the ID-upload copy, not KYC
      }).toString();
      router.push(`/consultation/success?${params}`);
    } catch (error: any) {
      toast.error(error.message || "Registration failed. Please try again.");
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
          <IdUploadStep
            file={idFile}
            documentType={documentType}
            documentNumber={documentNumber}
            onFileChange={setIdFile}
            onUpdate={(d) => {
              if (d.documentType !== undefined) setDocumentType(d.documentType);
              if (d.documentNumber !== undefined)
                setDocumentNumber(d.documentNumber);
            }}
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
