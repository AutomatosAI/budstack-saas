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
import { Loader2, Power, Trash2 } from "lucide-react";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

interface TenantActionsProps {
  tenant: {
    id: string;
    businessName: string;
    isActive: boolean;
  };
}

export default function TenantActions({ tenant }: TenantActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const toggleTenantStatus = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/super-admin/tenants/${tenant.id}/toggle-active`,
        {
          method: "PATCH",
        },
      );

      if (!res.ok) throw new Error("Failed to update tenant");

      toast.success(
        `Tenant ${tenant.isActive ? "deactivated" : "activated"} successfully`,
      );
      router.refresh();
    } catch {
      toast.error("Failed to update tenant status");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteTenant = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenant.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete tenant");

      toast.success("Tenant deleted successfully");
      router.push("/super-admin/tenants");
    } catch {
      toast.error("Failed to delete tenant");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-2">
        <button
          type="button"
          onClick={toggleTenantStatus}
          disabled={isLoading}
          className={`bs-btn w-full gap-2 ${tenant.isActive ? "bs-btn-danger" : "bs-btn-green"}`}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Power className="h-4 w-4" aria-hidden="true" />
          )}
          {tenant.isActive ? "Deactivate Tenant" : "Activate Tenant"}
        </button>

        <button
          type="button"
          onClick={() => setShowDeleteDialog(true)}
          className="bs-btn bs-btn-danger w-full gap-2"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete Tenant
        </button>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bs-dialog-content">
          <AlertDialogHeader>
            <AlertDialogTitle
              className="text-[22px] leading-tight"
              style={sectionTitleStyle}
            >
              Are you absolutely sure?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-bs-fg-muted">
              This will permanently delete the tenant{" "}
              <strong className="text-bs-fg">{tenant.businessName}</strong>{" "}
              and all associated data including users, products, and orders.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bs-btn bs-btn-ghost">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteTenant}
              disabled={isLoading}
              className="bs-btn bs-btn-danger"
            >
              {isLoading ? (
                <>
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  Deleting...
                </>
              ) : (
                "Delete Tenant"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
