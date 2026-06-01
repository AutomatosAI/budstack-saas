"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { User, MapPin, Stethoscope, CheckCircle2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import {
  personalDetailsSchema,
  addressSchema,
  medicalSchema,
  type PersonalDetails,
  type Address,
  type Medical,
} from "./onboarding/onboarding-schema";
import { PersonalDetailsStep } from "./onboarding/PersonalDetailsStep";
import { AddressStep } from "./onboarding/AddressStep";
import { MedicalStep } from "./onboarding/MedicalStep";
import { CompleteStep } from "./onboarding/CompleteStep";

const steps = [
  { id: "personal", title: "Personal Details", icon: User },
  { id: "address", title: "Shipping Address", icon: MapPin },
  { id: "medical", title: "Medical Information", icon: Stethoscope },
  { id: "complete", title: "Complete", icon: CheckCircle2 },
];

export function ClientOnboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<{
    personal?: PersonalDetails;
    address?: Address;
    medical?: Medical;
  }>({});
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();

  const personalForm = useForm<PersonalDetails>({
    resolver: zodResolver(personalDetailsSchema),
    defaultValues: formData.personal || {
      firstName: "",
      lastName: "",
      email: user?.primaryEmailAddress?.emailAddress || "",
      phone: "",
      dateOfBirth: "",
    },
  });

  const addressForm = useForm<Address>({
    resolver: zodResolver(addressSchema),
    defaultValues: formData.address || {
      street: "",
      city: "",
      postalCode: "",
      country: "PT",
    },
  });

  const medicalForm = useForm<Medical>({
    resolver: zodResolver(medicalSchema),
    defaultValues: formData.medical || {
      conditions: "",
      currentMedications: "",
      allergies: "",
      previousCannabisUse: false,
      doctorApproval: false,
      consent: false,
    },
  });

  const handlePersonalSubmit = (data: PersonalDetails) => {
    setFormData((prev) => ({ ...prev, personal: data }));
    setCurrentStep(1);
  };

  const handleAddressSubmit = (data: Address) => {
    setFormData((prev) => ({ ...prev, address: data }));
    setCurrentStep(2);
  };

  const handleMedicalSubmit = async (data: Medical) => {
    if (!isSignedIn || !user) {
      toast.error("Authentication required", {
        description: "Please sign in to continue.",
      });
      return;
    }

    setFormData((prev) => ({ ...prev, medical: data }));
    setIsSubmitting(true);

    try {
      // Call API to create client
      const response = await fetch("/api/shop/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personal: formData.personal,
          address: formData.address,
          medicalRecord: data,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to submit registration");
      }

      setCurrentStep(3);
      toast.success("Registration submitted", {
        description: "Please complete KYC verification to continue.",
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      toast.error("Registration failed", {
        description: error.message || "Please try again later.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const goBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex justify-between">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`flex flex-col items-center ${index <= currentStep ? "" : "opacity-50"
                }`}
            >
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center mb-2 ${index < currentStep
                  ? "text-white"
                  : index === currentStep
                    ? "border-2"
                    : ""
                  }`}
                style={{
                  backgroundColor:
                    index < currentStep
                      ? "var(--tenant-color-primary)"
                      : index === currentStep
                        ? "transparent"
                        : "rgba(var(--tenant-color-primary-rgb, 28, 79, 77), 0.1)",
                  borderColor:
                    index === currentStep
                      ? "var(--tenant-color-primary)"
                      : "transparent",
                  color:
                    index === currentStep
                      ? "var(--tenant-color-primary)"
                      : index < currentStep
                        ? "white"
                        : "var(--tenant-color-text)",
                }}
              >
                {index < currentStep ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <step.icon className="h-5 w-5" />
                )}
              </div>
              <span
                className="text-xs hidden sm:block"
                style={{
                  color: "var(--tenant-color-text)",
                  fontFamily: "var(--tenant-font-base)",
                }}
              >
                {step.title}
              </span>
            </div>
          ))}
        </div>
        <div className="relative mt-2">
          <div
            className="absolute h-1 w-full rounded"
            style={{
              backgroundColor:
                "rgba(var(--tenant-color-primary-rgb, 28, 79, 77), 0.2)",
            }}
          />
          <motion.div
            className="absolute h-1 rounded"
            style={{ backgroundColor: "var(--tenant-color-primary)" }}
            initial={{ width: "0%" }}
            animate={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Personal Details */}
        {currentStep === 0 && (
          <motion.div
            key="personal"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <PersonalDetailsStep
              form={personalForm}
              onSubmit={handlePersonalSubmit}
            />
          </motion.div>
        )}

        {/* Step 2: Address */}
        {currentStep === 1 && (
          <motion.div
            key="address"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <AddressStep
              form={addressForm}
              onSubmit={handleAddressSubmit}
              onBack={goBack}
            />
          </motion.div>
        )}

        {/* Step 3: Medical Information - Continuing in next command due to length */}
        {/* Step 3: Medical Information */}
        {currentStep === 2 && (
          <motion.div
            key="medical"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <MedicalStep
              form={medicalForm}
              onSubmit={handleMedicalSubmit}
              onBack={goBack}
              isSubmitting={isSubmitting}
            />
          </motion.div>
        )}

        {/* Step 4: Complete */}
        {currentStep === 3 && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <CompleteStep onReturnToShop={() => router.push("/products")} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
