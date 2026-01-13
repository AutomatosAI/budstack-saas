"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ConsultationFormData } from "../consultation-form";
import {
  MEDICAL_CONDITIONS,
  PRESCRIBED_MEDICATIONS,
} from "@/lib/consultation-constants";

interface MedicalConditionsStepProps {
  data: ConsultationFormData;
  onUpdate: (data: Partial<ConsultationFormData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function MedicalConditionsStep({
  data,
  onUpdate,
  onNext,
  onBack,
}: MedicalConditionsStepProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (data.medicalConditions.length === 0) {
      newErrors.medicalConditions =
        "Please select at least one medical condition";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onNext();
    }
  };

  const toggleCondition = (value: string) => {
    const conditions = data.medicalConditions.includes(value)
      ? data.medicalConditions.filter((c) => c !== value)
      : [...data.medicalConditions, value];
    onUpdate({ medicalConditions: conditions });
  };

  const toggleMedication = (value: string) => {
    const medications = data.prescribedMedications.includes(value)
      ? data.prescribedMedications.filter((m) => m !== value)
      : [...data.prescribedMedications, value];
    onUpdate({ prescribedMedications: medications });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Medical Conditions
        </h2>
        <p className="text-gray-600">Please tick all that apply</p>
      </div>

      <div>
        <Label className="text-base font-semibold mb-3 block">
          Please select your medical condition(s). You may select more than
          one.*
        </Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto border rounded-md p-4">
          {MEDICAL_CONDITIONS.map((condition) => (
            <div key={condition.value} className="flex items-center space-x-2">
              <Checkbox
                id={condition.value}
                checked={data.medicalConditions.includes(condition.value)}
                onCheckedChange={() => toggleCondition(condition.value)}
              />
              <label
                htmlFor={condition.value}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {condition.label}
              </label>
            </div>
          ))}
        </div>
        {errors.medicalConditions && (
          <p className="text-sm text-red-500 mt-2">
            {errors.medicalConditions}
          </p>
        )}
      </div>

      {data.medicalConditions.includes("other") && (
        <div>
          <Label htmlFor="otherCondition">
            Please specify other condition(s)
          </Label>
          <Textarea
            id="otherCondition"
            value={data.otherCondition}
            onChange={(e) => onUpdate({ otherCondition: e.target.value })}
            placeholder="Describe your condition..."
            rows={3}
          />
        </div>
      )}

      <div>
        <Label className="text-base font-semibold mb-3 block">
          Please select Prescribed Medicines / Treatments (if any). You may
          select more than one.
        </Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto border rounded-md p-4">
          {PRESCRIBED_MEDICATIONS.map((medication) => (
            <div key={medication.value} className="flex items-center space-x-2">
              <Checkbox
                id={`med-${medication.value}`}
                checked={data.prescribedMedications.includes(medication.value)}
                onCheckedChange={() => toggleMedication(medication.value)}
              />
              <label
                htmlFor={`med-${medication.value}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {medication.label}
              </label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="prescribedSupplements">
          List of supplements or prescriptions (if any)
        </Label>
        <Textarea
          id="prescribedSupplements"
          value={data.prescribedSupplements}
          onChange={(e) => onUpdate({ prescribedSupplements: e.target.value })}
          placeholder="Enter any supplements or additional prescriptions..."
          rows={3}
        />
      </div>

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
