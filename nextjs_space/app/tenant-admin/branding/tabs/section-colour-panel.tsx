"use client";

import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { ColorPicker } from "./shared";
import type { EditorFormData, SetFormData } from "./types";

/** Colour override groups — shared with ColoursTab global palette. Kept here
 *  so the per-section panel can render without importing from ColoursTab. */
export const SECTION_OVERRIDE_GROUPS = [
  {
    heading: "Buttons & Actions",
    keys: [
      { key: "primary", label: "Button Color", description: "Main buttons and interactive elements" },
      { key: "accent", label: "Call-to-Action Color", description: "CTA buttons like 'Book Now' or 'Check Eligibility'" },
      { key: "secondary", label: "Links & Highlights", description: "Links, secondary buttons, gradients" },
    ],
  },
  {
    heading: "Text",
    keys: [
      { key: "heading", label: "Heading Text", description: "Page titles and section headings" },
      { key: "text", label: "Body Text", description: "Paragraphs and general content" },
    ],
  },
  {
    heading: "Backgrounds & Layout",
    keys: [
      { key: "background", label: "Page Background", description: "Main page background" },
      { key: "surface", label: "Card Background", description: "Cards, panels, and content boxes" },
      { key: "border", label: "Borders & Dividers", description: "Lines, borders, and separators" },
    ],
  },
];

/** Per-section colour override panel.
 *
 *  Rendered inside the Content tab accordion (one per section) as the "Colour"
 *  sub-tab beside the Content form. Reads and writes
 *  `formData.sectionColorOverrides[sectionId]` directly. */
export function SectionColourPanel({
  sectionId,
  formData,
  setFormData,
}: {
  sectionId: string;
  formData: EditorFormData;
  setFormData: SetFormData;
}) {
  const overrides = formData.sectionColorOverrides[sectionId] || {};
  const hasOverrides = Object.keys(overrides).length > 0;

  const setOverride = (colorKey: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      sectionColorOverrides: {
        ...prev.sectionColorOverrides,
        [sectionId]: {
          ...(prev.sectionColorOverrides[sectionId] || {}),
          [colorKey]: value,
        },
      },
    }));
  };

  const clearOverride = (colorKey: string) => {
    setFormData((prev) => {
      const sectionOverrides = { ...(prev.sectionColorOverrides[sectionId] || {}) };
      delete sectionOverrides[colorKey];
      const allOverrides = { ...prev.sectionColorOverrides };
      if (Object.keys(sectionOverrides).length === 0) {
        delete allOverrides[sectionId];
      } else {
        allOverrides[sectionId] = sectionOverrides;
      }
      return { ...prev, sectionColorOverrides: allOverrides };
    });
  };

  const clearAll = () => {
    setFormData((prev) => {
      const allOverrides = { ...prev.sectionColorOverrides };
      delete allOverrides[sectionId];
      return { ...prev, sectionColorOverrides: allOverrides };
    });
  };

  return (
    <div className="space-y-4 pt-2">
      <p className="text-xs text-muted-foreground">
        Override global colours for this section. Leave empty to inherit from Brand.
      </p>
      {hasOverrides && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={clearAll}
          >
            Clear all overrides
          </Button>
        </div>
      )}
      <div className="space-y-4">
        {SECTION_OVERRIDE_GROUPS.map((group) => (
          <div key={group.heading}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {group.heading}
            </p>
            <div className="grid grid-cols-2 gap-4">
              {group.keys.map(({ key, label, description }) => {
                const currentValue = overrides[key] || "";
                return (
                  <div key={key} className="relative">
                    <ColorPicker
                      label={label}
                      description={description}
                      value={currentValue || "#000000"}
                      onChange={(v) => setOverride(key, v)}
                    />
                    {currentValue && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-0 right-0 h-6 w-6"
                        onClick={() => clearOverride(key)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
