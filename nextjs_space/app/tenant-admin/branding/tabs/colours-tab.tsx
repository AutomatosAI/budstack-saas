"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { X } from "lucide-react";
import { ColorPicker } from "./shared";
import type { EditorFormData, SetFormData } from "./types";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

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
      <section className="bs-card bs-card-pad space-y-3">
        <div>
          <h3 className="text-[22px] leading-tight" style={sectionTitleStyle}>
            Brand Colors
          </h3>
          <p className="text-sm text-bs-fg-muted">
            Define your color palette (applies to ALL pages)
          </p>
        </div>
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
      </section>

      {/* Navigation & Footer Color Overrides */}
      <section className="bs-card bs-card-pad space-y-3">
        <div>
          <h3 className="text-[22px] leading-tight" style={sectionTitleStyle}>
            Header &amp; Footer Colors
          </h3>
          <p className="text-sm text-bs-fg-muted">
            Override global colors for navigation and footer. Leave empty to
            use global defaults.
          </p>
        </div>
        <div>
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="nav-colors">
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  {Object.keys(formData.navColorOverrides).length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-bs-green shrink-0" />
                  )}
                  Navigation
                  {Object.keys(formData.navColorOverrides).length > 0 && (
                    <span className="text-xs text-bs-fg-muted font-normal">
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
                      <button
                        type="button"
                        className="bs-btn bs-btn-ghost bs-btn-sm text-xs text-bs-fg-muted"
                        onClick={() => setFormData((prev) => ({ ...prev, navColorOverrides: {} }))}
                      >
                        Clear all overrides
                      </button>
                    </div>
                  )}
                  <div className="space-y-4">
                    {OVERRIDE_GROUPS.map((group) => (
                      <div key={group.heading}>
                        <p className="bs-eyebrow mb-2">{group.heading}</p>
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
                                  <button
                                    type="button"
                                    className="bs-btn bs-btn-ghost bs-btn-sm absolute top-0 right-0 h-6 w-6 p-0 flex items-center justify-center"
                                    onClick={() => clearNavOverride(key)}
                                    aria-label="Clear override"
                                  >
                                    <X className="h-3 w-3" aria-hidden="true" />
                                  </button>
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
                    <span className="w-2 h-2 rounded-full bg-bs-green shrink-0" />
                  )}
                  Footer
                  {Object.keys(formData.footerColorOverrides).length > 0 && (
                    <span className="text-xs text-bs-fg-muted font-normal">
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
                      <button
                        type="button"
                        className="bs-btn bs-btn-ghost bs-btn-sm text-xs text-bs-fg-muted"
                        onClick={() => setFormData((prev) => ({ ...prev, footerColorOverrides: {} }))}
                      >
                        Clear all overrides
                      </button>
                    </div>
                  )}
                  <div className="space-y-4">
                    {OVERRIDE_GROUPS.map((group) => (
                      <div key={group.heading}>
                        <p className="bs-eyebrow mb-2">{group.heading}</p>
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
                                  <button
                                    type="button"
                                    className="bs-btn bs-btn-ghost bs-btn-sm absolute top-0 right-0 h-6 w-6 p-0 flex items-center justify-center"
                                    onClick={() => clearFooterOverride(key)}
                                    aria-label="Clear override"
                                  >
                                    <X className="h-3 w-3" aria-hidden="true" />
                                  </button>
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
        </div>
      </section>

    </div>
  );
}
