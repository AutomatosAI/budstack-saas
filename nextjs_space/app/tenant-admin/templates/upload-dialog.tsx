"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
      toast.error("Invalid GitHub URL. Expected: https://github.com/username/repo");
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
        <Button className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md hover:shadow-lg transition-all rounded-full">
          <Plus className="mr-2 h-4 w-4" />
          Upload Template
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Upload Template from GitHub</DialogTitle>
          <DialogDescription>
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
            <Label htmlFor="template-name">Template Name</Label>
            <Input
              id="template-name"
              placeholder="e.g., My Custom Theme"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              disabled={isUploading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="github-url">
              <Github className="inline-block w-4 h-4 mr-1" />
              GitHub Repository URL
            </Label>
            <Input
              id="github-url"
              placeholder="https://github.com/username/template-repo"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              disabled={isUploading}
            />
            <p className="text-xs text-gray-500">
              The repository must be public and contain the required template files.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isUploading}
            className="rounded-full"
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={isUploading}
            className="rounded-full bg-blue-600 hover:bg-blue-700"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              "Upload Template"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
