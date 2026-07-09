"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CustomerActionsProps {
  customer: {
    id: string;
    name: string | null;
    email: string;
  };
}

export default function CustomerActions({ customer }: CustomerActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const deleteCustomer = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/tenant-admin/customers/${customer.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete customer");

      toast.success("Customer deleted successfully (GDPR compliant)");
      // Navigate back to the list AND invalidate the RSC router cache so the
      // (now anonymized) customer is re-fetched and filtered out — without
      // refresh the client shows the stale cached list and the row lingers.
      router.push("/tenant-admin/customers");
      router.refresh();
    } catch (error) {
      toast.error("Failed to delete customer");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowDeleteDialog(true)}
          className="bs-btn bs-btn-danger w-full"
        >
          Delete Customer (GDPR)
        </button>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bs-dialog-content">
          <AlertDialogHeader>
            <AlertDialogTitle
              className="text-[22px] text-bs-fg"
              style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
            >
              GDPR Compliant Deletion
            </AlertDialogTitle>
            <AlertDialogDescription className="text-bs-fg-muted">
              This will anonymize all personal data for{" "}
              <strong className="text-bs-fg">{customer.name || customer.email}</strong>. The customer
              record will be kept for order history integrity but all PII will
              be removed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bs-btn bs-btn-ghost">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteCustomer}
              disabled={isLoading}
              className="bs-btn bs-btn-danger disabled:opacity-50"
            >
              {isLoading ? "Deleting..." : "Delete Customer Data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
