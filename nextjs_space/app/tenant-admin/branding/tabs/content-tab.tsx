"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Plus, Trash2, ChevronDown, ChevronUp, Check } from "lucide-react";
import {
  SECTION_SCHEMAS,
  getEditableFields,
  migrateSectionConfig,
  NAV_STYLES,
  FOOTER_STYLES,
  SOCIAL_PLATFORMS,
  DEFAULT_NAV_LINKS,
} from "@/lib/section-schemas";
import type { FieldSchema, ArrayItemField, SocialPlatform } from "@/lib/section-schemas";
import { SectionImageUploader, SectionVideoUploader } from "./shared";
import { cn } from "@/lib/utils";
import type { EditorFormData, SetFormData } from "./types";

interface ContentTabProps {
  formData: EditorFormData;
  setFormData: SetFormData;
}

// ─── Style Picker Card ────────────────────────────────────────

function StyleCard({
  label,
  description,
  selected,
  onSelect,
}: {
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative flex flex-col items-start gap-0.5 p-3 rounded-lg border-2 text-left transition-all w-full",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
          : "border-muted hover:border-muted-foreground/30 hover:bg-muted/50",
      )}
    >
      {selected && (
        <div className="absolute top-2 right-2">
          <Check className="w-4 h-4 text-primary" />
        </div>
      )}
      <span className={cn("text-sm font-semibold", selected ? "text-primary" : "text-foreground")}>
        {label}
      </span>
      <span className="text-xs text-muted-foreground leading-tight">{description}</span>
    </button>
  );
}

// ─── Link Array Editor ────────────────────────────────────────

function LinkArrayEditor({
  links,
  onChange,
  addLabel = "Add Link",
}: {
  links: { label: string; href: string }[];
  onChange: (links: { label: string; href: string }[]) => void;
  addLabel?: string;
}) {
  const updateLink = (index: number, field: "label" | "href", value: string) => {
    const updated = links.map((l, i) => (i === index ? { ...l, [field]: value } : l));
    onChange(updated);
  };

  const removeLink = (index: number) => {
    onChange(links.filter((_, i) => i !== index));
  };

  const addLink = () => {
    onChange([...links, { label: "", href: "/" }]);
  };

  return (
    <div className="space-y-2">
      {links.map((link, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input
            value={link.label}
            onChange={(e) => updateLink(i, "label", e.target.value)}
            placeholder="Label"
            className="flex-1"
          />
          <Input
            value={link.href}
            onChange={(e) => updateLink(i, "href", e.target.value)}
            placeholder="/page"
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-red-500 hover:text-red-700"
            onClick={() => removeLink(i)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full border-dashed"
        onClick={addLink}
      >
        <Plus className="h-3.5 w-3.5 mr-1.5" /> {addLabel}
      </Button>
    </div>
  );
}

// ─── Social Links Editor ──────────────────────────────────────

function SocialLinksEditor({
  links,
  onChange,
}: {
  links: { platform: string; url: string }[];
  onChange: (links: { platform: string; url: string }[]) => void;
}) {
  const usedPlatforms = new Set(links.map((l) => l.platform));
  const availablePlatforms = SOCIAL_PLATFORMS.filter((p) => !usedPlatforms.has(p));

  const updateLink = (index: number, field: "platform" | "url", value: string) => {
    const updated = links.map((l, i) => (i === index ? { ...l, [field]: value } : l));
    onChange(updated);
  };

  const removeLink = (index: number) => {
    onChange(links.filter((_, i) => i !== index));
  };

  const addLink = (platform: SocialPlatform) => {
    onChange([...links, { platform, url: "" }]);
  };

  return (
    <div className="space-y-2">
      {links.map((link, i) => (
        <div key={i} className="flex gap-2 items-center">
          <span className="text-xs font-medium capitalize w-20 shrink-0 text-muted-foreground">
            {link.platform === "x" ? "X (Twitter)" : link.platform}
          </span>
          <Input
            value={link.url}
            onChange={(e) => updateLink(i, "url", e.target.value)}
            placeholder={`https://${link.platform}.com/...`}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-red-500 hover:text-red-700"
            onClick={() => removeLink(i)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      {availablePlatforms.length > 0 && (
        <Select onValueChange={(v) => addLink(v as SocialPlatform)}>
          <SelectTrigger className="border-dashed text-muted-foreground">
            <SelectValue placeholder="+ Add social link..." />
          </SelectTrigger>
          <SelectContent>
            {availablePlatforms.map((p) => (
              <SelectItem key={p} value={p} className="capitalize">
                {p === "x" ? "X (Twitter)" : p.charAt(0).toUpperCase() + p.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

// ─── Footer Sections Editor ──────────────────────────────────

function FooterSectionsEditor({
  sections,
  onChange,
}: {
  sections: { title: string; links: { label: string; href: string }[] }[];
  onChange: (sections: { title: string; links: { label: string; href: string }[] }[]) => void;
}) {
  const updateSection = (index: number, patch: Partial<{ title: string; links: { label: string; href: string }[] }>) => {
    const updated = sections.map((s, i) => (i === index ? { ...s, ...patch } : s));
    onChange(updated);
  };

  const removeSection = (index: number) => {
    onChange(sections.filter((_, i) => i !== index));
  };

  const addSection = () => {
    onChange([...sections, { title: "New Column", links: [{ label: "Link", href: "/" }] }]);
  };

  return (
    <div className="space-y-4">
      {sections.map((section, i) => (
        <div key={i} className="border rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={section.title}
              onChange={(e) => updateSection(i, { title: e.target.value })}
              placeholder="Column title"
              className="flex-1 font-medium"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-red-500 hover:text-red-700"
              onClick={() => removeSection(i)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <LinkArrayEditor
            links={section.links}
            onChange={(links) => updateSection(i, { links })}
            addLabel="Add Link"
          />
        </div>
      ))}
      {sections.length < 4 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full border-dashed"
          onClick={addSection}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Column
        </Button>
      )}
    </div>
  );
}

// ─── Array Sub-Field ─────────────────────────────────────────

/** Render a single sub-field inside an array item */
function ArraySubField({
  field,
  value,
  onChange,
}: {
  field: ArrayItemField;
  value: any;
  onChange: (val: any) => void;
}) {
  const v = value ?? field.default;

  if (field.type === "image") {
    return (
      <SectionImageUploader
        value={String(v || "")}
        onChange={onChange}
      />
    );
  }
  if (field.type === "textarea") {
    return (
      <Textarea
        value={String(v || "")}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="mt-1"
        placeholder={field.placeholder}
      />
    );
  }
  if (field.type === "select" && field.options) {
    return (
      <Select
        value={String(v || field.options[0])}
        onValueChange={onChange}
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
    );
  }
  if (field.type === "number") {
    return (
      <Input
        type="number"
        value={v}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1"
        placeholder={field.placeholder}
      />
    );
  }
  return (
    <Input
      type="text"
      value={String(v || "")}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1"
      placeholder={field.placeholder}
    />
  );
}

/** Inline array item editor for fields like features, cards, FAQs, etc. */
function ArrayFieldEditor({
  sectionId,
  field,
  items,
  onUpdate,
}: {
  sectionId: string;
  field: FieldSchema;
  items: any[];
  onUpdate: (key: string, items: any[]) => void;
}) {
  const itemFields = field.itemFields || [];
  const itemLabel = field.itemLabel || "Item";

  const addItem = () => {
    const newItem: Record<string, any> = {};
    for (const f of itemFields) {
      newItem[f.key] = f.default;
    }
    onUpdate(field.key, [...items, newItem]);
  };

  const removeItem = (index: number) => {
    onUpdate(field.key, items.filter((_, i) => i !== index));
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= items.length) return;
    const updated = [...items];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    onUpdate(field.key, updated);
  };

  const updateItemField = (index: number, key: string, value: any) => {
    const updated = items.map((item, i) =>
      i === index ? { ...item, [key]: value } : item,
    );
    onUpdate(field.key, updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{field.label}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={addItem}
        >
          <Plus className="w-3 h-3 mr-1" />
          Add {itemLabel}
        </Button>
      </div>

      {items.length === 0 && (
        <p className="text-xs text-muted-foreground italic py-2">
          No {field.label.toLowerCase()} yet. Click &quot;Add {itemLabel}&quot; to start.
        </p>
      )}

      {items.map((item, index) => {
        // Derive a preview label from the first text field
        const previewField = itemFields.find(
          (f) => f.type === "text" && item[f.key],
        );
        const previewText = previewField
          ? String(item[previewField.key]).slice(0, 40)
          : `${itemLabel} ${index + 1}`;

        return (
          <div
            key={`${sectionId}-${field.key}-${index}`}
            className="border rounded-lg bg-muted/30"
          >
            {/* Item header — always visible */}
            <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50 rounded-t-lg">
              <span className="text-xs font-medium text-muted-foreground truncate max-w-[200px]">
                {previewText}
              </span>
              <div className="flex items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => moveItem(index, -1)}
                  disabled={index === 0}
                >
                  <ChevronUp className="w-3 h-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => moveItem(index, 1)}
                  disabled={index === items.length - 1}
                >
                  <ChevronDown className="w-3 h-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:bg-destructive/10"
                  onClick={() => removeItem(index)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* Item fields */}
            <div className="p-3 space-y-3">
              {itemFields.map((subField) => (
                <div key={subField.key}>
                  <Label className="text-xs">{subField.label}</Label>
                  <ArraySubField
                    field={subField}
                    value={item[subField.key]}
                    onChange={(val) =>
                      updateItemField(index, subField.key, val)
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Content Tab ────────────────────────────────────────

export function ContentTab({ formData, setFormData }: ContentTabProps) {
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
    <div className="space-y-6">
      {/* ─── Navigation ─────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Navigation</CardTitle>
          <CardDescription>Choose a header style and configure menu links</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Style</Label>
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

          <div className="border-t pt-4">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Menu Links</Label>
            <LinkArrayEditor
              links={formData.navigationConfig.links}
              onChange={(links) => updateNavConfig({ links })}
              addLabel="Add Menu Link"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 text-xs text-muted-foreground"
              onClick={() => updateNavConfig({ links: DEFAULT_NAV_LINKS })}
            >
              Reset to defaults
            </Button>
          </div>

          <div className="border-t pt-4 space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider block">CTA Button</Label>
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
        </CardContent>
      </Card>

      {/* ─── Section Content ─────────────────────── */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">
          Section Content
        </h4>
        <p className="text-sm text-blue-800">
          The fields below are dynamically generated based on your selected
          template&apos;s layout. Editing them here will instantly update the preview
          on the right.
        </p>
      </div>

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

        return (
          <Card key={section.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">
                  {schema?.label ||
                    section.type.replace(/([A-Z])/g, " $1").trim()}
                </CardTitle>
                {sameCategory.length > 0 && (
                  <Select
                    value={section.type}
                    onValueChange={(newType) =>
                      handleChangeSectionType(section.id, newType)
                    }
                  >
                    <SelectTrigger className="w-[180px] h-8 text-xs">
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
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {editableFields.length > 0 ? (
                editableFields.map((field: FieldSchema) => {
                  const fieldValue = configValues[field.key] ?? field.default;

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
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">
                  No editable fields defined for this section type.
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* ─── Footer ─────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Footer</CardTitle>
          <CardDescription>Choose a footer style and configure content</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Style</Label>
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

          <div className="border-t pt-4 space-y-3">
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

          <div className="border-t pt-4">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Footer Columns</Label>
            <FooterSectionsEditor
              sections={formData.footerConfig.sections}
              onChange={(sections) => updateFooterConfig({ sections })}
            />
          </div>

          <div className="border-t pt-4">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Social Links</Label>
            <SocialLinksEditor
              links={formData.footerConfig.socialLinks}
              onChange={(socialLinks) => updateFooterConfig({ socialLinks: socialLinks as EditorFormData["footerConfig"]["socialLinks"] })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
