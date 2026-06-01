"use client";

import type { UseFormReturn } from "react-hook-form";
import { ArrowLeft, ArrowRight, Loader2, Stethoscope } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Medical } from "./onboarding-schema";

interface MedicalStepProps {
  form: UseFormReturn<Medical>;
  onSubmit: (data: Medical) => Promise<void> | void;
  onBack: () => void;
  isSubmitting: boolean;
}

export function MedicalStep({
  form,
  onSubmit,
  onBack,
  isSubmitting,
}: MedicalStepProps) {
  return (
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
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
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
              control={form.control}
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
              control={form.control}
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
              control={form.control}
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
              control={form.control}
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
              control={form.control}
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
                onClick={onBack}
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
  );
}
