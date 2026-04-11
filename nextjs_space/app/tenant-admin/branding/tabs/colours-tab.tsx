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

const OVERRIDE_GROUPS = [
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

const OVERRIDE_KEYS = OVERRIDE_GROUPS.flatMap((g) => g.keys);

interface ColoursTabProps {
  formData: EditorFormData;
  setFormData: SetFormData;
  dirtyColors: Set<string>;
  setDirtyColors: React.Dispatch<React.SetStateAction<Set<string>>>;
  /** Hide the per-section overrides card (used when rendered inside the Brand
   *  tab — per-section colours live in the Content tab accordion instead). */
  showPerSection?: boolean;
}

export function ColoursTab({
  formData,
  setFormData,
  dirtyColors,
  setDirtyColors,
  showPerSection = true,
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

  // Nav/footer color override helpers
  const setNavOverride = (key: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      navColorOverrides: { ...prev.navColorOverrides, [key]: value },
    }));
  };

  const clearNavOverride = (key: string) => {
    setFormData((prev) => {
      const overrides = { ...prev.navColorOverrides };
      delete overrides[key];
      return { ...prev, navColorOverrides: overrides };
    });
  };

  const setFooterOverride = (key: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      footerColorOverrides: { ...prev.footerColorOverrides, [key]: value },
    }));
  };

  const clearFooterOverride = (key: string) => {
    setFormData((prev) => {
      const overrides = { ...prev.footerColorOverrides };
      delete overrides[key];
      return { ...prev, footerColorOverrides: overrides };
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
              label="Button Color"
              description="Main buttons and interactive elements"
              value={formData.primaryColor}
              onChange={(v) => setGlobalColor("primaryColor", v)}
            />
            <ColorPicker
              label="Call-to-Action Color"
              description="CTA buttons like 'Book Now' or 'Check Eligibility'"
              value={formData.accentColor}
              onChange={(v) => setGlobalColor("accentColor", v)}
            />
            <ColorPicker
              label="Links & Highlights"
              description="Links, secondary buttons, gradients"
              value={formData.secondaryColor}
              onChange={(v) => setGlobalColor("secondaryColor", v)}
            />
            <ColorPicker
              label="Page Background"
              description="Main page background"
              value={formData.backgroundColor}
              onChange={(v) => setGlobalColor("backgroundColor", v)}
            />
            <ColorPicker
              label="Heading Text"
              description="Page titles and section headings"
              value={formData.headingColor}
              onChange={(v) => setGlobalColor("headingColor", v)}
            />
            <ColorPicker
              label="Body Text"
              description="Paragraphs and general content"
              value={formData.textColor}
              onChange={(v) => setGlobalColor("textColor", v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Navigation & Footer Color Overrides */}
      <Card>
        <CardHeader>
          <CardTitle>Header & Footer Colors</CardTitle>
          <CardDescription>
            Override global colors for navigation and footer. Leave empty to
            use global defaults.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="nav-colors">
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  {Object.keys(formData.navColorOverrides).length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  )}
                  Navigation
                  {Object.keys(formData.navColorOverrides).length > 0 && (
                    <span className="text-xs text-muted-foreground font-normal">
                      ({Object.keys(formData.navColorOverrides).length} override
                      {Object.keys(formData.navColorOverrides).length !== 1 ? "s" : ""})
                    </span>
                  )}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  {Object.keys(formData.navColorOverrides).length > 0 && (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground"
                        onClick={() => setFormData((prev) => ({ ...prev, navColorOverrides: {} }))}
                      >
                        Clear all overrides
                      </Button>
                    </div>
                  )}
                  <div className="space-y-4">
                    {OVERRIDE_GROUPS.map((group) => (
                      <div key={group.heading}>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group.heading}</p>
                        <div className="grid grid-cols-2 gap-4">
                          {group.keys.map(({ key, label, description }) => {
                            const currentValue = formData.navColorOverrides[key] || "";
                            return (
                              <div key={key} className="relative">
                                <ColorPicker
                                  label={label}
                                  description={description}
                                  value={currentValue || "#000000"}
                                  onChange={(v) => setNavOverride(key, v)}
                                />
                                {currentValue && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-0 right-0 h-6 w-6"
                                    onClick={() => clearNavOverride(key)}
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
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="footer-colors">
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  {Object.keys(formData.footerColorOverrides).length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  )}
                  Footer
                  {Object.keys(formData.footerColorOverrides).length > 0 && (
                    <span className="text-xs text-muted-foreground font-normal">
                      ({Object.keys(formData.footerColorOverrides).length} override
                      {Object.keys(formData.footerColorOverrides).length !== 1 ? "s" : ""})
                    </span>
                  )}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  {Object.keys(formData.footerColorOverrides).length > 0 && (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground"
                        onClick={() => setFormData((prev) => ({ ...prev, footerColorOverrides: {} }))}
                      >
                        Clear all overrides
                      </Button>
                    </div>
                  )}
                  <div className="space-y-4">
                    {OVERRIDE_GROUPS.map((group) => (
                      <div key={group.heading}>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group.heading}</p>
                        <div className="grid grid-cols-2 gap-4">
                          {group.keys.map(({ key, label, description }) => {
                            const currentValue = formData.footerColorOverrides[key] || "";
                            return (
                              <div key={key} className="relative">
                                <ColorPicker
                                  label={label}
                                  description={description}
                                  value={currentValue || "#000000"}
                                  onChange={(v) => setFooterOverride(key, v)}
                                />
                                {currentValue && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-0 right-0 h-6 w-6"
                                    onClick={() => clearFooterOverride(key)}
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
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Per-Section Color Overrides */}
      {showPerSection && formData.layoutSections.length > 0 && (
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
                        <div className="space-y-4">
                          {OVERRIDE_GROUPS.map((group) => (
                            <div key={group.heading}>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group.heading}</p>
                              <div className="grid grid-cols-2 gap-4">
                                {group.keys.map(({ key, label, description }) => {
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
                          ))}
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
