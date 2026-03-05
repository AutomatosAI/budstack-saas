"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { X } from "lucide-react";
import { SECTION_SCHEMAS } from "@/lib/section-schemas";
import { ColorPicker } from "./shared";
import type { EditorFormData, SetFormData } from "./types";

const OVERRIDE_KEYS = [
  { key: "primary", label: "Primary", description: "Buttons, headers" },
  { key: "secondary", label: "Secondary", description: "Secondary elements" },
  { key: "accent", label: "Accent", description: "CTA highlights" },
  { key: "background", label: "Background", description: "Section bg" },
  { key: "surface", label: "Surface", description: "Card backgrounds" },
  { key: "text", label: "Text", description: "Body text" },
  { key: "heading", label: "Heading", description: "Heading text" },
  { key: "border", label: "Border", description: "Border color" },
] as const;

interface ColoursTabProps {
  formData: EditorFormData;
  setFormData: SetFormData;
  dirtyColors: Set<string>;
  setDirtyColors: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export function ColoursTab({
  formData,
  setFormData,
  dirtyColors,
  setDirtyColors,
}: ColoursTabProps) {
  const setGlobalColor = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setDirtyColors((prev) => new Set(prev).add(field));
  };

  const setSectionOverride = (
    sectionId: string,
    colorKey: string,
    value: string,
  ) => {
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

  const clearSectionOverride = (sectionId: string, colorKey: string) => {
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

  const clearAllSectionOverrides = (sectionId: string) => {
    setFormData((prev) => {
      const allOverrides = { ...prev.sectionColorOverrides };
      delete allOverrides[sectionId];
      return { ...prev, sectionColorOverrides: allOverrides };
    });
  };

  return (
    <div className="space-y-6">
      {/* Global Brand Colors */}
      <Card>
        <CardHeader>
          <CardTitle>Brand Colors</CardTitle>
          <CardDescription>
            Define your color palette (applies to ALL pages)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <ColorPicker
              label="Primary Color"
              description="Main brand color (buttons, headers)"
              value={formData.primaryColor}
              onChange={(v) => setGlobalColor("primaryColor", v)}
            />
            <ColorPicker
              label="Secondary Color"
              description="Secondary elements, links"
              value={formData.secondaryColor}
              onChange={(v) => setGlobalColor("secondaryColor", v)}
            />
            <ColorPicker
              label="Accent Color"
              description="Call-to-action highlights"
              value={formData.accentColor}
              onChange={(v) => setGlobalColor("accentColor", v)}
            />
            <ColorPicker
              label="Background Color"
              description="Page background"
              value={formData.backgroundColor}
              onChange={(v) => setGlobalColor("backgroundColor", v)}
            />
            <ColorPicker
              label="Text Color"
              description="Body text"
              value={formData.textColor}
              onChange={(v) => setGlobalColor("textColor", v)}
            />
            <ColorPicker
              label="Heading Color"
              description="Heading text"
              value={formData.headingColor}
              onChange={(v) => setGlobalColor("headingColor", v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Per-Section Color Overrides */}
      {formData.layoutSections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Section Color Overrides</CardTitle>
            <CardDescription>
              Override global colors for individual sections. Leave empty to use
              global defaults.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {formData.layoutSections.map((section: any) => {
                if (!section.id) return null;
                const schema = SECTION_SCHEMAS[section.type];
                const sectionLabel =
                  schema?.label ||
                  section.type.replace(/([A-Z])/g, " $1").trim();
                const overrides =
                  formData.sectionColorOverrides[section.id] || {};
                const hasOverrides = Object.keys(overrides).length > 0;

                return (
                  <AccordionItem key={section.id} value={section.id}>
                    <AccordionTrigger className="text-sm">
                      <span className="flex items-center gap-2">
                        {hasOverrides && (
                          <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                        )}
                        {sectionLabel}
                        {hasOverrides && (
                          <span className="text-xs text-muted-foreground font-normal">
                            ({Object.keys(overrides).length} override
                            {Object.keys(overrides).length !== 1 ? "s" : ""})
                          </span>
                        )}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-2">
                        {hasOverrides && (
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-xs text-muted-foreground"
                              onClick={() =>
                                clearAllSectionOverrides(section.id)
                              }
                            >
                              Clear all overrides
                            </Button>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                          {OVERRIDE_KEYS.map(({ key, label, description }) => {
                            const currentValue = overrides[key] || "";
                            return (
                              <div key={key} className="relative">
                                <ColorPicker
                                  label={label}
                                  description={description}
                                  value={currentValue || "#000000"}
                                  onChange={(v) =>
                                    setSectionOverride(section.id, key, v)
                                  }
                                />
                                {currentValue && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-0 right-0 h-6 w-6"
                                    onClick={() =>
                                      clearSectionOverride(section.id, key)
                                    }
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
