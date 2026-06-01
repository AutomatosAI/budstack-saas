"use client";

import type { UseFormReturn } from "react-hook-form";
import { ArrowLeft, ArrowRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { Address } from "./onboarding-schema";

const countries = [
  { code: "PT", name: "Portugal" },
  { code: "ZA", name: "South Africa" },
  { code: "TH", name: "Thailand" },
  { code: "GB", name: "United Kingdom" },
];

interface AddressStepProps {
  form: UseFormReturn<Address>;
  onSubmit: (data: Address) => void;
  onBack: () => void;
}

export function AddressStep({ form, onSubmit, onBack }: AddressStepProps) {
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
          <MapPin className="h-5 w-5" />
          Shipping Address
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
                control={form.control}
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
                control={form.control}
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
              control={form.control}
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
                onClick={onBack}
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
  );
}
