"use client";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface CompleteStepProps {
  onReturnToShop: () => void;
}

export function CompleteStep({ onReturnToShop }: CompleteStepProps) {
  return (
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
          onClick={onReturnToShop}
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
  );
}
