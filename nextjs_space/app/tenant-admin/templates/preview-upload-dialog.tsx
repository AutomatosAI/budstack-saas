"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { Upload, Loader2, ImageIcon, Camera } from "lucide-react";
import { useRouter } from "next/navigation";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

interface PreviewUploadDialogProps {
  templateId: string;
  templateName: string;
  currentPreviewUrl: string | null;
}

export function PreviewUploadDialog({
  templateId,
  templateName,
  currentPreviewUrl,
}: PreviewUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }

    setPreviewFile(file);

    const reader = new FileReader();
    reader.onload = (ev) => setPreviewDataUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!previewFile) {
      toast.error("Select an image first");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("previewImage", previewFile);

      const res = await fetch(
        `/api/tenant-admin/templates/${templateId}/preview-image`,
        {
          method: "POST",
          body: formData,
        },
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      toast.success("Preview image updated");
      setPreviewFile(null);
      setPreviewDataUrl(null);
      setOpen(false);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to upload preview");
    } finally {
      setIsUploading(false);
    }
  };

  const displayImage = previewDataUrl || currentPreviewUrl;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="h-8 w-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
          title="Upload preview image"
        >
          <Camera className="h-4 w-4" aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent className="bs-dialog-content sm:max-w-md">
        <DialogHeader>
          <DialogTitle
            className="text-[22px] leading-tight"
            style={sectionTitleStyle}
          >
            Preview Image: {templateName}
          </DialogTitle>
          <DialogDescription className="text-bs-fg-muted">
            Upload a preview image for your template card in the marketplace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative w-full aspect-video rounded-bs-md border-2 border-dashed border-bs-border-100 hover:border-bs-border-200 cursor-pointer transition-colors overflow-hidden bg-bs-card-2/30 flex items-center justify-center"
          >
            {displayImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayImage}
                alt="Template preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center p-6">
                <ImageIcon
                  className="mx-auto h-10 w-10 text-bs-fg-muted mb-2"
                  aria-hidden="true"
                />
                <p className="text-sm text-bs-fg-muted">
                  Click to upload preview image
                </p>
                <p className="text-xs text-bs-fg-muted mt-1">
                  PNG, JPG up to 5MB
                </p>
              </div>
            )}

            {displayImage && (
              <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="text-center text-white">
                  <Upload
                    className="mx-auto h-8 w-8 mb-1"
                    aria-hidden="true"
                  />
                  <p className="text-sm font-medium">Replace image</p>
                </div>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {previewFile && (
            <p className="text-sm text-bs-fg-muted">
              Selected:{" "}
              <span className="font-medium text-bs-fg">{previewFile.name}</span>
            </p>
          )}
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
            onClick={handleSave}
            disabled={isUploading || !previewFile}
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
              <>
                <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                Save Preview
              </>
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
