"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConsultationFormData } from "../consultation-form";
import { CANNABIS_FREQUENCY_OPTIONS } from "@/lib/consultation-constants";
import { Loader2 } from "lucide-react";

interface MedicalHistoryPart2StepProps {
  data: ConsultationFormData;
  onUpdate: (data: Partial<ConsultationFormData>) => void;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}

export function MedicalHistoryPart2Step({
  data,
  onUpdate,
  onSubmit,
  onBack,
  isSubmitting,
}: MedicalHistoryPart2StepProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Medical History (Part Two)
        </h2>
        <p className="text-gray-600">
          Final questions about your medical history
        </p>
      </div>

      <div className="space-y-6">
        {/* Alcohol Abuse */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <Label className="text-base font-semibold mb-3 block">
            Do you have a history of alcohol abuse or dependency?*
          </Label>
          <RadioGroup
            value={data.hasAlcoholAbuse ? "yes" : "no"}
            onValueChange={(value) =>
              onUpdate({ hasAlcoholAbuse: value === "yes" })
            }
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="alcohol-yes" />
              <Label
                htmlFor="alcohol-yes"
                className="font-normal cursor-pointer"
              >
                Yes
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="alcohol-no" />
              <Label
                htmlFor="alcohol-no"
                className="font-normal cursor-pointer"
              >
                No
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Drug Services */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <Label className="text-base font-semibold mb-3 block">
            Have you ever been under the care of drug and alcohol services?*
          </Label>
          <RadioGroup
            value={data.hasDrugServices ? "yes" : "no"}
            onValueChange={(value) =>
              onUpdate({ hasDrugServices: value === "yes" })
            }
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="drug-yes" />
              <Label htmlFor="drug-yes" className="font-normal cursor-pointer">
                Yes
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="drug-no" />
              <Label htmlFor="drug-no" className="font-normal cursor-pointer">
                No
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Alcohol Units Per Week */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <Label
            htmlFor="alcoholUnitsPerWeek"
            className="text-base font-semibold mb-3 block"
          >
            How many units of Alcohol do you drink per week?*
          </Label>
          <Input
            id="alcoholUnitsPerWeek"
            type="number"
            min="0"
            value={data.alcoholUnitsPerWeek}
            onChange={(e) => onUpdate({ alcoholUnitsPerWeek: e.target.value })}
            placeholder="Enter number of units"
          />
        </div>

        {/* Cannabis Reduces Meds */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <Label className="text-base font-semibold mb-3 block">
            Do you use cannabis to reduce or eliminate the use of any
            medications that have been prescribed for your medical condition?*
          </Label>
          <RadioGroup
            value={data.cannabisReducesMeds ? "yes" : "no"}
            onValueChange={(value) =>
              onUpdate({ cannabisReducesMeds: value === "yes" })
            }
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="cannabis-meds-yes" />
              <Label
                htmlFor="cannabis-meds-yes"
                className="font-normal cursor-pointer"
              >
                Yes
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="cannabis-meds-no" />
              <Label
                htmlFor="cannabis-meds-no"
                className="font-normal cursor-pointer"
              >
                No
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Cannabis Frequency */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <Label
            htmlFor="cannabisFrequency"
            className="text-base font-semibold mb-3 block"
          >
            Cannabis History - If you do use cannabis currently, how often do
            you use cannabis?*
          </Label>
          <Select
            value={data.cannabisFrequency || "never"}
            onValueChange={(value) => onUpdate({ cannabisFrequency: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent>
              {CANNABIS_FREQUENCY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Cannabis Amount Per Day */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <Label
            htmlFor="cannabisAmountPerDay"
            className="text-base font-semibold mb-3 block"
          >
            How much cannabis do you currently use per day? (in Grams)*
          </Label>
          <Input
            id="cannabisAmountPerDay"
            type="text"
            value={data.cannabisAmountPerDay}
            onChange={(e) => onUpdate({ cannabisAmountPerDay: e.target.value })}
            placeholder="e.g., 2g or 0 if not applicable"
          />
        </div>
      </div>

      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onBack}
          disabled={isSubmitting}
        >
          Back
        </Button>
        <Button
          type="submit"
          size="lg"
          className="bg-emerald-600 hover:bg-emerald-700"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit Consultation"
          )}
        </Button>
      </div>
    </form>
  );
}
