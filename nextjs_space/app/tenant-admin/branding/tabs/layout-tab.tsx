"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { getSectionsByCategory, getSectionDefaults } from "@/lib/section-schemas";
import { useState } from "react";
import type { EditorFormData, SetFormData } from "./types";

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
    </div>
  );
}
