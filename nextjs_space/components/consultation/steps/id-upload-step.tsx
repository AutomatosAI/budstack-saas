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
import { saIdFieldError } from "@/lib/verification/sa-id";

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
  /**
   * BS-203: an SA_ID_INVALID answer from the submit route (or from Dr Green
   * through it) — shown on the number field, never as a generic banner.
   */
  documentNumberError?: string | null;
  /**
   * Apply the South African ID rules to the ID option. This step only renders
   * on ID-upload tenants, which are South African by construction
   * (lib/verification-mode.ts), so the rules are on unless a caller says not.
   */
  validateSaId?: boolean;
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
  documentNumberError = null,
  validateSaId = true,
}: IdUploadStepProps) {
  const [error, setError] = useState<string | null>(null);
  const [numberError, setNumberError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const idOptionLabel = validateSaId ? "South African ID" : "National ID";
  const fieldError = numberError ?? documentNumberError;

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setError(null);
    if (f && f.size > MAX_BYTES) {
      setError("File must be under 10 MB.");
      return;
    }
    onFileChange(f);
  };

  // BS-203: the shared rules, on blur and on submit, only for the ID option.
  const checkNumber = (): boolean => {
    const message = saIdFieldError({
      documentType,
      documentNumber,
      enforce: validateSaId,
    });
    setNumberError(message);
    return message === null;
  };

  const submit = () => {
    if (!file) return setError("Please upload a photo of your ID.");
    if (!documentNumber.trim())
      return setError("Please enter your document number.");
    if (!checkNumber()) return;
    setError(null);
    onSubmit();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-card-foreground mb-2">
          Verify your identity
        </h2>
        <p className="text-muted-foreground">
          Upload a clear photo of a <strong>valid government ID</strong> (
          {idOptionLabel}, passport or driving licence). It must be your actual
          ID document&nbsp;— <strong>selfies or other photos will be rejected</strong>.
          An admin reviews it to verify your account — no medical consultation
          needed.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Document type</Label>
        <Select
          value={documentType}
          onValueChange={(v) => {
            setNumberError(null);
            onUpdate({ documentType: v as IdDocumentType });
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ID">{idOptionLabel}</SelectItem>
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
          onChange={(e) => {
            setNumberError(null);
            onUpdate({ documentNumber: e.target.value });
          }}
          onBlur={checkNumber}
          inputMode={documentType === "ID" && validateSaId ? "numeric" : "text"}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? "documentNumber-error" : undefined}
          className={fieldError ? "border-red-500" : ""}
          placeholder="As shown on your document"
        />
        {fieldError && (
          <p id="documentNumber-error" className="text-sm text-red-500">
            {fieldError}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>ID document</Label>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-lg border-2 border-dashed border-border bg-muted px-4 py-8 text-center transition-colors hover:border-emerald-400 hover:bg-emerald-50"
        >
          {file ? (
            <span className="flex flex-col items-center gap-2 text-emerald-700">
              <FileCheck2 className="h-8 w-8" />
              <span className="font-medium">{file.name}</span>
              <span className="text-xs text-muted-foreground">Tap to replace</span>
            </span>
          ) : (
            <span className="flex flex-col items-center gap-2 text-muted-foreground">
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
