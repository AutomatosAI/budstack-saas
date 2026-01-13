"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ConsultationFormData } from "../consultation-form";
import { COUNTRY_CODES } from "@/lib/consultation-constants";
import { cn } from "@/lib/utils";

interface ContactDetailsStepProps {
  data: ConsultationFormData;
  onUpdate: (data: Partial<ConsultationFormData>) => void;
  onNext: () => void;
}

export function ContactDetailsStep({
  data,
  onUpdate,
  onNext,
}: ContactDetailsStepProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!data.firstName.trim()) newErrors.firstName = "First name is required";
    if (!data.lastName.trim()) newErrors.lastName = "Last name is required";
    if (!data.email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
      newErrors.email = "Invalid email format";
    if (!data.phoneNumber.trim())
      newErrors.phoneNumber = "Contact number is required";
    if (!data.dateOfBirth) newErrors.dateOfBirth = "Date of birth is required";
    if (!data.gender) newErrors.gender = "Gender is required";
    if (!data.password) newErrors.password = "Password is required";
    else if (data.password.length < 8)
      newErrors.password = "Password must be at least 8 characters";
    if (!data.confirmPassword)
      newErrors.confirmPassword = "Please confirm password";
    else if (data.password !== data.confirmPassword)
      newErrors.confirmPassword = "Passwords do not match";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onNext();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Contact Details
        </h2>
        <p className="text-gray-600">
          Please provide your personal information
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="firstName">First Name*</Label>
          <Input
            id="firstName"
            value={data.firstName}
            onChange={(e) => onUpdate({ firstName: e.target.value })}
            className={errors.firstName ? "border-red-500" : ""}
          />
          {errors.firstName && (
            <p className="text-sm text-red-500 mt-1">{errors.firstName}</p>
          )}
        </div>

        <div>
          <Label htmlFor="lastName">Last Name*</Label>
          <Input
            id="lastName"
            value={data.lastName}
            onChange={(e) => onUpdate({ lastName: e.target.value })}
            className={errors.lastName ? "border-red-500" : ""}
          />
          {errors.lastName && (
            <p className="text-sm text-red-500 mt-1">{errors.lastName}</p>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="email">Email Address*</Label>
        <Input
          id="email"
          type="email"
          value={data.email}
          onChange={(e) => onUpdate({ email: e.target.value })}
          className={errors.email ? "border-red-500" : ""}
        />
        {errors.email && (
          <p className="text-sm text-red-500 mt-1">{errors.email}</p>
        )}
      </div>

      <div>
        <Label htmlFor="phoneNumber">Contact Number*</Label>
        <div className="flex gap-2">
          <Select
            value={data.phoneCode}
            onValueChange={(value) => {
              const country = COUNTRY_CODES.find((c) => c.phoneCode === value);
              onUpdate({
                phoneCode: value,
                countryCode: country?.code || "GB",
              });
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRY_CODES.map((country) => (
                <SelectItem key={country.code} value={country.phoneCode}>
                  {country.phoneCode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            id="phoneNumber"
            type="tel"
            placeholder="Phone number"
            value={data.phoneNumber}
            onChange={(e) => onUpdate({ phoneNumber: e.target.value })}
            className={cn("flex-1", errors.phoneNumber ? "border-red-500" : "")}
          />
        </div>
        {errors.phoneNumber && (
          <p className="text-sm text-red-500 mt-1">{errors.phoneNumber}</p>
        )}
      </div>

      <div>
        <Label>Date of Birth*</Label>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {/* Day Select */}
          <Select
            value={
              data.dateOfBirth ? data.dateOfBirth.getDate().toString() : ""
            }
            onValueChange={(value) => {
              const newDate = data.dateOfBirth
                ? new Date(data.dateOfBirth)
                : new Date(2000, 0, 1);
              newDate.setDate(parseInt(value));
              onUpdate({ dateOfBirth: newDate });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Day" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                <SelectItem key={day} value={day.toString()}>
                  {day}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Month Select */}
          <Select
            value={
              data.dateOfBirth ? data.dateOfBirth.getMonth().toString() : ""
            }
            onValueChange={(value) => {
              const newDate = data.dateOfBirth
                ? new Date(data.dateOfBirth)
                : new Date(2000, 0, 1);
              newDate.setMonth(parseInt(value));
              onUpdate({ dateOfBirth: newDate });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {[
                "January",
                "February",
                "March",
                "April",
                "May",
                "June",
                "July",
                "August",
                "September",
                "October",
                "November",
                "December",
              ].map((month, index) => (
                <SelectItem key={index} value={index.toString()}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Year Select */}
          <Select
            value={
              data.dateOfBirth ? data.dateOfBirth.getFullYear().toString() : ""
            }
            onValueChange={(value) => {
              const newDate = data.dateOfBirth
                ? new Date(data.dateOfBirth)
                : new Date(2000, 0, 1);
              newDate.setFullYear(parseInt(value));
              onUpdate({ dateOfBirth: newDate });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {Array.from(
                { length: 100 },
                (_, i) => new Date().getFullYear() - i,
              ).map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {errors.dateOfBirth && (
          <p className="text-sm text-red-500 mt-1">{errors.dateOfBirth}</p>
        )}
      </div>

      <div>
        <Label>Gender*</Label>
        <div className="flex gap-4 mt-2">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="gender"
              value="Male"
              checked={data.gender === "Male"}
              onChange={(e) => onUpdate({ gender: e.target.value })}
              className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm">Male</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="gender"
              value="Female"
              checked={data.gender === "Female"}
              onChange={(e) => onUpdate({ gender: e.target.value })}
              className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm">Female</span>
          </label>
        </div>
        {errors.gender && (
          <p className="text-sm text-red-500 mt-1">{errors.gender}</p>
        )}
      </div>

      <div>
        <Label htmlFor="password">Password*</Label>
        <Input
          id="password"
          type="password"
          value={data.password}
          onChange={(e) => onUpdate({ password: e.target.value })}
          className={errors.password ? "border-red-500" : ""}
        />
        {errors.password && (
          <p className="text-sm text-red-500 mt-1">{errors.password}</p>
        )}
      </div>

      <div>
        <Label htmlFor="confirmPassword">Confirm Password*</Label>
        <Input
          id="confirmPassword"
          type="password"
          value={data.confirmPassword}
          onChange={(e) => onUpdate({ confirmPassword: e.target.value })}
          className={errors.confirmPassword ? "border-red-500" : ""}
        />
        {errors.confirmPassword && (
          <p className="text-sm text-red-500 mt-1">{errors.confirmPassword}</p>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          size="lg"
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          Next Step
        </Button>
      </div>
    </form>
  );
}
