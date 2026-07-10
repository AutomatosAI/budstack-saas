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
import { toast } from "@/components/ui/sonner";
import { UploadCloud, FileCheck2 } from "lucide-react";

type IdDocumentType = "ID" | "PASSPORT" | "DRIVING_LICENCE";

// Mirrors lib/drgreen-identity's server-side limits (that module signs over
// Node Buffers and must not be imported into client code) — same convention
// as consultation/steps/id-upload-step.tsx.
const ACCEPTED = "image/jpeg,image/png,application/pdf";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * PRD-220 Part B — dashboard re-upload for a failed inline ID upload.
 * Posts multipart to /api/store/[slug]/verify/id-document (the existing
 * pass-through endpoint; nothing about the document is stored on our side).
 */
export function ReUploadIdDocument({
  slug,
  onUploaded,
}: {
  slug: string;
  onUploaded?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<IdDocumentType>("ID");
  const [documentNumber, setDocumentNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setError(null);
    if (f && f.size > MAX_BYTES) {
      setFile(null);
      setError("File is too large — 10 MB max.");
      return;
    }
    setFile(f);
  };

  const submit = async () => {
    if (!file) return setError("Please choose your ID document.");
    if (!documentNumber.trim()) return setError("Please enter your document number.");
    setError(null);
    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("documentType", documentType);
      form.set("documentNumber", documentNumber.trim());

      const res = await fetch(`/api/store/${slug}/verify/id-document`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Upload failed. Please try again.");
      }

      toast.success("ID document received — it's now with the review team.");
      onUploaded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-rose-200 bg-white/70 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Document type</Label>
          <Select
            value={documentType}
            onValueChange={(v) => setDocumentType(v as IdDocumentType)}
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
          <Label htmlFor="reupload-doc-number">Document number</Label>
          <Input
            id="reupload-doc-number"
            value={documentNumber}
            onChange={(e) => setDocumentNumber(e.target.value)}
            placeholder="As shown on your document"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center transition-colors hover:border-emerald-400 hover:bg-emerald-50"
      >
        {file ? (
          <span className="flex flex-col items-center gap-1 text-emerald-700">
            <FileCheck2 className="h-6 w-6" />
            <span className="text-sm font-medium">{file.name}</span>
            <span className="text-xs text-gray-500">Tap to replace</span>
          </span>
        ) : (
          <span className="flex flex-col items-center gap-1 text-gray-500">
            <UploadCloud className="h-6 w-6" />
            <span className="text-sm font-medium">Tap to upload your ID</span>
            <span className="text-xs">JPG, PNG or PDF · up to 10 MB</span>
          </span>
        )}
      </button>
      <input ref={inputRef} type="file" accept={ACCEPTED} className="hidden" onChange={pick} />

      {error && <p className="text-sm text-red-500">{error}</p>}

      <Button onClick={submit} disabled={submitting} className="w-full sm:w-auto">
        {submitting ? "Uploading…" : "Upload document"}
      </Button>
    </div>
  );
}
