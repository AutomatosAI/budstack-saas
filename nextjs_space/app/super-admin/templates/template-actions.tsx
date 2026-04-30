"use client";

import { useState } from "react";
import { Edit, Trash2, Loader2, Power } from "lucide-react";
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
import { EditTemplateDialog } from "./edit-template-dialog";
import UpdateGitHubButton from "./update-github-button";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

interface TemplateActionsProps {
  templateId: string;
  templateName: string;
  usageCount: number;
  previewUrl: string | null;
  slug: string | null;
  metadata: Record<string, any> | null;
  isActive: boolean;
}

export function TemplateActions({
  templateId,
  templateName,
  usageCount,
  previewUrl,
  isActive,
}: TemplateActionsProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const router = useRouter();

  const handleToggleActive = async () => {
    setIsToggling(true);
    try {
      const response = await fetch(`/api/super-admin/templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update");
      toast.success(data.message);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to toggle template status");
    } finally {
      setIsToggling(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      const response = await fetch(
        `/api/super-admin/templates/${templateId}?force=true`,
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
      toast.error(error.message || "Failed to delete template");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleToggleActive}
        disabled={isToggling}
        title={
          isActive
            ? "Deactivate from marketplace"
            : "Activate on marketplace"
        }
        className={`bs-btn ${isActive ? "bs-btn-ghost" : "bs-btn-green"} bs-btn-sm gap-1.5`}
      >
        {isToggling ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Power className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {isActive ? "Deactivate" : "Activate"}
      </button>
      <button
        type="button"
        onClick={() => setShowEditDialog(true)}
        title="Upload preview image"
        className="bs-btn bs-btn-ghost bs-btn-sm"
      >
        <Edit className="h-4 w-4" aria-hidden="true" />
      </button>
      <UpdateGitHubButton
        templateId={templateId}
        templateName={templateName}
      />
      <button
        type="button"
        onClick={() => setShowDeleteDialog(true)}
        disabled={isDeleting}
        className="bs-btn bs-btn-ghost bs-btn-sm text-bs-danger hover:text-bs-danger"
      >
        {isDeleting ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        )}
      </button>

      <EditTemplateDialog
        templateId={templateId}
        templateName={templateName}
        currentPreviewUrl={previewUrl}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />

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
              Are you sure you want to delete the template{" "}
              <strong className="text-bs-fg">&ldquo;{templateName}&rdquo;</strong>?
              {usageCount > 0 && (
                <span className="block mt-2 p-3 bg-bs-warn/10 border border-bs-warn/30 rounded-bs-sm text-bs-fg">
                  Warning: This template is currently used by{" "}
                  <strong>{usageCount}</strong> tenant(s). You must reassign
                  those tenants to a different template before deletion.
                </span>
              )}
              {usageCount === 0 && (
                <span className="block mt-2">
                  This action cannot be undone. The template files will be
                  permanently removed from the system.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isDeleting}
              className="bs-btn bs-btn-ghost"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isDeleting}
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
