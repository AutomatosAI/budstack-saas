"use client";

import { Check, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SOCIAL_PLATFORMS } from "@/lib/templates/section-schemas";
import type {
  FieldSchema,
  ArrayItemField,
  SocialPlatform,
} from "@/lib/templates/section-schemas";
import { ICON_GROUPS, getIcon } from "@/lib/icon-registry";
import { SectionImageUploader } from "./shared";
import { cn } from "@/lib/utils";

export function StyleCard({
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
        "relative flex flex-col items-start gap-0.5 p-3 rounded-bs-sm border-2 text-left transition-all w-full",
        selected
          ? "border-bs-green bg-bs-green/5 ring-1 ring-bs-green/20"
          : "border-bs-border-100 hover:border-bs-border-200 hover:bg-bs-card-2/50",
      )}
    >
      {selected && (
        <div className="absolute top-2 right-2">
          <Check className="w-4 h-4 text-bs-green" aria-hidden="true" />
        </div>
      )}
      <span className={cn("text-sm font-semibold", selected ? "text-bs-green" : "text-bs-fg")}>
        {label}
      </span>
      <span className="text-xs text-bs-fg-muted leading-tight">{description}</span>
    </button>
  );
}

// ─── Link Array Editor ────────────────────────────────────────

export function LinkArrayEditor({
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
          <button
            type="button"
            className="bs-btn bs-btn-ghost bs-btn-sm h-8 w-8 p-0 shrink-0 flex items-center justify-center text-bs-danger"
            onClick={() => removeLink(i)}
            aria-label="Remove link"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="bs-btn bs-btn-ghost bs-btn-sm w-full border border-dashed border-bs-border-100"
        onClick={addLink}
      >
        <Plus className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" /> {addLabel}
      </button>
    </div>
  );
}

// ─── Social Links Editor ──────────────────────────────────────

export function SocialLinksEditor({
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
          <span className="text-xs font-medium capitalize w-20 shrink-0 text-bs-fg-muted">
            {link.platform === "x" ? "X (Twitter)" : link.platform}
          </span>
          <Input
            value={link.url}
            onChange={(e) => updateLink(i, "url", e.target.value)}
            placeholder={`https://${link.platform}.com/...`}
            className="flex-1"
          />
          <button
            type="button"
            className="bs-btn bs-btn-ghost bs-btn-sm h-8 w-8 p-0 shrink-0 flex items-center justify-center text-bs-danger"
            onClick={() => removeLink(i)}
            aria-label="Remove social link"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ))}
      {availablePlatforms.length > 0 && (
        <Select onValueChange={(v) => addLink(v as SocialPlatform)}>
          <SelectTrigger className="border-dashed text-bs-fg-muted">
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

export function FooterSectionsEditor({
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
        <div key={i} className="border border-bs-border-100 rounded-bs-sm p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={section.title}
              onChange={(e) => updateSection(i, { title: e.target.value })}
              placeholder="Column title"
              className="flex-1 font-medium"
            />
            <button
              type="button"
              className="bs-btn bs-btn-ghost bs-btn-sm h-8 w-8 p-0 shrink-0 flex items-center justify-center text-bs-danger"
              onClick={() => removeSection(i)}
              aria-label="Remove column"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          <LinkArrayEditor
            links={section.links}
            onChange={(links) => updateSection(i, { links })}
            addLabel="Add Link"
          />
        </div>
      ))}
      {sections.length < 4 && (
        <button
          type="button"
          className="bs-btn bs-btn-ghost bs-btn-sm w-full border border-dashed border-bs-border-100"
          onClick={addSection}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" /> Add Column
        </button>
      )}
    </div>
  );
}

// ─── Array Sub-Field ─────────────────────────────────────────

/** Render a single sub-field inside an array item */
export function ArraySubField({
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
  if (field.type === "icon") {
    const currentName = String(v || field.default || "Star");
    const CurrentIcon = getIcon(currentName);
    return (
      <Select value={currentName} onValueChange={onChange}>
        <SelectTrigger className="mt-1">
          <span className="flex items-center gap-2">
            <CurrentIcon className="h-4 w-4" aria-hidden="true" />
            <span>{currentName}</span>
          </span>
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {ICON_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="px-2 pt-2 pb-1 text-[10px] font-mono uppercase tracking-[0.12em] text-bs-fg-muted">
                {group.label}
              </div>
              {group.icons.map((name) => {
                const Icon = getIcon(name);
                return (
                  <SelectItem key={name} value={name}>
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      <span>{name}</span>
                    </span>
                  </SelectItem>
                );
              })}
            </div>
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
export function ArrayFieldEditor({
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
        <button
          type="button"
          className="bs-btn bs-btn-ghost bs-btn-sm h-7 text-xs"
          onClick={addItem}
        >
          <Plus className="w-3 h-3 mr-1" aria-hidden="true" />
          Add {itemLabel}
        </button>
      </div>

      {items.length === 0 && (
        <p className="text-xs text-bs-fg-muted italic py-2">
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
            className="border border-bs-border-100 rounded-bs-sm bg-bs-card-2/30"
          >
            {/* Item header — always visible */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-bs-border-100 bg-bs-card-2/50 rounded-t-bs-sm">
              <span className="text-xs font-medium text-bs-fg-muted truncate max-w-[200px]">
                {previewText}
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  className="bs-btn bs-btn-ghost bs-btn-sm h-6 w-6 p-0 flex items-center justify-center disabled:opacity-50"
                  onClick={() => moveItem(index, -1)}
                  disabled={index === 0}
                  aria-label="Move up"
                >
                  <ChevronUp className="w-3 h-3" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="bs-btn bs-btn-ghost bs-btn-sm h-6 w-6 p-0 flex items-center justify-center disabled:opacity-50"
                  onClick={() => moveItem(index, 1)}
                  disabled={index === items.length - 1}
                  aria-label="Move down"
                >
                  <ChevronDown className="w-3 h-3" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="bs-btn bs-btn-ghost bs-btn-sm h-6 w-6 p-0 flex items-center justify-center text-bs-danger hover:bg-bs-danger/10"
                  onClick={() => removeItem(index)}
                  aria-label="Remove item"
                >
                  <Trash2 className="w-3 h-3" aria-hidden="true" />
                </button>
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
