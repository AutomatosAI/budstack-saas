"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, Video } from "lucide-react";
import { toast } from "@/components/ui/sonner";

export const FONTS = [
  // Sans-serif
  { id: "inter", name: "Inter", category: "Sans-serif" },
  { id: "roboto", name: "Roboto", category: "Sans-serif" },
  { id: "lato", name: "Lato", category: "Sans-serif" },
  { id: "montserrat", name: "Montserrat", category: "Sans-serif" },
  { id: "poppins", name: "Poppins", category: "Sans-serif" },
  { id: "outfit", name: "Outfit", category: "Sans-serif" },
  { id: "nunito", name: "Nunito", category: "Sans-serif" },
  { id: "open-sans", name: "Open Sans", category: "Sans-serif" },
  { id: "raleway", name: "Raleway", category: "Sans-serif" },
  { id: "work-sans", name: "Work Sans", category: "Sans-serif" },
  { id: "dm-sans", name: "DM Sans", category: "Sans-serif" },
  { id: "source-sans-3", name: "Source Sans 3", category: "Sans-serif" },
  { id: "manrope", name: "Manrope", category: "Sans-serif" },
  { id: "space-grotesk", name: "Space Grotesk", category: "Sans-serif" },
  { id: "plus-jakarta-sans", name: "Plus Jakarta Sans", category: "Sans-serif" },
  { id: "sora", name: "Sora", category: "Sans-serif" },
  { id: "urbanist", name: "Urbanist", category: "Sans-serif" },
  { id: "figtree", name: "Figtree", category: "Sans-serif" },
  // Serif
  { id: "playfair", name: "Playfair Display", category: "Serif" },
  { id: "merriweather", name: "Merriweather", category: "Serif" },
  { id: "lora", name: "Lora", category: "Serif" },
  { id: "dm-serif-display", name: "DM Serif Display", category: "Serif" },
  { id: "cormorant-garamond", name: "Cormorant Garamond", category: "Serif" },
  { id: "libre-baskerville", name: "Libre Baskerville", category: "Serif" },
  { id: "eb-garamond", name: "EB Garamond", category: "Serif" },
  { id: "crimson-text", name: "Crimson Text", category: "Serif" },
  { id: "bitter", name: "Bitter", category: "Serif" },
  // Display / Decorative
  { id: "oswald", name: "Oswald", category: "Display" },
  { id: "bebas-neue", name: "Bebas Neue", category: "Display" },
  { id: "antonio", name: "Antonio", category: "Display" },
  { id: "righteous", name: "Righteous", category: "Display" },
];

export function ColorPicker({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <p className="text-xs text-gray-500 mb-2">{description}</p>
      <div className="flex gap-2">
        <Input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-16 h-10 p-1 cursor-pointer"
        />
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="flex-1"
        />
      </div>
    </div>
  );
}

export function FileUpload({
  label,
  description,
  accept,
  onChange,
  file,
}: {
  label: string;
  description: string;
  accept: string;
  onChange: (file: File | null) => void;
  file: File | null;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <p className="text-xs text-gray-500 mb-2">{description}</p>
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors">
        <input
          type="file"
          accept={accept}
          onChange={(e) => onChange(e.target.files?.[0] || null)}
          className="hidden"
          id={`file-${label}`}
        />
        <label htmlFor={`file-${label}`} className="cursor-pointer">
          <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
          {file ? (
            <p className="text-sm text-green-600 font-medium">{file.name}</p>
          ) : (
            <p className="text-sm text-gray-600">
              Click to upload or drag and drop
            </p>
          )}
        </label>
      </div>
    </div>
  );
}

export function SectionVideoUploader({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/tenant-admin/branding/upload?type=video", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      const data = await res.json();
      // Use signed URL for display/preview; API strips back to key on save
      if (data.url) onChange(data.url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload video");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mt-1 space-y-2">
      <div className="flex gap-2 items-center">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Upload or paste video URL..."
          className="flex-1"
        />
        <div className="relative border rounded-md p-1.5 flex h-10 w-10 items-center justify-center bg-muted/50 hover:bg-muted cursor-pointer shrink-0 transition-colors">
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleUpload}
            disabled={isUploading}
          />
          {isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : (
            <Video className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>
      {value && (
        <video
          src={value}
          controls
          muted
          className="w-full max-h-32 rounded-md border object-cover"
        />
      )}
      <p className="text-xs text-muted-foreground">
        MP4, WebM, or MOV — max 100MB
      </p>
    </div>
  );
}

export function SectionImageUploader({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/tenant-admin/branding/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      if (data.url) onChange(data.url);
    } catch {
      toast.error("Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mt-1 flex gap-2 items-center">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://..."
        className="flex-1"
      />
      <div className="relative border rounded-md p-1.5 flex h-10 w-10 items-center justify-center bg-muted/50 hover:bg-muted cursor-pointer shrink-0 transition-colors">
        <input
          type="file"
          accept="image/*"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={handleUpload}
          disabled={isUploading}
        />
        {isUploading ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        ) : (
          <Upload className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
    </div>
  );
}
