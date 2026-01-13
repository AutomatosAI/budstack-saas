"use client";

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

interface BusinessInfoStepProps {
  data: ConsultationFormData;
  onUpdate: (data: Partial<ConsultationFormData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function BusinessInfoStep({
  data,
  onUpdate,
  onNext,
  onBack,
}: BusinessInfoStepProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Type of Business
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

      <div className="flex justify-between">
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
