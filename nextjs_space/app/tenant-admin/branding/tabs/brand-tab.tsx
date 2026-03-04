"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { FileUpload } from "./shared";
import type { EditorFormData, SetFormData } from "./types";

interface BrandTabProps {
  formData: EditorFormData;
  setFormData: SetFormData;
  logo: File | null;
  heroImage: File | null;
  favicon: File | null;
  onFileChange: (file: File | null, type: "logo" | "heroImage" | "favicon") => void;
}

export function BrandTab({
  formData,
  setFormData,
  logo,
  heroImage,
  favicon,
  onFileChange,
}: BrandTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Business Information</CardTitle>
          <CardDescription>Your store's identity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="businessName">Business Name *</Label>
            <Input
              id="businessName"
              value={formData.businessName}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, businessName: e.target.value }))
              }
              required
            />
          </div>
          <div>
            <Label htmlFor="tagline">Tagline</Label>
            <Textarea
              id="tagline"
              value={formData.tagline}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, tagline: e.target.value }))
              }
              placeholder="Your trusted medical cannabis partner"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Brand Images</CardTitle>
          <CardDescription>
            Upload your logo, hero image, and favicon
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileUpload
            label="Logo"
            description="Recommended: PNG/SVG, transparent background"
            accept="image/*"
            onChange={(file) => onFileChange(file, "logo")}
            file={logo}
          />

          <div>
            <Label>Hero Section Type</Label>
            <Select
              value={formData.heroType}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, heroType: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gradient">Gradient Background</SelectItem>
                <SelectItem value="gradient-image">Gradient Image Background</SelectItem>
                <SelectItem value="image">Image Background</SelectItem>
                <SelectItem value="video">Video Background</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(formData.heroType === "image" || formData.heroType === "gradient-image") && (
            <FileUpload
              label="Hero Image"
              description="Recommended: 1920x1080px, JPG/PNG"
              accept="image/*"
              onChange={(file) => onFileChange(file, "heroImage")}
              file={heroImage}
            />
          )}

          <FileUpload
            label="Favicon"
            description="Recommended: 32x32px or 64x64px, PNG/ICO"
            accept="image/*"
            onChange={(file) => onFileChange(file, "favicon")}
            file={favicon}
          />
        </CardContent>
      </Card>
    </div>
  );
}
