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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Github, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useRouter } from "next/navigation";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

export function UploadTemplateDialog() {
  const [open, setOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [structureType, setStructureType] = useState<"default" | "lovable">(
    "default",
  );
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();

  const handleUpload = async () => {
    if (!templateName.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    if (!githubUrl.trim()) {
      toast.error("Please enter a GitHub URL");
      return;
    }

    setIsUploading(true);

    try {
      const response = await fetch("/api/super-admin/templates/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          templateName: templateName.trim(),
          githubUrl: githubUrl.trim(),
          structureType,
        }),
      });

      let data;
      const contentType = response.headers.get("content-type");

      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(
          `Server returned non-JSON response (${response.status}): ${text.substring(0, 100)}`,
        );
      }

      if (!response.ok) {
        const errorMsg =
          data.error || data.message || "Failed to upload template";
        throw new Error(errorMsg);
      }

      toast.success(data.message || "Template uploaded successfully!");
      setOpen(false);
      setTemplateName("");
      setGithubUrl("");
      setStructureType("default");
      router.refresh();
    } catch (error: any) {
      const errorMessage = error.message || "Failed to upload template";
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="bs-btn bs-btn-green">
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Upload New Template
        </button>
      </DialogTrigger>
      <DialogContent className="bs-dialog-content sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle
            className="text-[22px] leading-tight"
            style={sectionTitleStyle}
          >
            Upload Template from GitHub
          </DialogTitle>
          <DialogDescription className="text-bs-fg-muted">
            Select the template structure type and enter the GitHub repository
            URL.
            {structureType === "default" && (
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>template.config.json</li>
                <li>index.tsx</li>
                <li>defaults.json (recommended)</li>
                <li>components/ directory</li>
                <li>styles.css (optional)</li>
              </ul>
            )}
            {structureType === "lovable" && (
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>Will be automatically converted to BudStacks format</li>
                <li>Supports full Lovable.dev project structure</li>
                <li>Converts React Router to Next.js</li>
                <li>Extracts homepage components</li>
              </ul>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="structure-type" className="text-bs-fg">
              Template Structure
            </Label>
            <Select
              value={structureType}
              onValueChange={(value: "default" | "lovable") =>
                setStructureType(value)
              }
            >
              <SelectTrigger id="structure-type">
                <SelectValue placeholder="Select template structure" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Default (BudStacks)</span>
                    <span className="text-xs text-bs-fg-muted">
                      Already follows BudStacks structure
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="lovable">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Lovable.dev Template</span>
                    <span className="text-xs text-bs-fg-muted">
                      Will be automatically converted
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-name" className="text-bs-fg">
              Template Name
            </Label>
            <Input
              id="template-name"
              placeholder="e.g., Portugal Wellness, Miami Vice Theme, etc."
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              disabled={isUploading}
            />
            <p className="text-xs text-bs-fg-muted">
              Give your template a unique, descriptive name (e.g., &quot;Portugal
              Wellness&quot;, &quot;GTA Vice City&quot;).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="github-url" className="text-bs-fg">
              <Github
                className="inline-block w-4 h-4 mr-1"
                aria-hidden="true"
              />
              GitHub Repository URL
            </Label>
            <Input
              id="github-url"
              placeholder="https://github.com/username/template-repo.git"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              disabled={isUploading}
            />
            <p className="text-xs text-bs-fg-muted">
              Example:
              https://github.com/Gerard161-Site/healingbuds-template.git
            </p>
          </div>
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={isUploading}
            className="bs-btn bs-btn-ghost"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={isUploading}
            className="bs-btn bs-btn-green"
          >
            {isUploading ? (
              <>
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                Uploading...
              </>
            ) : (
              "Upload Template"
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
