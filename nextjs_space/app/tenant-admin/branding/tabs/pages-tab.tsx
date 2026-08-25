"use client";

import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RotateCcw } from "lucide-react";
import { SECTION_SCHEMAS, getEditableFields } from "@/lib/templates/section-schemas";
import type { FieldSchema } from "@/lib/templates/section-schemas";
import {
  ABOUT_ALWAYS_VISIBLE_IDS,
  ABOUT_ARRAY_FIELD_SEEDS,
} from "@/lib/templates/about-page";
import { SectionImageUploader } from "./shared";
import { SectionColourPanel } from "./section-colour-panel";
import { ArrayFieldEditor } from "./content-tab-editors";
import type { EditorFormData, SetFormData } from "./types";

interface PagesTabProps {
  formData: EditorFormData;
  setFormData: SetFormData;
  /** Called when an accordion item is opened, with the section id —
   *  the parent switches the live preview to the About page and scrolls. */
  onSectionSelect?: (sectionId: string) => void;
}

/** Join a stored array for textarea display. Top-level textareas use the
 *  blank-line paragraph convention; array-item textareas are one-per-line. */
function textareaDisplayValue(value: unknown, perLine: boolean): string {
  if (Array.isArray(value)) return value.join(perLine ? "\n" : "\n\n");
  return String(value ?? "");
}

/** Resolve the items shown in an array editor: the tenant's stored array, or
 *  the section's stock content so editing starts from what the page renders.
 *  Item textarea fields (e.g. facility features) are normalised to strings. */
function arrayDisplayItems(
  sectionId: string,
  field: FieldSchema,
  config: Record<string, any>,
): any[] {
  const stored = config[field.key];
  const source = Array.isArray(stored)
    ? stored
    : ABOUT_ARRAY_FIELD_SEEDS[`${sectionId}.${field.key}`] || [];
  const textareaKeys = (field.itemFields || [])
    .filter((f) => f.type === "textarea")
    .map((f) => f.key);
  if (textareaKeys.length === 0) return source;
  return source.map((item: any) => {
    if (!item || typeof item !== "object") return item;
    const next = { ...item };
    for (const key of textareaKeys) {
      if (Array.isArray(next[key])) next[key] = next[key].join("\n");
    }
    return next;
  });
}

/**
 * Pages tab — per-page section content for the fixed storefront pages.
 * Option A ships the About page; the section list is fixed (no reorder/add),
 * each section offering the same schema-driven Content + Colour editing as
 * the homepage Content tab, plus show/hide and reset-to-default.
 */
export function PagesTab({ formData, setFormData, onSectionSelect }: PagesTabProps) {
  const openSectionsRef = useRef<string[]>([]);

  const handleAccordionChange = (value: string[]) => {
    const previous = openSectionsRef.current;
    const opened = value.find((v) => !previous.includes(v));
    openSectionsRef.current = value;
    if (opened) onSectionSelect?.(opened);
  };

  const updateSection = (
    sectionId: string,
    patch: Partial<{ visible: boolean; config: Record<string, any> }>,
  ) => {
    setFormData((prev) => ({
      ...prev,
      aboutSections: prev.aboutSections.map((s) =>
        s.id === sectionId ? { ...s, ...patch } : s,
      ),
    }));
  };

  const updateField = (sectionId: string, key: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      aboutSections: prev.aboutSections.map((s) =>
        s.id === sectionId ? { ...s, config: { ...s.config, [key]: value } } : s,
      ),
    }));
  };

  const resetSection = (sectionId: string) => {
    setFormData((prev) => {
      const colourOverrides = { ...prev.sectionColorOverrides };
      delete colourOverrides[sectionId];
      return {
        ...prev,
        sectionColorOverrides: colourOverrides,
        aboutSections: prev.aboutSections.map((s) =>
          s.id === sectionId ? { ...s, visible: true, config: {} } : s,
        ),
      };
    });
  };

  return (
    <div className="space-y-4">
      <section className="bs-card bs-card-pad">
        <div className="mb-2">
          <p className="bs-eyebrow mb-1">About Page</p>
          <p className="text-xs text-bs-fg-muted">
            Personalise each section, or leave it untouched to keep the default.
            Blank a field to fall back to its default text.
          </p>
        </div>
        <Accordion
          type="multiple"
          onValueChange={handleAccordionChange}
          className="w-full"
        >
          {formData.aboutSections.map((section) => {
            const schema = SECTION_SCHEMAS[section.type];
            // Keep only textAlign controls the schema declares — the generic
            // auto-injected one would be inert on fixed-alignment sections.
            const declaredKeys = new Set((schema?.fields || []).map((f) => f.key));
            const editableFields = getEditableFields(section.type).filter(
              (f) => f.key !== "textAlign" || declaredKeys.has("textAlign"),
            );
            const sectionLabel =
              schema?.label || section.type.replace(/([A-Z])/g, " $1").trim();
            const canHide = !ABOUT_ALWAYS_VISIBLE_IDS.has(section.id);
            const hasColourEdits =
              Object.keys(formData.sectionColorOverrides[section.id] || {}).length > 0;
            const hasEdits =
              Object.keys(section.config).length > 0 || !section.visible || hasColourEdits;

            return (
              <AccordionItem key={section.id} value={section.id}>
                <AccordionTrigger className="text-sm">
                  <span className="flex items-center gap-2">
                    {hasEdits && (
                      <span className="w-2 h-2 rounded-full bg-bs-info shrink-0" />
                    )}
                    <span className={section.visible ? "" : "line-through opacity-60"}>
                      {sectionLabel}
                    </span>
                    {!section.visible && (
                      <span className="text-xs text-bs-fg-muted font-normal">(hidden)</span>
                    )}
                    {section.visible && hasEdits && (
                      <span className="text-xs text-bs-fg-muted font-normal">(edited)</span>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex items-center justify-between pt-2 pb-1">
                    {canHide ? (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={section.visible}
                          onCheckedChange={(checked) =>
                            updateSection(section.id, { visible: checked })
                          }
                        />
                        <Label className="text-xs">Show on page</Label>
                      </div>
                    ) : (
                      <span className="text-xs text-bs-fg-muted">Always shown</span>
                    )}
                    {hasEdits && (
                      <button
                        type="button"
                        className="bs-btn bs-btn-ghost bs-btn-sm text-xs text-bs-fg-muted"
                        onClick={() => resetSection(section.id)}
                      >
                        <RotateCcw className="w-3 h-3 mr-1" aria-hidden="true" />
                        Reset to default
                      </button>
                    )}
                  </div>

                  <Tabs defaultValue="content" className="pt-1">
                    <TabsList className="grid w-full grid-cols-2 h-8">
                      <TabsTrigger value="content" className="text-xs">Content</TabsTrigger>
                      <TabsTrigger value="colour" className="text-xs">Colour</TabsTrigger>
                    </TabsList>
                    <TabsContent value="content" className="mt-3">
                      <div className="space-y-4 pt-2">
                        {editableFields.map((field: FieldSchema) => {
                          if (field.type === "array" && field.itemFields) {
                            return (
                              <ArrayFieldEditor
                                key={`${section.id}-${field.key}`}
                                sectionId={section.id}
                                field={field}
                                items={arrayDisplayItems(section.id, field, section.config)}
                                onUpdate={(key, items) => updateField(section.id, key, items)}
                              />
                            );
                          }

                          const rawValue = section.config[field.key];
                          const fieldValue = rawValue ?? field.default;

                          return (
                            <div key={`${section.id}-${field.key}`}>
                              {field.type === "boolean" ? (
                                <div className="flex items-center justify-between mt-1">
                                  <Label>{field.label}</Label>
                                  <Switch
                                    checked={!!fieldValue}
                                    onCheckedChange={(checked) =>
                                      updateField(section.id, field.key, checked)
                                    }
                                  />
                                </div>
                              ) : (
                                <>
                                  <Label>{field.label}</Label>
                                  {field.type === "image" ? (
                                    <SectionImageUploader
                                      value={String(fieldValue || "")}
                                      onChange={(url) => updateField(section.id, field.key, url)}
                                    />
                                  ) : field.type === "textarea" ? (
                                    <Textarea
                                      value={textareaDisplayValue(fieldValue, false)}
                                      onChange={(e) =>
                                        updateField(section.id, field.key, e.target.value)
                                      }
                                      rows={field.key === "paragraphs" ? 8 : 3}
                                      className="mt-1"
                                      placeholder={field.placeholder}
                                    />
                                  ) : field.type === "select" && field.options ? (
                                    <Select
                                      value={String(fieldValue || field.options[0])}
                                      onValueChange={(val) =>
                                        updateField(section.id, field.key, val)
                                      }
                                    >
                                      <SelectTrigger className="mt-1">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {field.options.map((opt) => (
                                          <SelectItem key={opt} value={opt}>
                                            {opt.charAt(0).toUpperCase() + opt.slice(1)}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : field.type === "number" ? (
                                    <Input
                                      type="number"
                                      value={fieldValue}
                                      onChange={(e) =>
                                        updateField(section.id, field.key, Number(e.target.value))
                                      }
                                      className="mt-1"
                                      placeholder={field.placeholder}
                                    />
                                  ) : (
                                    <Input
                                      type="text"
                                      value={String(fieldValue || "")}
                                      onChange={(e) =>
                                        updateField(section.id, field.key, e.target.value)
                                      }
                                      className="mt-1"
                                      placeholder={
                                        field.placeholder ||
                                        (field.type === "url" ? "/page or https://..." : undefined)
                                      }
                                    />
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </TabsContent>
                    <TabsContent value="colour" className="mt-3">
                      <SectionColourPanel
                        sectionId={section.id}
                        formData={formData}
                        setFormData={setFormData}
                      />
                    </TabsContent>
                  </Tabs>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </section>
    </div>
  );
}
