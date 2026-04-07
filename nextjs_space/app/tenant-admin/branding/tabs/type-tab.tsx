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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FONTS } from "./shared";
import type { EditorFormData, SetFormData } from "./types";

interface TypeTabProps {
  formData: EditorFormData;
  setFormData: SetFormData;
}

// Group fonts by category for the dropdown
const FONT_GROUPS = FONTS.reduce<Record<string, typeof FONTS>>((acc, font) => {
  const cat = font.category || "Other";
  if (!acc[cat]) acc[cat] = [];
  acc[cat].push(font);
  return acc;
}, {});

function FontSelect({
  value,
  onValueChange,
  showSameAsBody,
}: {
  value: string;
  onValueChange: (v: string) => void;
  showSameAsBody?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {showSameAsBody && <SelectItem value="same">Same as body</SelectItem>}
        {Object.entries(FONT_GROUPS).map(([category, fonts]) => (
          <SelectGroup key={category}>
            <SelectLabel className="text-xs text-muted-foreground uppercase tracking-wider">{category}</SelectLabel>
            {fonts.map((font) => (
              <SelectItem key={font.id} value={font.id}>
                {font.name}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Body Font</Label>
              <FontSelect
                value={formData.fontFamily}
                onValueChange={(v) => update("fontFamily", v)}
              />
            </div>
            <div>
              <Label>Heading Font</Label>
              <FontSelect
                value={formData.headingFontFamily}
                onValueChange={(v) => update("headingFontFamily", v)}
                showSameAsBody
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Body Font Size</Label>
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
            <div>
              <Label>Heading Font Size</Label>
              <Select
                value={formData.headingFontSize}
                onValueChange={(v) => update("headingFontSize", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                  <SelectItem value="xlarge">Extra Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
          <div className="grid grid-cols-2 gap-4">
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
