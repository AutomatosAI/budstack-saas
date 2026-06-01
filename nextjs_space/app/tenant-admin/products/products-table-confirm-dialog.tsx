"use client";

import { Trash2, PackageCheck, AlertTriangle, Loader2 } from "lucide-react";
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
import type { BulkActionType } from "./products-table-types";

interface ProductsBulkConfirmDialogProps {
  confirmAction: BulkActionType;
  selectedCount: number;
  selectedProductNames: string[];
  isProcessing: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ProductsBulkConfirmDialog({
  confirmAction,
  selectedCount,
  selectedProductNames,
  isProcessing,
  onClose,
  onConfirm,
}: ProductsBulkConfirmDialogProps) {
  return (
    <Dialog
      open={confirmAction !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="bs-dialog-content sm:max-w-md">
        <DialogHeader>
          <DialogTitle
            className="flex items-center gap-2 text-[22px] text-bs-fg"
            style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
          >
            {confirmAction === "delete" ? (
              <>
                <Trash2 className="h-5 w-5 text-bs-danger" aria-hidden="true" />
                <span>Delete Products</span>
              </>
            ) : confirmAction === "set-in-stock" ? (
              <>
                <PackageCheck className="h-5 w-5 text-bs-green-soft" aria-hidden="true" />
                <span>Set In Stock</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-bs-warn" aria-hidden="true" />
                <span>Set Out of Stock</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription className="pt-2 text-bs-fg-muted">
            {confirmAction === "delete" ? (
              <span className="text-bs-danger">
                Are you sure you want to delete{" "}
                <strong>{selectedCount}</strong> product
                {selectedCount === 1 ? "" : "s"}? This cannot be undone.
              </span>
            ) : confirmAction === "set-in-stock" ? (
              <span>
                Set <strong className="text-bs-fg">{selectedCount}</strong> product
                {selectedCount === 1 ? "" : "s"} to In Stock?
              </span>
            ) : (
              <span>
                Set <strong className="text-bs-fg">{selectedCount}</strong> product
                {selectedCount === 1 ? "" : "s"} to Out of Stock?
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {selectedProductNames.length > 0 && (
          <div className="py-2">
            <p className="bs-eyebrow mb-2">Affected products</p>
            <div className="flex flex-wrap gap-1.5">
              {selectedProductNames.map((name) => (
                <RowPill key={name} tone="slate">
                  {name}
                </RowPill>
              ))}
              {selectedCount > 5 && (
                <RowPill tone="slate">+{selectedCount - 5} more</RowPill>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="bs-btn bs-btn-ghost disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className={cn(
              "bs-btn disabled:opacity-50",
              confirmAction === "delete" ? "bs-btn-danger" : "bs-btn-green",
            )}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                Processing...
              </>
            ) : confirmAction === "delete" ? (
              "Delete"
            ) : confirmAction === "set-in-stock" ? (
              "Set In Stock"
            ) : (
              "Set Out of Stock"
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
