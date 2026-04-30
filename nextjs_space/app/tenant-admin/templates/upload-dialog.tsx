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

    const githubPattern = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\.git)?$/;
    if (!githubPattern.test(githubUrl.trim().replace(/\.git$/, ""))) {
      toast.error(
        "Invalid GitHub URL. Expected: https://github.com/username/repo",
      );
      return;
    }

    setIsUploading(true);

    try {
      const response = await fetch("/api/tenant-admin/templates/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateName: templateName.trim(),
          githubUrl: githubUrl.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to upload template");
      }

      toast.success("Template uploaded successfully");
      setOpen(false);
      setTemplateName("");
      setGithubUrl("");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to upload template");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="bs-btn bs-btn-ghost">
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Upload Template
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
            Upload a custom template from a GitHub repository. Your template
            will be private to your store.
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li>template.config.json</li>
              <li>layout.json</li>
              <li>defaults.json</li>
              <li>styles.css</li>
            </ul>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="template-name" className="text-bs-fg">
              Template Name
            </Label>
            <Input
              id="template-name"
              placeholder="e.g., My Custom Theme"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              disabled={isUploading}
            />
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
              placeholder="https://github.com/username/template-repo"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              disabled={isUploading}
            />
            <p className="text-xs text-bs-fg-muted">
              The repository must be public and contain the required template
              files.
            </p>
          </div>
        </div>
        <DialogFooter>
          <button
            type="button"
            className="bs-btn bs-btn-ghost"
            onClick={() => setOpen(false)}
            disabled={isUploading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="bs-btn bs-btn-green"
            onClick={handleUpload}
            disabled={isUploading}
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
