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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Share2, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useRouter } from "next/navigation";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

interface ShareMarketplaceDialogProps {
  templateId: string;
  templateName: string;
  initialDescription?: string;
  tenantBusinessName: string;
  triggerElement?: React.ReactNode;
}

const CATEGORIES = [
  "modern",
  "medical",
  "luxury",
  "playful",
  "dark",
  "light",
  "minimal",
];

export function ShareMarketplaceDialog({
  templateId,
  templateName,
  initialDescription,
  tenantBusinessName,
  triggerElement,
}: ShareMarketplaceDialogProps) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState(initialDescription || "");
  const [category, setCategory] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const response = await fetch(
        `/api/tenant-admin/templates/${templateId}/submit-to-marketplace`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description, category, tags }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit template");
      }

      toast.success("Template submitted for review");
      setOpen(false);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to submit template");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerElement || (
          <button type="button" className="bs-btn bs-btn-ghost bs-btn-sm">
            <Share2 className="mr-2 h-4 w-4" aria-hidden="true" />
            Share to Marketplace
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="bs-dialog-content sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle
            className="text-[22px] leading-tight"
            style={sectionTitleStyle}
          >
            Share to Marketplace
          </DialogTitle>
          <DialogDescription className="text-bs-fg-muted">
            A copy of your template files will be submitted for review. Your
            local template is not affected.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-bs-fg">Template Name</Label>
            <Input
              value={templateName}
              disabled
              className="bg-bs-card-2/50"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-bs-fg">Author</Label>
            <Input
              value={tenantBusinessName}
              disabled
              className="bg-bs-card-2/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-bs-fg">
              Description
            </Label>
            <Textarea
              id="description"
              placeholder="Describe what makes your template special..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category" className="text-bs-fg">
              Category
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags" className="text-bs-fg">
              Tags (comma-separated)
            </Label>
            <Input
              id="tags"
              placeholder="e.g., cannabis, wellness, minimal"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </div>
        <DialogFooter>
          <button
            type="button"
            className="bs-btn bs-btn-ghost"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="bs-btn bs-btn-green"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                Submitting...
              </>
            ) : (
              "Submit for Review"
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
