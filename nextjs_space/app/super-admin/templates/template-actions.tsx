"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Loader2 } from "lucide-react";
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

interface TemplateActionsProps {
  templateId: string;
  templateName: string;
  usageCount: number;
  previewUrl: string | null;
  slug: string | null;
  metadata: Record<string, any> | null;
}

export function TemplateActions({
  templateId,
  templateName,
  usageCount,
  previewUrl,
  slug,
  metadata,
}: TemplateActionsProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/super-admin/templates/${templateId}`, {
        method: "DELETE",
      });

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
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowEditDialog(true)}
        title="Upload preview image"
        className="rounded-full"
      >
        <Edit className="h-4 w-4" />
      </Button>
      <UpdateGitHubButton
        templateId={templateId}
        templateName={templateName}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowDeleteDialog(true)}
        disabled={isDeleting}
        className="text-red-600 hover:text-red-700 rounded-full"
      >
        {isDeleting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </Button>

      <EditTemplateDialog
        templateId={templateId}
        templateName={templateName}
        currentPreviewUrl={previewUrl}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the template{" "}
              <strong>"{templateName}"</strong>?
              {usageCount > 0 && (
                <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-900">
                  Warning: This template is currently used by{" "}
                  <strong>{usageCount}</strong> tenant(s). You must reassign
                  those tenants to a different template before deletion.
                </div>
              )}
              {usageCount === 0 && (
                <div className="mt-2">
                  This action cannot be undone. The template files will be
                  permanently removed from the system.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 rounded-full"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
