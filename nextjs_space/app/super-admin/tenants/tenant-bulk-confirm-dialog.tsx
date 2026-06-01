"use client";

import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RowPill } from "@/components/admin/shared";
import { cn } from "@/lib/utils";
import { sectionTitleStyle, type BulkActionType } from "./tenants-table-helpers";

export function TenantBulkConfirmDialog({
  confirmAction,
  onClose,
  selectedCount,
  selectedTenantNames,
  isProcessing,
  onConfirm,
}: {
  confirmAction: BulkActionType;
  onClose: () => void;
  selectedCount: number;
  selectedTenantNames: string[];
  isProcessing: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={confirmAction !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="bs-dialog-content sm:max-w-md">
        <DialogHeader>
          <DialogTitle
            className="flex items-center gap-2 text-[22px] leading-tight"
            style={sectionTitleStyle}
          >
            {confirmAction === "activate" ? (
              <>
                <CheckCircle2
                  className="h-5 w-5 text-bs-green"
                  aria-hidden="true"
                />
                <span>Activate Tenants</span>
              </>
            ) : (
              <>
                <AlertTriangle
                  className="h-5 w-5 text-bs-warn"
                  aria-hidden="true"
                />
                <span>Deactivate Tenants</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription className="pt-2 text-bs-fg-muted">
            {confirmAction === "activate" ? (
              <span>
                Are you sure you want to activate{" "}
                <strong className="text-bs-fg">{selectedCount}</strong>{" "}
                tenant{selectedCount === 1 ? "" : "s"}? They will be able
                to access their stores.
              </span>
            ) : (
              <span>
                Are you sure you want to deactivate{" "}
                <strong className="text-bs-fg">{selectedCount}</strong>{" "}
                tenant{selectedCount === 1 ? "" : "s"}? Their stores will
                become inaccessible.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Show tenant names */}
        {selectedTenantNames.length > 0 && (
          <div className="py-2">
            <p className="text-xs text-bs-fg-muted mb-2">
              Affected tenants:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {selectedTenantNames.map((name) => (
                <RowPill key={name} tone="slate">
                  {name}
                </RowPill>
              ))}
              {selectedCount > 5 && (
                <RowPill tone="slate">
                  +{selectedCount - 5} more
                </RowPill>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            type="button"
            onClick={() => onClose()}
            disabled={isProcessing}
            className="bs-btn bs-btn-ghost"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className={cn(
              "bs-btn",
              confirmAction === "activate"
                ? "bs-btn-green"
                : "bs-btn-danger",
            )}
          >
            {isProcessing ? (
              <>
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                Processing...
              </>
            ) : confirmAction === "activate" ? (
              "Activate"
            ) : (
              "Deactivate"
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
