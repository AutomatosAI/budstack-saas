"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  ExternalLink,
  Clock,
  UserCheck,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ConsultationSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const [loading, setLoading] = useState(true);
  const [consultationData, setConsultationData] = useState<{
    questionnaireId?: string;
    drGreenClientId?: string;
    kycLink?: string;
    adminApproval?: string;
  }>({});

  useEffect(() => {
    // Get data from URL params
    const questionnaireId = searchParams.get("id");
    const drGreenClientId = searchParams.get("clientId");
    const kycLink = searchParams.get("kycLink");
    const adminApproval = searchParams.get("approval") || "PENDING";

    setConsultationData({
      questionnaireId: questionnaireId || undefined,
      drGreenClientId: drGreenClientId || undefined,
      kycLink: kycLink || undefined,
      adminApproval,
    });
    setLoading(false);
  }, [searchParams]);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center pb-24 lg:pb-0"
        style={{ backgroundColor: "var(--tenant-color-background)" }}
      >
        <Loader2
          className="h-8 w-8 animate-spin"
          style={{ color: "var(--tenant-color-primary)" }}
        />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-24 lg:pb-0 pt-28 md:pt-32"
      style={{ backgroundColor: "var(--tenant-color-background)" }}
    >
      <div className="max-w-2xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          {/* Success Header */}
          <Card
            className="border text-center mb-6"
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

              <h1
                className="text-3xl font-bold mb-3"
                style={{
                  color: "var(--tenant-color-heading)",
                  fontFamily: "var(--tenant-font-heading)",
                }}
              >
                Consultation Submitted!
              </h1>

              <p
                className="text-lg mb-2"
                style={{
                  color: "var(--tenant-color-text)",
                  fontFamily: "var(--tenant-font-base)",
                }}
              >
                Thank you for completing your medical consultation.
              </p>

              {consultationData.drGreenClientId && (
                <p
                  className="text-sm"
                  style={{
                    color: "var(--tenant-color-text)",
                    fontFamily: "var(--tenant-font-base)",
                    opacity: 0.7,
                  }}
                >
                  Client ID:{" "}
                  <span className="font-mono">
                    {consultationData.drGreenClientId}
                  </span>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Next Steps */}
          <Card
            className="border mb-6"
            style={{
              backgroundColor:
                "var(--tenant-color-surface, var(--tenant-color-background))",
              borderColor: "var(--tenant-color-border, rgba(0,0,0,0.2))",
            }}
          >
            <CardHeader>
              <CardTitle
                style={{
                  color: "var(--tenant-color-heading)",
                  fontFamily: "var(--tenant-font-heading)",
                }}
              >
                Next Steps
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Step 1: KYC Verification */}
              <div className="flex items-start gap-4">
                <div
                  className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: consultationData.kycLink
                      ? "rgba(var(--tenant-color-primary-rgb, 28, 79, 77), 0.2)"
                      : "rgba(100,100,100,0.2)",
                  }}
                >
                  {consultationData.kycLink ? (
                    <UserCheck
                      className="h-5 w-5"
                      style={{ color: "var(--tenant-color-primary)" }}
                    />
                  ) : (
                    <Clock
                      className="h-5 w-5"
                      style={{
                        color: "var(--tenant-color-text)",
                        opacity: 0.5,
                      }}
                    />
                  )}
                </div>
                <div className="flex-1">
                  <h3
                    className="font-semibold mb-1"
                    style={{
                      color: "var(--tenant-color-heading)",
                      fontFamily: "var(--tenant-font-heading)",
                    }}
                  >
                    1. Complete KYC Verification
                  </h3>
                  <p
                    className="text-sm mb-2"
                    style={{
                      color: "var(--tenant-color-text)",
                      fontFamily: "var(--tenant-font-base)",
                    }}
                  >
                    Verify your identity to comply with medical cannabis
                    regulations.
                  </p>
                  {consultationData.kycLink ? (
                    <Button
                      onClick={() =>
                        window.open(consultationData.kycLink, "_blank")
                      }
                      style={{
                        backgroundColor: "var(--tenant-color-primary)",
                        color: "white",
                        fontFamily: "var(--tenant-font-base)",
                      }}
                    >
                      Complete KYC Verification
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Alert>
                      <Clock className="h-4 w-4" />
                      <AlertDescription>
                        KYC link will be sent to your email shortly.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>

              {/* Step 2: Medical Review */}
              <div className="flex items-start gap-4">
                <div
                  className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "rgba(100,100,100,0.2)" }}
                >
                  <Clock
                    className="h-5 w-5"
                    style={{ color: "var(--tenant-color-text)", opacity: 0.5 }}
                  />
                </div>
                <div className="flex-1">
                  <h3
                    className="font-semibold mb-1"
                    style={{
                      color: "var(--tenant-color-heading)",
                      fontFamily: "var(--tenant-font-heading)",
                    }}
                  >
                    2. Medical Review
                  </h3>
                  <p
                    className="text-sm"
                    style={{
                      color: "var(--tenant-color-text)",
                      fontFamily: "var(--tenant-font-base)",
                    }}
                  >
                    Our medical team will review your consultation. You'll
                    receive an email once approved.
                  </p>
                  <div
                    className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm"
                    style={{ backgroundColor: "rgba(255,180,0,0.2)" }}
                  >
                    <Clock className="h-3 w-3" style={{ color: "#FFA500" }} />
                    <span
                      style={{
                        color: "#FFA500",
                        fontFamily: "var(--tenant-font-base)",
                      }}
                    >
                      Status: {consultationData.adminApproval || "PENDING"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 3: Start Shopping */}
              <div className="flex items-start gap-4">
                <div
                  className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "rgba(100,100,100,0.2)" }}
                >
                  <Clock
                    className="h-5 w-5"
                    style={{ color: "var(--tenant-color-text)", opacity: 0.5 }}
                  />
                </div>
                <div className="flex-1">
                  <h3
                    className="font-semibold mb-1"
                    style={{
                      color: "var(--tenant-color-heading)",
                      fontFamily: "var(--tenant-font-heading)",
                    }}
                  >
                    3. Start Shopping
                  </h3>
                  <p
                    className="text-sm"
                    style={{
                      color: "var(--tenant-color-text)",
                      fontFamily: "var(--tenant-font-base)",
                    }}
                  >
                    Once verified and approved, you can browse and purchase
                    medical cannabis products.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Information Alert */}
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription style={{ fontFamily: "var(--tenant-font-base)" }}>
              <strong>Verification typically takes 1-2 business days.</strong>{" "}
              You'll receive email notifications at each step of the process.
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => router.push(`/store/${slug}/products`)}
              className="flex-1"
              variant="outline"
            >
              View Products
            </Button>
            <Button
              onClick={() => router.push("/dashboard")}
              className="flex-1"
              style={{
                backgroundColor: "var(--tenant-color-primary)",
                color: "white",
                fontFamily: "var(--tenant-font-base)",
              }}
            >
              Go to Dashboard
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
