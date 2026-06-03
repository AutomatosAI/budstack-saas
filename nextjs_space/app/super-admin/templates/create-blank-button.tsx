"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";

/**
 * POSTs to the create-blank route (which creates a DB row + S3 scaffold) and
 * navigates to the returned editor URL. A button — not a link — because the
 * action is non-idempotent and must not be triggered by prefetch/crawl.
 */
export function CreateBlankTemplateButton() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const response = await fetch("/api/super-admin/templates/create-blank", {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to create template");
      }
      router.push(data.url);
    } catch (error: any) {
      toast.error(error.message || "Failed to create template");
      setIsCreating(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCreate}
      disabled={isCreating}
      className="bs-btn bs-btn-ghost gap-2"
    >
      {isCreating ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <Plus className="h-4 w-4" aria-hidden="true" />
      )}
      Create New Theme
    </button>
  );
}
