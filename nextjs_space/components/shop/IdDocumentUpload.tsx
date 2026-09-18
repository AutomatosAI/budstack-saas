"use client";

import { useState } from "react";
import { Loader2, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { SA_ID_INVALID_CODE, saIdFieldError } from "@/lib/verification/sa-id";

// Mirror the server limits (drgreen-identity.ts / Dr Green identity.service.ts)
// for fast client-side feedback; the server remains the source of truth.
const ALLOWED_MIME = ["image/jpeg", "image/png", "application/pdf"];
const MAX_BYTES = 10 * 1024 * 1024;

type UploadState = "idle" | "submitting" | "pending" | "error";

/**
 * Stand-alone ID upload card (posts to the same pass-through route as the
 * dashboard re-upload). BS-203: South African ID rules inline for the ID
 * option, and an SA_ID_INVALID answer from the route lands on the number
 * field rather than the failed-upload banner. Only ever mounted on ID-upload
 * tenants, which are South African by construction, so `validateSaId`
 * defaults on.
 */
export function IdDocumentUpload({
  slug,
  validateSaId = true,
}: {
  slug: string;
  validateSaId?: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>("ID");
  const [documentNumber, setDocumentNumber] = useState("");
  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [numberError, setNumberError] = useState<string | null>(null);

  const idOptionLabel = validateSaId ? "South African ID" : "National ID";
  const docTypes = [
    { value: "ID", label: idOptionLabel },
    { value: "PASSPORT", label: "Passport" },
    { value: "DRIVING_LICENCE", label: "Driving licence" },
  ];

  const checkNumber = (): boolean => {
    const message = saIdFieldError({
      documentType,
      documentNumber,
      enforce: validateSaId,
    });
    setNumberError(message);
    return message === null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!file) return setError("Please choose a document image or PDF.");
    if (!ALLOWED_MIME.includes(file.type))
      return setError("File must be a JPG, PNG, or PDF.");
    if (file.size > MAX_BYTES)
      return setError("File must be 10MB or smaller.");
    if (!documentNumber.trim())
      return setError("Please enter the document number.");
    if (!checkNumber()) return;

    setState("submitting");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("documentType", documentType);
      form.append("documentNumber", documentNumber.trim());

      const res = await fetch(`/api/store/${slug}/verify/id-document`, {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.code === SA_ID_INVALID_CODE) {
          setNumberError(data.error);
          setState("idle");
          return;
        }
        throw new Error(data?.error || "Upload failed. Please try again.");
      }

      setState("pending");
    } catch (err: any) {
      setState("error");
      setError(err?.message || "Upload failed. Please try again.");
    }
  };

  if (state === "pending") {
    return (
      <div className="flex items-start gap-4 rounded-2xl border border-green-200 bg-green-50/70 p-6">
        <CheckCircle2 className="mt-0.5 h-6 w-6 flex-shrink-0 text-green-600" />
        <div>
          <h3 className="mb-1 font-semibold text-green-900">
            ID submitted — pending review
          </h3>
          <p className="text-sm text-green-800">
            Thanks. Our team will review your document and verify your account.
            You&apos;ll be able to order once it&apos;s approved — there&apos;s
            no need to upload again unless we ask you to.
          </p>
        </div>
      </div>
    );
  }

  const submitting = state === "submitting";

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <Upload className="h-5 w-5 text-slate-700" />
        <h3 className="font-semibold text-slate-900">Verify your identity</h3>
      </div>
      <p className="text-sm text-slate-500">
        Upload a clear photo or scan of a valid government ID. Accepted: JPG,
        PNG, or PDF, up to 10MB.
      </p>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">
          Document type
        </label>
        <select
          value={documentType}
          onChange={(e) => {
            setNumberError(null);
            setDocumentType(e.target.value);
          }}
          disabled={submitting}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          {docTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700" htmlFor="id-upload-doc-number">
          Document number
        </label>
        <input
          id="id-upload-doc-number"
          value={documentNumber}
          onChange={(e) => {
            setNumberError(null);
            setDocumentNumber(e.target.value);
          }}
          onBlur={checkNumber}
          inputMode={documentType === "ID" && validateSaId ? "numeric" : "text"}
          aria-invalid={numberError ? true : undefined}
          aria-describedby={numberError ? "id-upload-doc-number-error" : undefined}
          maxLength={100}
          disabled={submitting}
          placeholder="As printed on the document"
          className={`w-full rounded-lg border px-3 py-2 text-sm ${
            numberError ? "border-red-500" : "border-slate-300"
          }`}
        />
        {numberError && (
          <p id="id-upload-doc-number-error" className="text-sm text-red-600">
            {numberError}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">
          Document file
        </label>
        <input
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={submitting}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-white"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
          </>
        ) : (
          "Submit for verification"
        )}
      </button>
    </form>
  );
}
