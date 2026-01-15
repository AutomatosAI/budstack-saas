"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  User,
  MapPin,
  Stethoscope,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";

const personalDetailsSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
});

const addressSchema = z.object({
  street: z.string().min(5, "Street address is required"),
  city: z.string().min(2, "City is required"),
  postalCode: z.string().min(4, "Postal code is required"),
  country: z.string().min(2, "Country is required"),
});

const medicalSchema = z.object({
  conditions: z.string().min(10, "Please describe your medical conditions"),
  currentMedications: z.string().optional(),
  allergies: z.string().optional(),
  previousCannabisUse: z.boolean(),
  doctorApproval: z.boolean(),
  consent: z.boolean().refine((val) => val, "You must consent to continue"),
});

type PersonalDetails = z.infer<typeof personalDetailsSchema>;
type Address = z.infer<typeof addressSchema>;
type Medical = z.infer<typeof medicalSchema>;

const steps = [
  { id: "personal", title: "Personal Details", icon: User },
  { id: "address", title: "Shipping Address", icon: MapPin },
  { id: "medical", title: "Medical Information", icon: Stethoscope },
  { id: "complete", title: "Complete", icon: CheckCircle2 },
];

const countries = [
  { code: "PT", name: "Portugal" },
  { code: "ZA", name: "South Africa" },
  { code: "TH", name: "Thailand" },
  { code: "GB", name: "United Kingdom" },
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
            <Card
              className="border"
              style={{
                backgroundColor:
                  "var(--tenant-color-surface, var(--tenant-color-background))",
                borderColor: "var(--tenant-color-border, rgba(0,0,0,0.2))",
              }}
            >
              <CardHeader>
                <CardTitle
                  className="flex items-center gap-2"
                  style={{
                    color: "var(--tenant-color-heading)",
                    fontFamily: "var(--tenant-font-heading)",
                  }}
                >
                  <User className="h-5 w-5" />
                  Personal Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...personalForm}>
                  <form
                    onSubmit={personalForm.handleSubmit(handlePersonalSubmit)}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={personalForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel
                              style={{
                                color: "var(--tenant-color-text)",
                                fontFamily: "var(--tenant-font-base)",
                              }}
                            >
                              First Name
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="John"
                                {...field}
                                style={{
                                  backgroundColor:
                                    "var(--tenant-color-background)",
                                  borderColor:
                                    "var(--tenant-color-border, rgba(0,0,0,0.2))",
                                  color: "var(--tenant-color-text)",
                                  fontFamily: "var(--tenant-font-base)",
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={personalForm.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel
                              style={{
                                color: "var(--tenant-color-text)",
                                fontFamily: "var(--tenant-font-base)",
                              }}
                            >
                              Last Name
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Doe"
                                {...field}
                                style={{
                                  backgroundColor:
                                    "var(--tenant-color-background)",
                                  borderColor:
                                    "var(--tenant-color-border, rgba(0,0,0,0.2))",
                                  color: "var(--tenant-color-text)",
                                  fontFamily: "var(--tenant-font-base)",
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={personalForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel
                            style={{
                              color: "var(--tenant-color-text)",
                              fontFamily: "var(--tenant-font-base)",
                            }}
                          >
                            Email
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="john@example.com"
                              {...field}
                              style={{
                                backgroundColor:
                                  "var(--tenant-color-background)",
                                borderColor:
                                  "var(--tenant-color-border, rgba(0,0,0,0.2))",
                                color: "var(--tenant-color-text)",
                                fontFamily: "var(--tenant-font-base)",
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={personalForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel
                            style={{
                              color: "var(--tenant-color-text)",
                              fontFamily: "var(--tenant-font-base)",
                            }}
                          >
                            Phone Number
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="+351 123 456 789"
                              {...field}
                              style={{
                                backgroundColor:
                                  "var(--tenant-color-background)",
                                borderColor:
                                  "var(--tenant-color-border, rgba(0,0,0,0.2))",
                                color: "var(--tenant-color-text)",
                                fontFamily: "var(--tenant-font-base)",
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={personalForm.control}
                      name="dateOfBirth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel
                            style={{
                              color: "var(--tenant-color-text)",
                              fontFamily: "var(--tenant-font-base)",
                            }}
                          >
                            Date of Birth
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              {...field}
                              style={{
                                backgroundColor:
                                  "var(--tenant-color-background)",
                                borderColor:
                                  "var(--tenant-color-border, rgba(0,0,0,0.2))",
                                color: "var(--tenant-color-text)",
                                fontFamily: "var(--tenant-font-base)",
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      style={{
                        backgroundColor: "var(--tenant-color-primary)",
                        color: "white",
                        fontFamily: "var(--tenant-font-base)",
                      }}
                    >
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
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
            <Card
              className="border"
              style={{
                backgroundColor:
                  "var(--tenant-color-surface, var(--tenant-color-background))",
                borderColor: "var(--tenant-color-border, rgba(0,0,0,0.2))",
              }}
            >
              <CardHeader>
                <CardTitle
                  className="flex items-center gap-2"
                  style={{
                    color: "var(--tenant-color-heading)",
                    fontFamily: "var(--tenant-font-heading)",
                  }}
                >
                  <MapPin className="h-5 w-5" />
                  Shipping Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...addressForm}>
                  <form
                    onSubmit={addressForm.handleSubmit(handleAddressSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={addressForm.control}
                      name="street"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel
                            style={{
                              color: "var(--tenant-color-text)",
                              fontFamily: "var(--tenant-font-base)",
                            }}
                          >
                            Street Address
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="123 Main Street"
                              {...field}
                              style={{
                                backgroundColor:
                                  "var(--tenant-color-background)",
                                borderColor:
                                  "var(--tenant-color-border, rgba(0,0,0,0.2))",
                                color: "var(--tenant-color-text)",
                                fontFamily: "var(--tenant-font-base)",
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={addressForm.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel
                              style={{
                                color: "var(--tenant-color-text)",
                                fontFamily: "var(--tenant-font-base)",
                              }}
                            >
                              City
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Lisbon"
                                {...field}
                                style={{
                                  backgroundColor:
                                    "var(--tenant-color-background)",
                                  borderColor:
                                    "var(--tenant-color-border, rgba(0,0,0,0.2))",
                                  color: "var(--tenant-color-text)",
                                  fontFamily: "var(--tenant-font-base)",
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addressForm.control}
                        name="postalCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel
                              style={{
                                color: "var(--tenant-color-text)",
                                fontFamily: "var(--tenant-font-base)",
                              }}
                            >
                              Postal Code
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="1000-001"
                                {...field}
                                style={{
                                  backgroundColor:
                                    "var(--tenant-color-background)",
                                  borderColor:
                                    "var(--tenant-color-border, rgba(0,0,0,0.2))",
                                  color: "var(--tenant-color-text)",
                                  fontFamily: "var(--tenant-font-base)",
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={addressForm.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel
                            style={{
                              color: "var(--tenant-color-text)",
                              fontFamily: "var(--tenant-font-base)",
                            }}
                          >
                            Country
                          </FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger
                                style={{
                                  backgroundColor:
                                    "var(--tenant-color-background)",
                                  borderColor:
                                    "var(--tenant-color-border, rgba(0,0,0,0.2))",
                                  color: "var(--tenant-color-text)",
                                  fontFamily: "var(--tenant-font-base)",
                                }}
                              >
                                <SelectValue placeholder="Select country" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {countries.map((country) => (
                                <SelectItem
                                  key={country.code}
                                  value={country.code}
                                >
                                  {country.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={goBack}
                        className="flex-1"
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                      </Button>
                      <Button
                        type="submit"
                        className="flex-1"
                        style={{
                          backgroundColor: "var(--tenant-color-primary)",
                          color: "white",
                          fontFamily: "var(--tenant-font-base)",
                        }}
                      >
                        Continue
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
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
            <Card
              className="border"
              style={{
                backgroundColor:
                  "var(--tenant-color-surface, var(--tenant-color-background))",
                borderColor: "var(--tenant-color-border, rgba(0,0,0,0.2))",
              }}
            >
              <CardHeader>
                <CardTitle
                  className="flex items-center gap-2"
                  style={{
                    color: "var(--tenant-color-heading)",
                    fontFamily: "var(--tenant-font-heading)",
                  }}
                >
                  <Stethoscope className="h-5 w-5" />
                  Medical Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...medicalForm}>
                  <form
                    onSubmit={medicalForm.handleSubmit(handleMedicalSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={medicalForm.control}
                      name="conditions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel
                            style={{
                              color: "var(--tenant-color-text)",
                              fontFamily: "var(--tenant-font-base)",
                            }}
                          >
                            Medical Conditions
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe your medical conditions that you're seeking treatment for..."
                              className="min-h-[100px]"
                              {...field}
                              style={{
                                backgroundColor:
                                  "var(--tenant-color-background)",
                                borderColor:
                                  "var(--tenant-color-border, rgba(0,0,0,0.2))",
                                color: "var(--tenant-color-text)",
                                fontFamily: "var(--tenant-font-base)",
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={medicalForm.control}
                      name="currentMedications"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel
                            style={{
                              color: "var(--tenant-color-text)",
                              fontFamily: "var(--tenant-font-base)",
                            }}
                          >
                            Current Medications (Optional)
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="List any medications you're currently taking..."
                              {...field}
                              style={{
                                backgroundColor:
                                  "var(--tenant-color-background)",
                                borderColor:
                                  "var(--tenant-color-border, rgba(0,0,0,0.2))",
                                color: "var(--tenant-color-text)",
                                fontFamily: "var(--tenant-font-base)",
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={medicalForm.control}
                      name="allergies"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel
                            style={{
                              color: "var(--tenant-color-text)",
                              fontFamily: "var(--tenant-font-base)",
                            }}
                          >
                            Allergies (Optional)
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="List any known allergies..."
                              {...field}
                              style={{
                                backgroundColor:
                                  "var(--tenant-color-background)",
                                borderColor:
                                  "var(--tenant-color-border, rgba(0,0,0,0.2))",
                                color: "var(--tenant-color-text)",
                                fontFamily: "var(--tenant-font-base)",
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={medicalForm.control}
                      name="previousCannabisUse"
                      render={({ field }) => (
                        <FormItem className="flex items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel
                            className="font-normal"
                            style={{
                              color: "var(--tenant-color-text)",
                              fontFamily: "var(--tenant-font-base)",
                            }}
                          >
                            I have previous experience with medical cannabis
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={medicalForm.control}
                      name="doctorApproval"
                      render={({ field }) => (
                        <FormItem className="flex items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel
                            className="font-normal"
                            style={{
                              color: "var(--tenant-color-text)",
                              fontFamily: "var(--tenant-font-base)",
                            }}
                          >
                            I have discussed medical cannabis with my healthcare
                            provider
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={medicalForm.control}
                      name="consent"
                      render={({ field }) => (
                        <FormItem
                          className="flex items-start space-x-3 space-y-0 p-4 rounded-lg"
                          style={{
                            backgroundColor:
                              "rgba(var(--tenant-color-primary-rgb, 28, 79, 77), 0.1)",
                          }}
                        >
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1">
                            <FormLabel
                              className="font-normal"
                              style={{
                                color: "var(--tenant-color-text)",
                                fontFamily: "var(--tenant-font-base)",
                              }}
                            >
                              I consent to the processing of my medical
                              information
                            </FormLabel>
                            <p
                              className="text-xs"
                              style={{
                                color: "var(--tenant-color-text)",
                                fontFamily: "var(--tenant-font-base)",
                                opacity: 0.7,
                              }}
                            >
                              Your information will be handled in accordance
                              with GDPR and medical data protection regulations.
                            </p>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={goBack}
                        className="flex-1"
                        disabled={isSubmitting}
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                      </Button>
                      <Button
                        type="submit"
                        className="flex-1"
                        disabled={isSubmitting}
                        style={{
                          backgroundColor: "var(--tenant-color-primary)",
                          color: "white",
                          fontFamily: "var(--tenant-font-base)",
                        }}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            Submit
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 4: Complete */}
        {currentStep === 3 && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card
              className="border text-center"
              style={{
                backgroundColor:
                  "var(--tenant-color-surface, var(--tenant-color-background))",
                borderColor: "var(--tenant-color-border, rgba(0,0,0,0.2))",
              }}
            >
              <CardContent className="pt-8 pb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.2 }}
                  className="h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-6"
                  style={{
                    backgroundColor:
                      "rgba(var(--tenant-color-primary-rgb, 28, 79, 77), 0.2)",
                  }}
                >
                  <CheckCircle2
                    className="h-10 w-10"
                    style={{ color: "var(--tenant-color-primary)" }}
                  />
                </motion.div>
                <h2
                  className="text-2xl font-bold mb-2"
                  style={{
                    color: "var(--tenant-color-heading)",
                    fontFamily: "var(--tenant-font-heading)",
                  }}
                >
                  Registration Submitted!
                </h2>
                <p
                  className="mb-6"
                  style={{
                    color: "var(--tenant-color-text)",
                    fontFamily: "var(--tenant-font-base)",
                  }}
                >
                  Your application is being reviewed. You'll receive an email
                  with KYC instructions shortly.
                </p>
                <Button
                  onClick={() => router.push("/products")}
                  style={{
                    backgroundColor: "var(--tenant-color-primary)",
                    color: "white",
                    fontFamily: "var(--tenant-font-base)",
                  }}
                >
                  Return to Shop
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
