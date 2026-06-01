"use client";

import { Truck, CheckCircle2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RowPill } from "@/components/admin/shared";
import type { BulkActionType } from "./orders-table-types";

interface OrdersBulkConfirmDialogProps {
  confirmAction: BulkActionType;
  selectedCount: number;
  selectedOrderNumbers: string[];
  isProcessing: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function OrdersBulkConfirmDialog({
  confirmAction,
  selectedCount,
  selectedOrderNumbers,
  isProcessing,
  onClose,
  onConfirm,
}: OrdersBulkConfirmDialogProps) {
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
            {confirmAction === "mark-processing" ? (
              <>
                <Truck className="h-5 w-5 text-bs-fg-muted" aria-hidden="true" />
                <span>Mark as Processing</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5 text-bs-fg-muted" aria-hidden="true" />
                <span>Mark as Completed</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription className="pt-2 text-bs-fg-muted">
            {confirmAction === "mark-processing" ? (
              <span>
                Update{" "}
                <strong className="text-bs-fg">{selectedCount}</strong> order
                {selectedCount === 1 ? "" : "s"} to Processing?
              </span>
            ) : (
              <span>
                Update{" "}
                <strong className="text-bs-fg">{selectedCount}</strong> order
                {selectedCount === 1 ? "" : "s"} to Completed?
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {selectedOrderNumbers.length > 0 && (
          <div className="py-2">
            <p className="bs-eyebrow mb-2">Affected orders</p>
            <div className="flex flex-wrap gap-1.5">
              {selectedOrderNumbers.map((orderNum) => (
                <RowPill key={orderNum} tone="slate">
                  {orderNum}
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
            className="bs-btn bs-btn-green disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                Processing...
              </>
            ) : confirmAction === "mark-processing" ? (
              "Mark Processing"
            ) : (
              "Mark Completed"
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
