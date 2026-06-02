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
import {
  SECTION_SCHEMAS,
  getEditableFields,
  migrateSectionConfig,
  NAV_STYLES,
  FOOTER_STYLES,
  DEFAULT_NAV_LINKS,
} from "@/lib/templates/section-schemas";
import type { FieldSchema } from "@/lib/templates/section-schemas";
import { SectionImageUploader, SectionVideoUploader } from "./shared";
import { SectionColourPanel } from "./section-colour-panel";
import { ProductPicker } from "./product-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { EditorFormData, SetFormData } from "./types";
import {
  StyleCard,
  LinkArrayEditor,
  SocialLinksEditor,
  FooterSectionsEditor,
  ArrayFieldEditor,
} from "./content-tab-editors";

interface ContentTabProps {
  formData: EditorFormData;
  setFormData: SetFormData;
  /** Called when an accordion item is opened. Used by the parent form to
   *  scroll the live preview and pulse the selected section. */
  onSectionSelect?: (sectionId: string) => void;
}

// ─── Main Content Tab ────────────────────────────────────────

export function ContentTab({ formData, setFormData, onSectionSelect }: ContentTabProps) {
  // Track which accordion items are currently open so we can detect
  // newly-opened ones (and only fire onSectionSelect when a NEW section
  // expands, not when one collapses).
  const openSectionsRef = useRef<string[]>(["navigation"]);

  const handleAccordionChange = (value: string[]) => {
    const previous = openSectionsRef.current;
    const opened = value.find((v) => !previous.includes(v));
    openSectionsRef.current = value;
    // Only scroll for real section IDs — skip the static "navigation"/"footer"
    // items since they aren't data-section-id targets in the renderer.
    if (opened && opened !== "navigation" && opened !== "footer") {
      onSectionSelect?.(opened);
    }
  };
  // Nav/footer helpers
  const updateNavConfig = (patch: Partial<EditorFormData["navigationConfig"]>) => {
    setFormData((prev) => ({
      ...prev,
      navigationConfig: { ...prev.navigationConfig, ...patch },
    }));
  };

  const updateFooterConfig = (patch: Partial<EditorFormData["footerConfig"]>) => {
    setFormData((prev) => ({
      ...prev,
      footerConfig: { ...prev.footerConfig, ...patch },
    }));
  };

  function handleChangeSectionType(sectionId: string, newType: string) {
    setFormData((prev) => {
      const sectionIndex = prev.layoutSections.findIndex(
        (s) => s.id === sectionId,
      );
      if (sectionIndex === -1) return prev;

      const oldConfig =
        prev.sectionConfigs[sectionId] ||
        prev.layoutSections[sectionIndex].config ||
        {};
      const migratedConfig = migrateSectionConfig(oldConfig, newType);
      const updatedSections = [...prev.layoutSections];
      updatedSections[sectionIndex] = {
        ...updatedSections[sectionIndex],
        type: newType,
        config: migratedConfig,
      };

      return {
        ...prev,
        layoutSections: updatedSections,
        sectionConfigs: {
          ...prev.sectionConfigs,
          [sectionId]: migratedConfig,
        },
      };
    });
  }

  return (
    <div className="space-y-4">
      <section className="bs-card bs-card-pad">
        <Accordion
          type="multiple"
          defaultValue={["navigation"]}
          onValueChange={handleAccordionChange}
          className="w-full"
        >

          {/* ─── Navigation ─────────────────────────── */}
          <AccordionItem value="navigation">
            <AccordionTrigger className="text-base font-semibold">
              Navigation
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <div>
                  <p className="bs-eyebrow mb-2">Style</p>
                  <div className="grid grid-cols-2 gap-2">
                    {NAV_STYLES.map((nav) => (
                      <StyleCard
                        key={nav.type}
                        label={nav.label}
                        description={nav.description}
                        selected={formData.navigationStyle === nav.type}
                        onSelect={() => setFormData((prev) => ({ ...prev, navigationStyle: nav.type }))}
                      />
                    ))}
                  </div>
                </div>

                <div className="border-t border-bs-border-100 pt-4">
                  <p className="bs-eyebrow mb-2">Menu Links</p>
                  <LinkArrayEditor
                    links={formData.navigationConfig.links}
                    onChange={(links) => updateNavConfig({ links })}
                    addLabel="Add Menu Link"
                  />
                  <button
                    type="button"
                    className="bs-btn bs-btn-ghost bs-btn-sm mt-2 text-xs text-bs-fg-muted"
                    onClick={() => updateNavConfig({ links: DEFAULT_NAV_LINKS })}
                  >
                    Reset to defaults
                  </button>
                </div>

                <div className="border-t border-bs-border-100 pt-4 space-y-3">
                  <p className="bs-eyebrow">CTA Button</p>
                  <div className="flex gap-2">
                    <Input
                      value={formData.navigationConfig.cta.label}
                      onChange={(e) => updateNavConfig({ cta: { ...formData.navigationConfig.cta, label: e.target.value } })}
                      placeholder="Button text"
                      className="flex-1"
                    />
                    <Input
                      value={formData.navigationConfig.cta.href}
                      onChange={(e) => updateNavConfig({ cta: { ...formData.navigationConfig.cta, href: e.target.value } })}
                      placeholder="/page"
                      className="flex-1"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Show Cart Icon</Label>
                    <Switch
                      checked={formData.navigationConfig.showCart}
                      onCheckedChange={(checked) => updateNavConfig({ showCart: checked })}
                    />
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ─── Section Content ─────────────────────── */}
          {formData.layoutSections.map((section: any) => {
            if (!section.id) return null;

            const configValues =
              formData.sectionConfigs[section.id] || section.config || {};
            const editableFields = getEditableFields(section.type);
            const schema = SECTION_SCHEMAS[section.type];
            const sameCategory = schema
              ? Object.entries(SECTION_SCHEMAS)
                  .filter(
                    ([t, s]) =>
                      s.category === schema.category && t !== section.type,
                  )
                  .map(([t, s]) => ({ type: t, label: s.label }))
              : [];

            const updateField = (key: string, value: any) => {
              setFormData((prev) => ({
                ...prev,
                sectionConfigs: {
                  ...prev.sectionConfigs,
                  [section.id]: {
                    ...prev.sectionConfigs[section.id],
                    [key]: value,
                  },
                },
              }));
            };

            const sectionLabel = schema?.label || section.type.replace(/([A-Z])/g, " $1").trim();
            const hasEdits = Object.keys(formData.sectionConfigs[section.id] || {}).length > 0;

            return (
              <AccordionItem key={section.id} value={section.id}>
                <AccordionTrigger className="text-sm">
                  <span className="flex items-center gap-2">
                    {hasEdits && (
                      <span className="w-2 h-2 rounded-full bg-bs-info shrink-0" />
                    )}
                    {sectionLabel}
                    {hasEdits && (
                      <span className="text-xs text-bs-fg-muted font-normal">
                        (edited)
                      </span>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <Tabs defaultValue="content" className="pt-2">
                    <TabsList className="grid w-full grid-cols-2 h-8">
                      <TabsTrigger value="content" className="text-xs">Content</TabsTrigger>
                      <TabsTrigger value="colour" className="text-xs">Colour</TabsTrigger>
                    </TabsList>
                    <TabsContent value="content" className="mt-3">
                      <div className="space-y-4 pt-2">
                        {sameCategory.length > 0 && (
                          <div>
                            <Label className="text-xs text-bs-fg-muted">Swap variant</Label>
                            <Select
                              value={section.type}
                              onValueChange={(newType) =>
                                handleChangeSectionType(section.id, newType)
                              }
                            >
                              <SelectTrigger className="mt-1 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={section.type}>
                                  {schema?.label || section.type}
                                </SelectItem>
                                {sameCategory.map((opt) => (
                                  <SelectItem key={opt.type} value={opt.type}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {editableFields.length > 0 ? (
                          editableFields.map((field: FieldSchema) => {
                            const fieldValue = configValues[field.key] ?? field.default;

                            // Conditional visibility for ProductShowcase data source toggle:
                            // Hide "categories" array when using real products, hide "productIds" when manual
                            const dataSource = configValues.dataSource || "manual";
                            if (field.key === "categories" && dataSource === "products") return null;
                            if (field.key === "productIds" && dataSource !== "products") return null;

                            // Product picker field
                            if (field.type === "product-picker") {
                              return (
                                <div key={`${section.id}-${field.key}`}>
                                  <Label>{field.label}</Label>
                                  <ProductPicker
                                    value={String(fieldValue || "")}
                                    onChange={(val) => updateField(field.key, val)}
                                  />
                                </div>
                              );
                            }

                            // Array field with item schema — render inline item editor
                            if (field.type === "array" && field.itemFields) {
                              const arrayItems = Array.isArray(configValues[field.key])
                                ? configValues[field.key]
                                : [];
                              return (
                                <ArrayFieldEditor
                                  key={`${section.id}-${field.key}`}
                                  sectionId={section.id}
                                  field={field}
                                  items={arrayItems}
                                  onUpdate={updateField}
                                />
                              );
                            }

                            return (
                              <div key={`${section.id}-${field.key}`}>
                                {field.type === "boolean" ? (
                                  <div className="flex items-center justify-between mt-1">
                                    <Label>{field.label}</Label>
                                    <Switch
                                      checked={!!fieldValue}
                                      onCheckedChange={(checked) => updateField(field.key, checked)}
                                    />
                                  </div>
                                ) : (
                                  <>
                                    <Label>{field.label}</Label>

                                    {field.type === "video" ? (
                                      <SectionVideoUploader
                                        value={String(fieldValue || "")}
                                        onChange={(url) => updateField(field.key, url)}
                                      />
                                    ) : field.type === "image" ? (
                                      <SectionImageUploader
                                        value={String(fieldValue || "")}
                                        onChange={(url) => updateField(field.key, url)}
                                      />
                                    ) : field.type === "textarea" ? (
                                      <Textarea
                                        value={String(fieldValue || "")}
                                        onChange={(e) =>
                                          updateField(field.key, e.target.value)
                                        }
                                        rows={3}
                                        className="mt-1"
                                        placeholder={field.placeholder}
                                      />
                                    ) : field.type === "select" && field.options ? (
                                      <Select
                                        value={String(fieldValue || field.options[0])}
                                        onValueChange={(val) => updateField(field.key, val)}
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
                                          updateField(field.key, Number(e.target.value))
                                        }
                                        className="mt-1"
                                        placeholder={field.placeholder}
                                      />
                                    ) : (
                                      <Input
                                        type="text"
                                        value={String(fieldValue || "")}
                                        onChange={(e) =>
                                          updateField(field.key, e.target.value)
                                        }
                                        className="mt-1"
                                        placeholder={
                                          field.placeholder ||
                                          (field.type === "url"
                                            ? "/page or https://..."
                                            : undefined)
                                        }
                                      />
                                    )}
                                  </>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-sm text-bs-fg-muted">
                            No editable fields defined for this section type.
                          </p>
                        )}
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

          {/* ─── Footer ─────────────────────────────── */}
          <AccordionItem value="footer">
            <AccordionTrigger className="text-base font-semibold">
              Footer
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <div>
                  <p className="bs-eyebrow mb-2">Style</p>
                  <div className="grid grid-cols-3 gap-2">
                    {FOOTER_STYLES.map((f) => (
                      <StyleCard
                        key={f.type}
                        label={f.label}
                        description={f.description}
                        selected={formData.footerStyle === f.type}
                        onSelect={() => setFormData((prev) => ({ ...prev, footerStyle: f.type }))}
                      />
                    ))}
                  </div>
                </div>

                <div className="border-t border-bs-border-100 pt-4 space-y-3">
                  <div>
                    <Label>Tagline</Label>
                    <Input
                      value={formData.footerConfig.tagline}
                      onChange={(e) => updateFooterConfig({ tagline: e.target.value })}
                      placeholder="Your tagline here..."
                      className="mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Address</Label>
                      <Input
                        value={formData.footerConfig.address}
                        onChange={(e) => updateFooterConfig({ address: e.target.value })}
                        placeholder="Business address"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input
                        value={formData.footerConfig.email}
                        onChange={(e) => updateFooterConfig({ email: e.target.value })}
                        placeholder="contact@..."
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Disclaimer</Label>
                    <Input
                      value={formData.footerConfig.disclaimer}
                      onChange={(e) => updateFooterConfig({ disclaimer: e.target.value })}
                      placeholder="Legal disclaimer text..."
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="border-t border-bs-border-100 pt-4">
                  <p className="bs-eyebrow mb-2">Footer Columns</p>
                  <FooterSectionsEditor
                    sections={formData.footerConfig.sections}
                    onChange={(sections) => updateFooterConfig({ sections })}
                  />
                </div>

                <div className="border-t border-bs-border-100 pt-4">
                  <p className="bs-eyebrow mb-2">Social Links</p>
                  <SocialLinksEditor
                    links={formData.footerConfig.socialLinks}
                    onChange={(socialLinks) => updateFooterConfig({ socialLinks: socialLinks as EditorFormData["footerConfig"]["socialLinks"] })}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </section>
    </div>
  );
}
