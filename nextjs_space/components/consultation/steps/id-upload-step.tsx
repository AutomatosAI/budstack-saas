"use client";

import { useRef, useState } from "react";
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
import { UploadCloud, FileCheck2 } from "lucide-react";

export type IdDocumentType = "ID" | "PASSPORT" | "DRIVING_LICENCE";

const ACCEPTED = "image/jpeg,image/png,application/pdf";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

interface IdUploadStepProps {
  file: File | null;
  documentType: IdDocumentType;
  documentNumber: string;
  onFileChange: (file: File | null) => void;
  onUpdate: (data: {
    documentType?: IdDocumentType;
    documentNumber?: string;
  }) => void;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}

export function IdUploadStep({
  file,
  documentType,
  documentNumber,
  onFileChange,
  onUpdate,
  onSubmit,
  onBack,
  isSubmitting,
}: IdUploadStepProps) {
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setError(null);
    if (f && f.size > MAX_BYTES) {
      setError("File must be under 10 MB.");
      return;
    }
    onFileChange(f);
  };

  const submit = () => {
    if (!file) return setError("Please upload a photo of your ID.");
    if (!documentNumber.trim())
      return setError("Please enter your document number.");
    setError(null);
    onSubmit();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Verify your identity
        </h2>
        <p className="text-gray-600">
          Upload a clear photo of a <strong>valid government ID</strong> (National
          ID, passport or driving licence). It must be your actual ID
          document&nbsp;— <strong>selfies or other photos will be rejected</strong>.
          An admin reviews it to verify your account — no medical consultation
          needed.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Document type</Label>
        <Select
          value={documentType}
          onValueChange={(v) => onUpdate({ documentType: v as IdDocumentType })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ID">National ID</SelectItem>
            <SelectItem value="PASSPORT">Passport</SelectItem>
            <SelectItem value="DRIVING_LICENCE">Driving licence</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="documentNumber">Document number</Label>
        <Input
          id="documentNumber"
          value={documentNumber}
          onChange={(e) => onUpdate({ documentNumber: e.target.value })}
          placeholder="As shown on your document"
        />
      </div>

      <div className="space-y-2">
        <Label>ID document</Label>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center transition-colors hover:border-emerald-400 hover:bg-emerald-50"
        >
          {file ? (
            <span className="flex flex-col items-center gap-2 text-emerald-700">
              <FileCheck2 className="h-8 w-8" />
              <span className="font-medium">{file.name}</span>
              <span className="text-xs text-gray-500">Tap to replace</span>
            </span>
          ) : (
            <span className="flex flex-col items-center gap-2 text-gray-500">
              <UploadCloud className="h-8 w-8" />
              <span className="font-medium">Tap to upload your ID</span>
              <span className="text-xs">JPG, PNG or PDF · up to 10 MB</span>
            </span>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={pick}
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-between pt-4">
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
          type="button"
          size="lg"
          onClick={submit}
          disabled={isSubmitting}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {isSubmitting ? "Creating account…" : "Create account & verify"}
        </Button>
      </div>
    </div>
  );
}
