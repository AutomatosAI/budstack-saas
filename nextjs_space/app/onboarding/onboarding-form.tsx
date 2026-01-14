"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { Navbar, Footer } from "@/components/landing";
import {
  CheckCircle2,
  Store,
  Mail,
  Lock,
  Hash,
  Globe,
  MessageSquare,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Palette,
  Eye,
  Check,
  Rocket,
} from "lucide-react";

interface Template {
  id: string;
  name: string;
  description: string | null;
  thumbnailUrl: string | null;
  previewUrl: string | null;
}

// Fallback templates in case DB is empty
const DEFAULT_TEMPLATES = [
  {
    id: "modern",
    name: "Modern Green",
    description: "Clean and professional with green accents",
    thumbnailUrl: null,
    previewUrl: null,
  },
];

interface OnboardingFormProps {
  initialTemplates: Template[];
}

export default function OnboardingForm({
  initialTemplates = [],
}: OnboardingFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    businessName: "",
    email: "",
    password: "",
    subdomain: "",
    nftTokenId: "",
    countryCode: "PT",
    contactInfo: "",
    templateId: initialTemplates[0]?.id || "modern",
  });

  const templates =
    initialTemplates.length > 0 ? initialTemplates : DEFAULT_TEMPLATES;

  const totalSteps = 4;

  const handleSubmit = async () => {
    setIsLoading(true);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        let errorMessage = "Failed to submit application";
        try {
          const error = await res.json();
          errorMessage = error.error || errorMessage;
        } catch (parseError) {
          errorMessage = `Server error: ${res.status} ${res.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await res.json();
      toast.success(
        "Application submitted! We'll review your NFT and get back to you soon.",
      );
      router.push("/");
    } catch (error: any) {
      toast.error(error.message || "An unexpected error occurred");
      console.error("Onboarding error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateSubdomain = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 20);
  };

  const validateStep = (step: number) => {
    switch (step) {
      case 1:
        return formData.businessName && formData.subdomain;
      case 2:
        return formData.email && formData.password.length >= 6;
      case 3:
        return formData.nftTokenId && formData.countryCode;
      case 4:
        return formData.templateId;
      default:
        return false;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(Math.min(currentStep + 1, totalSteps));
    } else {
      toast.error("Please fill in all required fields");
    }
  };

  const prevStep = () => {
    setCurrentStep(Math.max(currentStep - 1, 1));
  };

  const steps = [
    { number: 1, title: "Business Info", icon: Store },
    { number: 2, title: "Account Setup", icon: Mail },
    { number: 3, title: "Verification", icon: Hash },
    { number: 4, title: "Choose Template", icon: Palette },
  ];

  const renderStepIndicator = () => {
    return (
      <div className="mb-10">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = currentStep === step.number;
            const isCompleted = currentStep > step.number;

            return (
              <div key={step.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex items-center justify-center w-14 h-14 rounded-2xl transition-all ${isActive
                        ? "bg-primary text-primary-foreground shadow-lg"
                        : isCompleted
                          ? "bg-success text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                  >
                    {isCompleted ? (
                      <Check className="h-6 w-6" />
                    ) : (
                      <StepIcon className="h-6 w-6" />
                    )}
                  </div>
                  <div className="mt-3 text-center">
                    <div
                      className={`text-sm font-medium ${isActive
                          ? "text-foreground"
                          : isCompleted
                            ? "text-success"
                            : "text-muted-foreground"
                        }`}
                    >
                      {step.title}
                    </div>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-4 rounded-full ${isCompleted ? "bg-success" : "bg-muted"
                      }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <Label htmlFor="businessName" className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Store className="h-4 w-4 text-accent" />
                Business Name *
              </Label>
              <Input
                id="businessName"
                value={formData.businessName}
                onChange={(e) => {
                  const name = e.target.value;
                  setFormData({
                    ...formData,
                    businessName: name,
                    subdomain: generateSubdomain(name),
                  });
                }}
                placeholder="e.g., Green Leaf Dispensary"
                className="mt-2 h-12 rounded-xl border-border bg-muted/30"
              />
              <p className="text-xs text-muted-foreground mt-2">
                The name of your dispensary
              </p>
            </div>

            <div>
              <Label htmlFor="subdomain" className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Globe className="h-4 w-4 text-accent" />
                Store URL *
              </Label>
              <div className="flex items-center mt-2">
                <Input
                  id="subdomain"
                  value={formData.subdomain}
                  onChange={(e) =>
                    setFormData({ ...formData, subdomain: e.target.value })
                  }
                  placeholder="yourstore"
                  className="flex-1 h-12 rounded-xl border-border bg-muted/30"
                />
                <span className="ml-3 text-muted-foreground font-medium">
                  .budstack.to
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Your unique store address:{" "}
                <span className="font-mono text-accent">
                  {formData.subdomain || "yourstore"}.budstack.to
                </span>
              </p>
            </div>

            <div>
              <Label htmlFor="contactInfo" className="flex items-center gap-2 text-sm font-medium text-foreground">
                <MessageSquare className="h-4 w-4 text-accent" />
                Tell Us About Your Business
              </Label>
              <Textarea
                id="contactInfo"
                value={formData.contactInfo}
                onChange={(e) =>
                  setFormData({ ...formData, contactInfo: e.target.value })
                }
                placeholder="Location, specialties, target customers, etc."
                rows={4}
                className="mt-2 rounded-xl border-border bg-muted/30"
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <Label htmlFor="email" className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Mail className="h-4 w-4 text-accent" />
                Admin Email *
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="admin@yourdispensary.com"
                className="mt-2 h-12 rounded-xl border-border bg-muted/30"
              />
              <p className="text-xs text-muted-foreground mt-2">
                You&apos;ll use this to sign in to your admin dashboard
              </p>
            </div>

            <div>
              <Label htmlFor="password" className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Lock className="h-4 w-4 text-accent" />
                Create Password *
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                minLength={6}
                placeholder="Minimum 6 characters"
                className="mt-2 h-12 rounded-xl border-border bg-muted/30"
              />
              <div className="mt-3 tile px-4 py-3">
                <div
                  className={`text-xs flex items-center gap-2 ${formData.password.length >= 6 ? "text-success" : "text-muted-foreground"}`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  At least 6 characters
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <Label htmlFor="nftTokenId" className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Hash className="h-4 w-4 text-accent" />
                NFT Token ID *
              </Label>
              <Input
                id="nftTokenId"
                value={formData.nftTokenId}
                onChange={(e) =>
                  setFormData({ ...formData, nftTokenId: e.target.value })
                }
                placeholder="Enter your NFT token ID"
                className="mt-2 h-12 rounded-xl border-border bg-muted/30"
              />
              <div className="mt-4 card-nested p-5 bg-accent/5">
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Rocket className="h-4 w-4 text-accent" />
                  About NFT Verification
                </h4>
                <ul className="text-xs text-muted-foreground space-y-2">
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-success" />
                    We&apos;ll verify your NFT ownership to activate your store
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-success" />
                    This ensures only licensed operators use the platform
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-success" />
                    Your store will be ready once verification is complete
                  </li>
                </ul>
              </div>
            </div>

            <div>
              <Label htmlFor="countryCode" className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Globe className="h-4 w-4 text-accent" />
                Operating Country *
              </Label>
              <select
                id="countryCode"
                value={formData.countryCode}
                onChange={(e) =>
                  setFormData({ ...formData, countryCode: e.target.value })
                }
                className="w-full h-12 px-4 mt-2 border border-border rounded-xl bg-muted/30 focus:ring-2 focus:ring-accent focus:border-transparent text-foreground"
              >
                <option value="PT">Portugal 🇵🇹</option>
                <option value="SA">South Africa 🇿🇦</option>
                <option value="GB">United Kingdom 🇬🇧</option>
                <option value="DE">Germany 🇩🇪</option>
                <option value="ES">Spain 🇪🇸</option>
                <option value="FR">France 🇫🇷</option>
                <option value="IT">Italy 🇮🇹</option>
                <option value="NL">Netherlands 🇳🇱</option>
                <option value="BE">Belgium 🇧🇪</option>
                <option value="AT">Austria 🇦🇹</option>
                <option value="IE">Ireland 🇮🇪</option>
                <option value="CH">Switzerland 🇨🇭</option>
                <option value="US">United States 🇺🇸</option>
                <option value="CA">Canada 🇨🇦</option>
                <option value="AU">Australia 🇦🇺</option>
              </select>
              <p className="text-xs text-muted-foreground mt-2">
                This affects currency, regulations, and localization
              </p>
            </div>
          </div>
        );

      case 4: {
        const selectedTemplate = templates.find((t) => t.id === formData.templateId);
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-display font-bold text-foreground mb-4">Choose Your Store Template</h3>
              <div className="grid grid-cols-2 gap-4">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, templateId: template.id })}
                    className={`card-nested p-5 text-left transition-all hover:shadow-lg ${formData.templateId === template.id
                        ? 'ring-2 ring-accent bg-accent/5'
                        : 'hover:bg-muted/50'
                      }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      {template.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={template.thumbnailUrl}
                          alt={template.name}
                          className="w-12 h-12 object-cover rounded-xl"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                          <Palette className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="font-semibold text-foreground">{template.name}</div>
                        {formData.templateId === template.id && (
                          <Badge className="mt-1 bg-accent text-accent-foreground">Selected</Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{template.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {selectedTemplate && (
              <div className="card-nested p-5 bg-success/5">
                <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Eye className="h-4 w-4 text-success" />
                  Preview: {selectedTemplate.name}
                </h4>
                {selectedTemplate.previewUrl && (
                  <div className="mt-3 aspect-video rounded-xl overflow-hidden border border-success/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedTemplate.previewUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-3">
                  You can customize everything later from your admin dashboard.
                </p>
              </div>
            )}
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          {/* Header */}
          <div className="mb-10 text-center">
            <div className="mb-4 flex justify-center">
              <div className="badge-pill">
                <Rocket className="h-4 w-4 text-accent" />
                <span>Join the Popcorn Media Ecosystem</span>
              </div>
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Apply for Franchise
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              Launch your medical cannabis dispensary in minutes
            </p>
          </div>

          {/* Form Card */}
          <div className="card-floating p-8 lg:p-10">
            <div className="mb-8">
              <h2 className="font-display text-xl font-semibold text-foreground">
                New Tenant Application
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Complete the steps below to create your dispensary store
              </p>
            </div>

            {renderStepIndicator()}

            <div className="min-h-[400px]">{renderStep()}</div>

            <div className="flex justify-between mt-10 pt-8 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={prevStep}
                disabled={currentStep === 1 || isLoading}
                className="rounded-xl"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>

              {currentStep < totalSteps ? (
                <Button
                  type="button"
                  variant="hero"
                  size="lg"
                  onClick={nextStep}
                  disabled={!validateStep(currentStep)}
                  className="rounded-xl"
                >
                  Next Step
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  variant="hero"
                  size="lg"
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="rounded-xl"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Submit Application
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Sign in link */}
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/auth/login"
                className="text-accent hover:underline font-medium"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
