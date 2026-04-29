import { AlertTriangle } from "lucide-react";

/**
 * Banner shown above legal pages that have not yet completed counsel review.
 * Remove (or replace with a "Reviewed by [firm]") banner once counsel signs off.
 */
export function LegalDraftNotice({ documentName }: { documentName: string }) {
  return (
    <div className="mb-8 rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div className="flex-1">
          <p className="font-bs-mono text-[10.5px] uppercase tracking-[0.16em] text-amber-300">
            Draft — pending counsel review
          </p>
          <p className="mt-1 text-sm leading-relaxed text-bs-fg-2">
            This {documentName} is a working draft prepared for review by
            BudStacks' legal counsel. It is not yet binding and may change
            substantially before publication. For questions, contact{" "}
            <a
              href="mailto:legal@budstacks.io"
              className="text-bs-green-300 underline-offset-2 hover:underline"
            >
              legal@budstacks.io
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
