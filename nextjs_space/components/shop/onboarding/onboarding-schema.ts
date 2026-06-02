import { z } from "zod";

export const personalDetailsSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
});

export const addressSchema = z.object({
  street: z.string().min(5, "Street address is required"),
  city: z.string().min(2, "City is required"),
  postalCode: z.string().min(4, "Postal code is required"),
  country: z.string().min(2, "Country is required"),
});

export const medicalSchema = z.object({
  conditions: z.string().min(10, "Please describe your medical conditions"),
  currentMedications: z.string().optional(),
  allergies: z.string().optional(),
  previousCannabisUse: z.boolean(),
  doctorApproval: z.boolean(),
  consent: z.boolean().refine((val) => val, "You must consent to continue"),
});

export type PersonalDetails = z.infer<typeof personalDetailsSchema>;
export type Address = z.infer<typeof addressSchema>;
export type Medical = z.infer<typeof medicalSchema>;
