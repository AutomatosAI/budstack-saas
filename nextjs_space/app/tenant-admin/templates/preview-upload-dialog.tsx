"use client";

import { useState, useRef } from "react";
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
import { toast } from "@/components/ui/sonner";
import { Upload, Loader2, ImageIcon, Camera } from "lucide-react";
import { useRouter } from "next/navigation";

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
          className="h-8 w-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
          title="Upload preview image"
        >
          <Camera className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Preview Image: {templateName}</DialogTitle>
          <DialogDescription>
            Upload a preview image for your template card in the marketplace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative w-full aspect-video rounded-lg border-2 border-dashed border-slate-300 hover:border-slate-400 cursor-pointer transition-colors overflow-hidden bg-slate-50 flex items-center justify-center"
          >
            {displayImage ? (
              <img
                src={displayImage}
                alt="Template preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center p-6">
                <ImageIcon className="mx-auto h-10 w-10 text-slate-400 mb-2" />
                <p className="text-sm text-slate-500">
                  Click to upload preview image
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  PNG, JPG up to 5MB
                </p>
              </div>
            )}

            {displayImage && (
              <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="text-center text-white">
                  <Upload className="mx-auto h-8 w-8 mb-1" />
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
            <p className="text-sm text-slate-600">
              Selected:{" "}
              <span className="font-medium">{previewFile.name}</span>
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isUploading || !previewFile}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Save Preview
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
