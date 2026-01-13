"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ConsultationFormData } from "../consultation-form";

interface MedicalHistoryPart1StepProps {
  data: ConsultationFormData;
  onUpdate: (data: Partial<ConsultationFormData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function MedicalHistoryPart1Step({
  data,
  onUpdate,
  onNext,
  onBack,
}: MedicalHistoryPart1StepProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Medical History (Part One)
        </h2>
        <p className="text-gray-600">Please answer the following questions</p>
      </div>

      <div className="space-y-6">
        {/* Heart Problems */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <Label className="text-base font-semibold mb-3 block">
            Do you have a history of heart problems?*
          </Label>
          <p className="text-sm text-gray-600 mb-3">
            Including palpitations, heart attack (MI), stroke, angina, chest
            pain, shortness of breath, arrhythmias (funny heart beats),
            pacemaker, or taking any heart medications
          </p>
          <RadioGroup
            value={data.hasHeartProblems ? "true" : "false"}
            onValueChange={(value) =>
              onUpdate({ hasHeartProblems: value === "true" })
            }
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="true" id="heart-true" />
              <Label
                htmlFor="heart-true"
                className="font-normal cursor-pointer"
              >
                True
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="false" id="heart-false" />
              <Label
                htmlFor="heart-false"
                className="font-normal cursor-pointer"
              >
                False
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Cancer Treatment */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <Label className="text-base font-semibold mb-3 block">
            Are you currently being treated for cancer or undergoing any cancer
            treatments?*
          </Label>
          <RadioGroup
            value={data.hasCancerTreatment ? "yes" : "no"}
            onValueChange={(value) =>
              onUpdate({ hasCancerTreatment: value === "yes" })
            }
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="cancer-yes" />
              <Label
                htmlFor="cancer-yes"
                className="font-normal cursor-pointer"
              >
                Yes
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="cancer-no" />
              <Label htmlFor="cancer-no" className="font-normal cursor-pointer">
                No
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Immunosuppressants */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <Label className="text-base font-semibold mb-3 block">
            Are you currently taking Immunosuppressants or Immunotherapy
            medication?*
          </Label>
          <RadioGroup
            value={data.hasImmunosuppressants ? "true" : "false"}
            onValueChange={(value) =>
              onUpdate({ hasImmunosuppressants: value === "true" })
            }
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="true" id="immuno-true" />
              <Label
                htmlFor="immuno-true"
                className="font-normal cursor-pointer"
              >
                True
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="false" id="immuno-false" />
              <Label
                htmlFor="immuno-false"
                className="font-normal cursor-pointer"
              >
                False
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Liver Disease */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <Label className="text-base font-semibold mb-3 block">
            Do you have any history of Liver Disease including hepatitis,
            elevated liver enzyme function blood tests, fatty liver cirrhosis?*
          </Label>
          <RadioGroup
            value={data.hasLiverDisease ? "true" : "false"}
            onValueChange={(value) =>
              onUpdate({ hasLiverDisease: value === "true" })
            }
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="true" id="liver-true" />
              <Label
                htmlFor="liver-true"
                className="font-normal cursor-pointer"
              >
                True
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="false" id="liver-false" />
              <Label
                htmlFor="liver-false"
                className="font-normal cursor-pointer"
              >
                False
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Psychiatric History */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <Label className="text-base font-semibold mb-3 block">
            Psychiatric history - Have you ever been referred to a psychiatrist
            health service?*
          </Label>
          <RadioGroup
            value={data.hasPsychiatricHistory ? "yes" : "no"}
            onValueChange={(value) =>
              onUpdate({ hasPsychiatricHistory: value === "yes" })
            }
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="psych-yes" />
              <Label htmlFor="psych-yes" className="font-normal cursor-pointer">
                Yes
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="psych-no" />
              <Label htmlFor="psych-no" className="font-normal cursor-pointer">
                No
              </Label>
            </div>
          </RadioGroup>
        </div>
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
