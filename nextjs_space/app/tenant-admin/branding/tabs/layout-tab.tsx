"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { GripVertical, Trash2, Plus } from "lucide-react";
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
} from "@/lib/templates/section-schemas";
import { useState } from "react";
import type { EditorFormData, SetFormData } from "./types";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

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
      className="flex items-center justify-between p-3 mb-2 bg-bs-card-2 border border-bs-border-100 rounded-bs-sm shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-bs-card rounded-bs-sm"
        >
          <GripVertical className="h-4 w-4 text-bs-fg-muted" aria-hidden="true" />
        </div>
        <span className="font-medium text-sm capitalize flex items-center text-bs-fg">
          {section.type.replace(/([A-Z])/g, " $1").trim()}
          <span className="text-bs-fg-muted font-normal ml-2 text-xs font-mono">
            {section.id.length > 8
              ? `...${section.id.slice(-6)}`
              : section.id}
          </span>
        </span>
      </div>
      <button
        type="button"
        className="bs-btn bs-btn-ghost bs-btn-sm h-8 w-8 p-0 flex items-center justify-center text-bs-danger"
        onClick={() => onRemove(id)}
        aria-label="Remove section"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
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

  return (
    <div className="space-y-6">
      {/* ─── Section Ordering ─────────────────────────── */}
      <section className="bs-card bs-card-pad space-y-3">
        <div>
          <h3 className="text-[22px] leading-tight" style={sectionTitleStyle}>
            Section Ordering
          </h3>
          <p className="text-sm text-bs-fg-muted">
            Drag and drop to reorder sections. Use the trash icon to remove a
            section.
          </p>
        </div>
        <div>
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

          <div className="mt-4 pt-4 border-t border-bs-border-100">
            <Dialog
              open={isAddSectionOpen}
              onOpenChange={setIsAddSectionOpen}
            >
              <DialogTrigger asChild>
                <button type="button" className="bs-btn bs-btn-ghost w-full border border-dashed border-bs-border-100">
                  <Plus className="h-4 w-4 mr-2" aria-hidden="true" /> Add Section
                </button>
              </DialogTrigger>
              <DialogContent className="bs-dialog-content max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Component Library</DialogTitle>
                  <DialogDescription>
                    Select a section to add to your layout.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 mt-4">
                  {getSectionsByCategory().map((group) => (
                    <div key={group.category}>
                      <h4 className="bs-eyebrow mb-3">
                        {group.label}
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {group.types.map(({ type, schema }) => (
                          <button
                            key={type}
                            type="button"
                            className="bs-btn bs-btn-ghost h-auto py-4 flex flex-col justify-center items-center gap-1.5 overflow-hidden text-left"
                            onClick={() => handleAddSection(type)}
                          >
                            <div className="font-semibold text-sm truncate w-full text-center">
                              {schema.label}
                            </div>
                            <div className="text-xs text-bs-fg-muted text-center leading-tight line-clamp-2 w-full">
                              {schema.description}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </section>
    </div>
  );
}
