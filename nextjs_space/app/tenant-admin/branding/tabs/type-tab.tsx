"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

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
            <SelectLabel className="bs-eyebrow">{category}</SelectLabel>
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
      <section className="bs-card bs-card-pad space-y-6">
        <div>
          <h3 className="text-[22px] leading-tight" style={sectionTitleStyle}>
            Typography
          </h3>
          <p className="text-sm text-bs-fg-muted">
            Font styles (applies to ALL pages)
          </p>
        </div>
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

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Body Font Size (px)</Label>
              <Input
                type="number"
                min={12}
                max={24}
                value={formData.fontSize}
                onChange={(e) => update("fontSize", e.target.value)}
                placeholder="16"
                className="mt-1"
              />
              <span className="text-xs text-bs-fg-muted mt-1 block">Paragraphs & content (default 16)</span>
            </div>
            <div>
              <Label>Hero Title Size (px)</Label>
              <Input
                type="number"
                min={24}
                max={96}
                value={formData.heroFontSize}
                onChange={(e) => update("heroFontSize", e.target.value)}
                placeholder="36"
                className="mt-1"
              />
              <span className="text-xs text-bs-fg-muted mt-1 block">Hero banner headline (default 36)</span>
            </div>
            <div>
              <Label>Section Heading Size (px)</Label>
              <Input
                type="number"
                min={18}
                max={56}
                value={formData.sectionFontSize}
                onChange={(e) => update("sectionFontSize", e.target.value)}
                placeholder="30"
                className="mt-1"
              />
              <span className="text-xs text-bs-fg-muted mt-1 block">Section titles like Features, FAQ (default 30)</span>
            </div>
          </div>
      </section>

      {/* Expanded Typography Controls */}
      <section className="bs-card bs-card-pad space-y-6">
        <div>
          <h3 className="text-[22px] leading-tight" style={sectionTitleStyle}>
            Font Weight &amp; Spacing
          </h3>
          <p className="text-sm text-bs-fg-muted">
            Fine-tune typography weight and letter spacing
          </p>
        </div>
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
      </section>
    </div>
  );
}
