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
import { ConsultationFormData } from "../consultation-form";
import { BUSINESS_TYPES, COUNTRY_CODES } from "@/lib/consultation-constants";

interface AddressStepProps {
  data: ConsultationFormData;
  onUpdate: (data: Partial<ConsultationFormData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function AddressStep({
  data,
  onUpdate,
  onNext,
  onBack,
}: AddressStepProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!data.addressLine1.trim())
      newErrors.addressLine1 = "Address Line 1 is required";
    if (!data.city.trim()) newErrors.city = "City is required";
    if (!data.state.trim()) newErrors.state = "State is required";
    if (!data.postalCode.trim())
      newErrors.postalCode = "Postal Code is required";
    if (!data.country) newErrors.country = "Country is required";

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
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Shipping Address Section */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Shipping Address
          </h2>
          <p className="text-gray-600">Where should we deliver your order?</p>
        </div>

        <div>
          <Label htmlFor="addressLine1">Address Line 1*</Label>
          <Input
            id="addressLine1"
            value={data.addressLine1}
            onChange={(e) => onUpdate({ addressLine1: e.target.value })}
            className={errors.addressLine1 ? "border-red-500" : ""}
          />
          {errors.addressLine1 && (
            <p className="text-sm text-red-500 mt-1">{errors.addressLine1}</p>
          )}
        </div>

        <div>
          <Label htmlFor="addressLine2">Address Line 2</Label>
          <Input
            id="addressLine2"
            value={data.addressLine2}
            onChange={(e) => onUpdate({ addressLine2: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="city">City*</Label>
            <Input
              id="city"
              value={data.city}
              onChange={(e) => onUpdate({ city: e.target.value })}
              className={errors.city ? "border-red-500" : ""}
            />
            {errors.city && (
              <p className="text-sm text-red-500 mt-1">{errors.city}</p>
            )}
          </div>

          <div>
            <Label htmlFor="state">State*</Label>
            <Input
              id="state"
              value={data.state}
              onChange={(e) => onUpdate({ state: e.target.value })}
              className={errors.state ? "border-red-500" : ""}
            />
            {errors.state && (
              <p className="text-sm text-red-500 mt-1">{errors.state}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="postalCode">Postal Code*</Label>
            <Input
              id="postalCode"
              value={data.postalCode}
              onChange={(e) => onUpdate({ postalCode: e.target.value })}
              className={errors.postalCode ? "border-red-500" : ""}
            />
            {errors.postalCode && (
              <p className="text-sm text-red-500 mt-1">{errors.postalCode}</p>
            )}
          </div>

          <div>
            <Label htmlFor="country">Country*</Label>
            <Select
              value={data.countryCode || "GB"}
              onValueChange={(value) => {
                const country = COUNTRY_CODES.find((c) => c.code === value);
                onUpdate({
                  countryCode: value,
                  country: country?.label || "",
                  // DO NOT update phoneCode - user selected it on previous step!
                });
              }}
            >
              <SelectTrigger className={errors.country ? "border-red-500" : ""}>
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRY_CODES.map((country) => (
                  <SelectItem key={country.code} value={country.code}>
                    {country.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.country && (
              <p className="text-sm text-red-500 mt-1">{errors.country}</p>
            )}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200 my-8"></div>

      {/* Business Address Section */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Business Information
          </h2>
          <p className="text-gray-600">
            Optional - Only complete if ordering for a business
          </p>
        </div>

        <div>
          <Label htmlFor="businessType">Business Type</Label>
          <Select
            value={data.businessType || "none"}
            onValueChange={(value) =>
              onUpdate({ businessType: value === "none" ? "" : value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select business type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {BUSINESS_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {data.businessType && (
          <>
            <div>
              <Label htmlFor="businessName">Business Name</Label>
              <Input
                id="businessName"
                value={data.businessName}
                onChange={(e) => onUpdate({ businessName: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="businessAddress1">Business Address Line 1</Label>
              <Input
                id="businessAddress1"
                value={data.businessAddress1}
                onChange={(e) => onUpdate({ businessAddress1: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="businessAddress2">Business Address Line 2</Label>
              <Input
                id="businessAddress2"
                value={data.businessAddress2}
                onChange={(e) => onUpdate({ businessAddress2: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="businessCity">Business City</Label>
                <Input
                  id="businessCity"
                  value={data.businessCity}
                  onChange={(e) => onUpdate({ businessCity: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="businessState">Business State</Label>
                <Input
                  id="businessState"
                  value={data.businessState}
                  onChange={(e) => onUpdate({ businessState: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="businessPostalCode">Business Postal Code</Label>
                <Input
                  id="businessPostalCode"
                  value={data.businessPostalCode}
                  onChange={(e) =>
                    onUpdate({ businessPostalCode: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="businessCountry">Business Country</Label>
                <Select
                  value={data.businessCountryCode || "none"}
                  onValueChange={(value) => {
                    const country = COUNTRY_CODES.find((c) => c.code === value);
                    onUpdate({
                      businessCountryCode: value === "none" ? "" : value,
                      businessCountry: country?.label || "",
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {COUNTRY_CODES.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" size="lg" onClick={onBack}>
          Back
        </Button>
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
