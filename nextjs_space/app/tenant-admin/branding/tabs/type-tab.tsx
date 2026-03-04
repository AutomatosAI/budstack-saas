"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FONTS } from "./shared";
import type { EditorFormData, SetFormData } from "./types";

interface TypeTabProps {
  formData: EditorFormData;
  setFormData: SetFormData;
}

export function TypeTab({ formData, setFormData }: TypeTabProps) {
  const update = (field: keyof EditorFormData, value: any) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Typography</CardTitle>
          <CardDescription>
            Font styles (applies to ALL pages)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label>Body Font</Label>
            <Select
              value={formData.fontFamily}
              onValueChange={(v) => update("fontFamily", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONTS.map((font) => (
                  <SelectItem key={font.id} value={font.id}>
                    <div>
                      <div className="font-semibold">{font.name}</div>
                      <div className="text-xs text-gray-500">
                        {font.description}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Heading Font</Label>
            <Select
              value={formData.headingFontFamily}
              onValueChange={(v) => update("headingFontFamily", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="same">Same as body</SelectItem>
                {FONTS.map((font) => (
                  <SelectItem key={font.id} value={font.id}>
                    <div>
                      <div className="font-semibold">{font.name}</div>
                      <div className="text-xs text-gray-500">
                        {font.description}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Font Size</Label>
            <Select
              value={formData.fontSize}
              onValueChange={(v) => update("fontSize", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small (14px)</SelectItem>
                <SelectItem value="medium">Medium (16px)</SelectItem>
                <SelectItem value="large">Large (18px)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Expanded Typography Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Font Weight & Spacing</CardTitle>
          <CardDescription>
            Fine-tune typography weight and letter spacing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label>Body Font Weight</Label>
            <Select
              value={formData.fontWeight}
              onValueChange={(v) => update("fontWeight", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="300">Light (300)</SelectItem>
                <SelectItem value="400">Regular (400)</SelectItem>
                <SelectItem value="500">Medium (500)</SelectItem>
                <SelectItem value="700">Bold (700)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Heading Font Weight</Label>
            <Select
              value={formData.headingFontWeight}
              onValueChange={(v) => update("headingFontWeight", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="400">Regular (400)</SelectItem>
                <SelectItem value="500">Medium (500)</SelectItem>
                <SelectItem value="600">Semibold (600)</SelectItem>
                <SelectItem value="700">Bold (700)</SelectItem>
                <SelectItem value="800">Extra Bold (800)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Letter Spacing</Label>
            <Select
              value={formData.letterSpacingPreset}
              onValueChange={(v) => update("letterSpacingPreset", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tight">Tight (-0.025em)</SelectItem>
                <SelectItem value="normal">Normal (0)</SelectItem>
                <SelectItem value="wide">Wide (0.025em)</SelectItem>
                <SelectItem value="wider">Wider (0.05em)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
