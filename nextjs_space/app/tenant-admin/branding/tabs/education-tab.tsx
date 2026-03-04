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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import type { EditorFormData, SetFormData } from "./types";

interface EducationTabProps {
  formData: EditorFormData;
  setFormData: SetFormData;
}

export function EducationTab({ formData, setFormData }: EducationTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Interactive Education Content</CardTitle>
          <CardDescription>
            Add interactive hotspots to imagery across the site.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-between items-center">
            <Label>Image Hotspots</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
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
              <Plus className="w-4 h-4 mr-2" />
              Add Hotspot
            </Button>
          </div>

          {formData.educationHotspots.length === 0 ? (
            <div className="text-center p-6 border border-dashed rounded-lg text-muted-foreground">
              No hotspots configured. Add one to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {formData.educationHotspots.map(
                (hotspot: any, index: number) => (
                  <div
                    key={hotspot.id}
                    className="p-4 border rounded-lg space-y-4 relative bg-card"
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        const newHotspots = [...formData.educationHotspots];
                        newHotspots.splice(index, 1);
                        setFormData((prev) => ({
                          ...prev,
                          educationHotspots: newHotspots,
                        }));
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>

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
        </CardContent>
      </Card>
    </div>
  );
}
