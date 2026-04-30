"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useRouter } from "next/navigation";
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

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

interface DeleteButtonProps {
  templateId: string;
  templateName: string;
  isActive: boolean;
}

export default function DeleteButton({
  templateId,
  templateName,
  isActive,
}: DeleteButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      const response = await fetch(
        `/api/tenant-admin/my-templates/${templateId}`,
        {
          method: "DELETE",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete template");
      }

      toast.success(data.message || "Template deleted successfully");
      setShowDeleteDialog(false);
      router.refresh();
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error(error.message || "Failed to delete template");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="bs-btn bs-btn-ghost bs-btn-sm text-bs-danger hover:bg-bs-danger/10"
        onClick={() => setShowDeleteDialog(true)}
        disabled={isDeleting || isActive}
        title={isActive ? "Cannot delete active template" : "Delete template"}
      >
        {isDeleting ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        )}
      </button>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bs-dialog-content">
          <AlertDialogHeader>
            <AlertDialogTitle
              className="text-[22px] leading-tight"
              style={sectionTitleStyle}
            >
              Delete Template
            </AlertDialogTitle>
            <AlertDialogDescription className="text-bs-fg-muted">
              Are you sure you want to delete{" "}
              <strong className="text-bs-fg">&ldquo;{templateName}&rdquo;</strong>?
              {isActive && (
                <span className="mt-2 block p-3 bg-bs-warn/10 border border-bs-warn/30 rounded-bs-md text-bs-fg">
                  This template is currently active. Please activate a
                  different template before deleting this one.
                </span>
              )}
              {!isActive && (
                <span className="mt-2 block">
                  This action cannot be undone. Your customizations will be
                  permanently removed.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="bs-btn bs-btn-ghost">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isDeleting || isActive}
              className="bs-btn bs-btn-danger"
            >
              {isDeleting ? (
                <>
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  Deleting...
                </>
              ) : (
                "Delete Template"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
