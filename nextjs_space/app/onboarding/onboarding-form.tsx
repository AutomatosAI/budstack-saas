"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
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

  const renderStepIndicator = () => {
    const steps = [
      { number: 1, title: "Business Info", icon: Store },
      { number: 2, title: "Account Setup", icon: Mail },
      { number: 3, title: "Verification", icon: Hash },
      { number: 4, title: "Choose Template", icon: Palette },
    ];

    return (
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = currentStep === step.number;
            const isCompleted = currentStep > step.number;

            return (
              <div key={step.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all ${
                      isActive
                        ? "bg-primary border-primary text-white"
                        : isCompleted
                          ? "bg-green-500 border-green-500 text-white"
                          : "bg-gray-100 border-gray-300 text-gray-400"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-6 w-6" />
                    ) : (
                      <StepIcon className="h-6 w-6" />
                    )}
                  </div>
                  <div className="mt-2 text-center">
                    <div
                      className={`text-sm font-medium ${
                        isActive
                          ? "text-primary"
                          : isCompleted
                            ? "text-green-600"
                            : "text-gray-500"
                      }`}
                    >
                      {step.title}
                    </div>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 ${
                      isCompleted ? "bg-green-500" : "bg-gray-300"
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
              <Label htmlFor="businessName" className="flex items-center gap-2">
                <Store className="h-4 w-4" />
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
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                The name of your dispensary
              </p>
            </div>

            <div>
              <Label htmlFor="subdomain" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
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
                  className="flex-1"
                />
                <span className="ml-2 text-gray-500 font-medium">
                  .budstack.to
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Your unique store address:{" "}
                <span className="font-mono text-primary">
                  {formData.subdomain || "yourstore"}.budstack.to
                </span>
              </p>
            </div>

            <div>
              <Label htmlFor="contactInfo" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
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
                className="mt-2"
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
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
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                You'll use this to sign in to your admin dashboard
              </p>
            </div>

            <div>
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
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
                className="mt-2"
              />
              <div className="mt-2 space-y-1">
                <div
                  className={`text-xs flex items-center gap-2 ${formData.password.length >= 6 ? "text-green-600" : "text-gray-400"}`}
                >
                  <CheckCircle2 className="h-3 w-3" />
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
              <Label htmlFor="nftTokenId" className="flex items-center gap-2">
                <Hash className="h-4 w-4" />
                NFT Token ID *
              </Label>
              <Input
                id="nftTokenId"
                value={formData.nftTokenId}
                onChange={(e) =>
                  setFormData({ ...formData, nftTokenId: e.target.value })
                }
                placeholder="Enter your NFT token ID"
                className="mt-2"
              />
              <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">
                  📝 About NFT Verification
                </h4>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>
                    ✓ We'll verify your NFT ownership to activate your store
                  </li>
                  <li>
                    ✓ This ensures only licensed operators use the platform
                  </li>
                  <li>
                    ✓ Your store will be ready once verification is complete
                  </li>
                </ul>
              </div>
            </div>

            <div>
              <Label htmlFor="countryCode" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Operating Country *
              </Label>
              <select
                id="countryCode"
                value={formData.countryCode}
                onChange={(e) =>
                  setFormData({ ...formData, countryCode: e.target.value })
                }
                className="w-full px-3 py-2 mt-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
              >
                <option value="PT">Portugal 🇵🇹</option>
                <option value="SA">South Africa 🇿🇦</option>
                <option value="UK">United Kingdom 🇬🇧</option>
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
              <p className="text-xs text-gray-500 mt-1">
                This affects currency, regulations, and localization
              </p>
            </div>
          </div>
        );

                        <div>
                            <Label htmlFor="countryCode" className="flex items-center gap-2">
                                <Globe className="h-4 w-4" />
                                Operating Country *
                            </Label>
                            <select
                                id="countryCode"
                                value={formData.countryCode}
                                onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}
                                className="w-full px-3 py-2 mt-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
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
                            <p className="text-xs text-gray-500 mt-1">This affects currency, regulations, and localization</p>
                        </div>
                    </div>
                );

            case 4: {
                const selectedTemplate = templates.find((t) => t.id === formData.templateId);
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold mb-4">Choose Your Store Template</h3>
                            <div className="grid grid-cols-2 gap-4">
                                {templates.map((template) => (
                                    <button
                                        key={template.id}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, templateId: template.id })}
                                        className={`p-4 border-2 rounded-lg text-left transition-all hover:shadow-lg ${formData.templateId === template.id
                                                ? 'border-primary bg-primary/5'
                                                : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3 mb-3">
                                            {template.thumbnailUrl ? (
                                                <img
                                                    src={template.thumbnailUrl}
                                                    alt={template.name}
                                                    className="w-12 h-12 object-cover rounded-lg"
                                                />
                                            ) : (
                                                <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center">
                                                    <Palette className="h-6 w-6 text-slate-400" />
                                                </div>
                                            )}
                                            <div className="flex-1">
                                                <div className="font-semibold">{template.name}</div>
                                                {formData.templateId === template.id && (
                                                    <Badge className="mt-1">Selected</Badge>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-600 line-clamp-2">{template.description}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="font-semibold">{template.name}</div>
                        {formData.templateId === template.id && (
                          <Badge className="mt-1">Selected</Badge>
                        )}
                      </div>
                    </div>
                );
            }

            {selectedTemplate && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="text-sm font-semibold text-green-900 mb-2 flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Preview: {selectedTemplate.name}
                </h4>
                {selectedTemplate.previewUrl && (
                  <div className="mt-2 aspect-video rounded-lg overflow-hidden border border-green-100">
                    <img
                      src={selectedTemplate.previewUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <p className="text-xs text-green-800 mt-3">
                  You can customize everything later from your admin dashboard.
                </p>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Join BudStack
          </h1>
          <p className="text-lg text-gray-600">
            Launch your medical cannabis dispensary in minutes
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>New Tenant Application</CardTitle>
            <CardDescription>
              Complete the steps below to create your dispensary store
            </CardDescription>
          </CardHeader>
          <CardContent>
            {renderStepIndicator()}
            <div className="min-h-[400px]">{renderStep()}</div>
            <div className="flex justify-between mt-8 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1 || isLoading}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>

              {currentStep < totalSteps ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  disabled={!validateStep(currentStep)}
                >
                  Next Step
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={isLoading}>
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
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="text-primary hover:underline font-medium"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
