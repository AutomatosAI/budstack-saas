"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import {
  SECTION_SCHEMAS,
  getEditableFields,
  migrateSectionConfig,
} from "@/lib/section-schemas";
import type { FieldSchema, ArrayItemField } from "@/lib/section-schemas";
import { SectionImageUploader } from "./shared";
import type { EditorFormData, SetFormData } from "./types";

interface ContentTabProps {
  formData: EditorFormData;
  setFormData: SetFormData;
}

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
          No {field.label.toLowerCase()} yet. Click "Add {itemLabel}" to start.
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

export function ContentTab({ formData, setFormData }: ContentTabProps) {
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
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h4 className="font-semibold text-blue-900 mb-2">
          Live Store Editor
        </h4>
        <p className="text-sm text-blue-800">
          The fields below are dynamically generated based on your selected
          template's layout. Editing them here will instantly update the preview
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

                      {field.type === "image" ? (
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
    </div>
  );
}
