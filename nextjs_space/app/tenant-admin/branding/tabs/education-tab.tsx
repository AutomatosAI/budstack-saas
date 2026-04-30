"use client";

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
import { Trash2, Plus } from "lucide-react";
import type { EditorFormData, SetFormData } from "./types";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

interface EducationTabProps {
  formData: EditorFormData;
  setFormData: SetFormData;
}

export function EducationTab({ formData, setFormData }: EducationTabProps) {
  return (
    <div className="space-y-6">
      <section className="bs-card bs-card-pad space-y-6">
        <div>
          <h3 className="text-[22px] leading-tight" style={sectionTitleStyle}>
            Interactive Education Content
          </h3>
          <p className="text-sm text-bs-fg-muted">
            Add interactive hotspots to imagery across the site.
          </p>
        </div>
        <div className="flex justify-between items-center">
          <Label>Image Hotspots</Label>
          <button
            type="button"
            className="bs-btn bs-btn-ghost bs-btn-sm"
            onClick={() =>
              setFormData((prev) => ({
                ...prev,
                educationHotspots: [
                  ...prev.educationHotspots,
                  {
                    id: Date.now().toString(),
                    targetSectionId: "all",
                    title: "New Hotspot",
                    description: "",
                    x: 50,
                    y: 50,
                  },
                ],
              }))
            }
          >
            <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
            Add Hotspot
          </button>
        </div>

        {formData.educationHotspots.length === 0 ? (
          <div className="text-center p-6 border border-dashed border-bs-border-100 rounded-bs-md text-bs-fg-muted">
            No hotspots configured. Add one to get started.
          </div>
        ) : (
          <div className="space-y-4">
            {formData.educationHotspots.map(
              (hotspot: any, index: number) => (
                <div
                  key={hotspot.id}
                  className="p-4 border border-bs-border-100 rounded-bs-md space-y-4 relative bg-bs-card-2"
                >
                  <button
                    type="button"
                    className="bs-btn bs-btn-ghost bs-btn-sm absolute top-2 right-2 h-8 w-8 p-0 flex items-center justify-center text-bs-danger hover:bg-bs-danger/10"
                    onClick={() => {
                      const newHotspots = [...formData.educationHotspots];
                      newHotspots.splice(index, 1);
                      setFormData((prev) => ({
                        ...prev,
                        educationHotspots: newHotspots,
                      }));
                    }}
                    aria-label="Remove hotspot"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        value={hotspot.title}
                        onChange={(e) => {
                          const newHotspots = [
                            ...formData.educationHotspots,
                          ];
                          newHotspots[index] = {
                            ...newHotspots[index],
                            title: e.target.value,
                          };
                          setFormData((prev) => ({
                            ...prev,
                            educationHotspots: newHotspots,
                          }));
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Target Section</Label>
                      <Select
                        value={hotspot.targetSectionId || "all"}
                        onValueChange={(value) => {
                          const newHotspots = [
                            ...formData.educationHotspots,
                          ];
                          newHotspots[index] = {
                            ...newHotspots[index],
                            targetSectionId: value,
                          };
                          setFormData((prev) => ({
                            ...prev,
                            educationHotspots: newHotspots,
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Sections" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">
                            All Sections (Global)
                          </SelectItem>
                          {formData.layoutSections
                            .filter(
                              (s: any) => s.id && s.visible !== false,
                            )
                            .map((s: any) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.type
                                  .replace(/([A-Z])/g, " $1")
                                  .trim()}{" "}
                                (#{s.id})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4 col-span-1 md:col-span-2">
                      <div className="space-y-2">
                        <Label>X Position (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={hotspot.x}
                          onChange={(e) => {
                            const newHotspots = [
                              ...formData.educationHotspots,
                            ];
                            newHotspots[index] = {
                              ...newHotspots[index],
                              x: Number(e.target.value),
                            };
                            setFormData((prev) => ({
                              ...prev,
                              educationHotspots: newHotspots,
                            }));
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Y Position (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={hotspot.y}
                          onChange={(e) => {
                            const newHotspots = [
                              ...formData.educationHotspots,
                            ];
                            newHotspots[index] = {
                              ...newHotspots[index],
                              y: Number(e.target.value),
                            };
                            setFormData((prev) => ({
                              ...prev,
                              educationHotspots: newHotspots,
                            }));
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Detailed Description</Label>
                    <Textarea
                      rows={2}
                      value={hotspot.description}
                      onChange={(e) => {
                        const newHotspots = [
                          ...formData.educationHotspots,
                        ];
                        newHotspots[index] = {
                          ...newHotspots[index],
                          description: e.target.value,
                        };
                        setFormData((prev) => ({
                          ...prev,
                          educationHotspots: newHotspots,
                        }));
                      }}
                    />
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </section>
    </div>
  );
}
