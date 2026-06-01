"use client";

import type { UseFormReturn } from "react-hook-form";
import { ArrowRight, User } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PersonalDetails } from "./onboarding-schema";

interface PersonalDetailsStepProps {
  form: UseFormReturn<PersonalDetails>;
  onSubmit: (data: PersonalDetails) => void;
}

export function PersonalDetailsStep({
  form,
  onSubmit,
}: PersonalDetailsStepProps) {
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
          <User className="h-5 w-5" />
          Personal Details
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
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
                control={form.control}
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
              control={form.control}
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
              control={form.control}
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
              control={form.control}
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
  );
}
