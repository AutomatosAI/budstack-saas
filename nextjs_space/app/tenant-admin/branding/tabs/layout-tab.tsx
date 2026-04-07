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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { GripVertical, Trash2, Plus, Check } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  getSectionsByCategory,
  getSectionDefaults,
  NAV_STYLES,
  FOOTER_STYLES,
  SOCIAL_PLATFORMS,
  DEFAULT_NAV_LINKS,
} from "@/lib/section-schemas";
import type { SocialPlatform } from "@/lib/section-schemas";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { EditorFormData, SetFormData } from "./types";

// ─── Sortable Section Item ────────────────────────────────────

function SortableSectionItem({
  id,
  section,
  onRemove,
}: {
  id: string;
  section: any;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between p-3 mb-2 bg-white border rounded-md shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-100 rounded"
        >
          <GripVertical className="h-4 w-4 text-gray-400" />
        </div>
        <span className="font-medium text-sm capitalize flex items-center">
          {section.type.replace(/([A-Z])/g, " $1").trim()}
          <span className="text-muted-foreground font-normal ml-2 text-xs">
            {section.id.length > 8
              ? `...${section.id.slice(-6)}`
              : section.id}
          </span>
        </span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
        onClick={() => onRemove(id)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
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

// ─── Main Layout Tab ──────────────────────────────────────────

interface LayoutTabProps {
  formData: EditorFormData;
  setFormData: SetFormData;
}

export function LayoutTab({ formData, setFormData }: LayoutTabProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isAddSectionOpen, setIsAddSectionOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFormData((prev) => {
        const oldIndex = prev.layoutSections.findIndex(
          (s) => s.id === active.id,
        );
        const newIndex = prev.layoutSections.findIndex(
          (s) => s.id === over.id,
        );
        return {
          ...prev,
          layoutSections: arrayMove(prev.layoutSections, oldIndex, newIndex),
        };
      });
    }
  }

  function handleAddSection(type: string) {
    const defaults = getSectionDefaults(type);
    const newSection = {
      id: `${type.toLowerCase()}-${Date.now().toString(36)}`,
      type,
      config: defaults,
    };
    setFormData((prev) => ({
      ...prev,
      layoutSections: [...prev.layoutSections, newSection],
      sectionConfigs: {
        ...prev.sectionConfigs,
        [newSection.id]: { ...defaults },
      },
    }));
    setIsAddSectionOpen(false);
  }

  function handleRemoveSection(id: string) {
    setFormData((prev) => ({
      ...prev,
      layoutSections: prev.layoutSections.filter((s) => s.id !== id),
    }));
  }

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

  return (
    <div className="space-y-6">
      {/* ─── Navigation Style ─────────────────────────── */}
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

      {/* ─── Section Ordering ─────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Section Ordering</CardTitle>
          <CardDescription>
            Drag and drop to reorder sections. Use the trash icon to remove a
            section.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragCancel={handleDragCancel}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={formData.layoutSections.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {formData.layoutSections.map((section) => (
                <SortableSectionItem
                  key={section.id}
                  id={section.id}
                  section={section}
                  onRemove={handleRemoveSection}
                />
              ))}
            </SortableContext>
            <DragOverlay>
              {activeId ? (
                <SortableSectionItem
                  id={activeId}
                  section={formData.layoutSections.find(
                    (s) => s.id === activeId,
                  )}
                  onRemove={() => {}}
                />
              ) : null}
            </DragOverlay>
          </DndContext>

          <div className="mt-4 pt-4 border-t">
            <Dialog
              open={isAddSectionOpen}
              onOpenChange={setIsAddSectionOpen}
            >
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full border-dashed">
                  <Plus className="h-4 w-4 mr-2" /> Add Section
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Component Library</DialogTitle>
                  <DialogDescription>
                    Select a section to add to your layout.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 mt-4">
                  {getSectionsByCategory().map((group) => (
                    <div key={group.category}>
                      <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">
                        {group.label}
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {group.types.map(({ type, schema }) => (
                          <Button
                            key={type}
                            variant="outline"
                            className="h-auto py-4 flex flex-col justify-center items-center gap-1.5 hover:bg-slate-50 transition-colors overflow-hidden"
                            onClick={() => handleAddSection(type)}
                          >
                            <div className="font-semibold text-sm truncate w-full text-center">
                              {schema.label}
                            </div>
                            <div className="text-xs text-muted-foreground text-center leading-tight line-clamp-2 w-full">
                              {schema.description}
                            </div>
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* ─── Footer Style ─────────────────────────────── */}
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
