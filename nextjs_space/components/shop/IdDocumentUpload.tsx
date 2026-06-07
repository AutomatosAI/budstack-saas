"use client";

import { useState } from "react";
import { Loader2, Upload, CheckCircle2, AlertCircle } from "lucide-react";

// Mirror the server limits (drgreen-identity.ts / Dr Green identity.service.ts)
// for fast client-side feedback; the server remains the source of truth.
const ALLOWED_MIME = ["image/jpeg", "image/png", "application/pdf"];
const MAX_BYTES = 10 * 1024 * 1024;

const DOC_TYPES = [
  { value: "ID", label: "National ID" },
  { value: "PASSPORT", label: "Passport" },
  { value: "DRIVING_LICENCE", label: "Driving licence" },
] as const;

type UploadState = "idle" | "submitting" | "pending" | "error";

export function IdDocumentUpload({ slug }: { slug: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>("ID");
  const [documentNumber, setDocumentNumber] = useState("");
  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState<string | null>(null);

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
      if (!res.ok) throw new Error(data?.error || "Upload failed. Please try again.");

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
          onChange={(e) => setDocumentType(e.target.value)}
          disabled={submitting}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          {DOC_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">
          Document number
        </label>
        <input
          value={documentNumber}
          onChange={(e) => setDocumentNumber(e.target.value)}
          maxLength={100}
          disabled={submitting}
          placeholder="As printed on the document"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
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
