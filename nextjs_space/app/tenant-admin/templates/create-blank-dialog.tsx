"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useRouter } from "next/navigation";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

export function CreateBlankDialog() {
  const [open, setOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  const handleCreate = async () => {
    if (!templateName.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch(
        "/api/tenant-admin/templates/create-blank",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateName: templateName.trim() }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create template");
      }

      toast.success("Template created. Opening editor.");
      setOpen(false);
      setTemplateName("");
      router.push(`/tenant-admin/branding?templateId=${data.templateId}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to create template");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="bs-btn bs-btn-green">
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Create New Template
        </button>
      </DialogTrigger>
      <DialogContent className="bs-dialog-content sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle
            className="text-[22px] leading-tight"
            style={sectionTitleStyle}
          >
            Create New Template
          </DialogTitle>
          <DialogDescription className="text-bs-fg-muted">
            Start from a blank canvas and build your template in the Store
            Editor. You can add sections, customise colours, typography, and
            more.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="blank-template-name" className="text-bs-fg">
              Template Name
            </Label>
            <Input
              id="blank-template-name"
              placeholder="e.g., My Custom Design"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              disabled={isCreating}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreate();
                }
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <button
            type="button"
            className="bs-btn bs-btn-ghost"
            onClick={() => setOpen(false)}
            disabled={isCreating}
          >
            Cancel
          </button>
          <button
            type="button"
            className="bs-btn bs-btn-green"
            onClick={handleCreate}
            disabled={isCreating}
          >
            {isCreating ? (
              <>
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                Creating...
              </>
            ) : (
              "Create Template"
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
