"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EditorFormData, SetFormData } from "./types";

interface DesignTabProps {
  formData: EditorFormData;
  setFormData: SetFormData;
}

export function DesignTab({ formData, setFormData }: DesignTabProps) {
  const update = (field: keyof EditorFormData, value: any) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6">
      {/* Button Styles */}
      <Card>
        <CardHeader>
          <CardTitle>Button Styles</CardTitle>
          <CardDescription>
            Customize button appearance (applies to ALL pages)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Button Shape</Label>
            <Select
              value={formData.buttonStyle}
              onValueChange={(v) => update("buttonStyle", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rounded">Rounded Corners</SelectItem>
                <SelectItem value="square">Square Corners</SelectItem>
                <SelectItem value="pill">Pill Shape</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Button Size</Label>
            <Select
              value={formData.buttonSize}
              onValueChange={(v) => update("buttonSize", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Layout Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Layout Preferences</CardTitle>
          <CardDescription>Global layout settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Border Radius</Label>
            <Select
              value={formData.borderRadius}
              onValueChange={(v) => update("borderRadius", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (Sharp)</SelectItem>
                <SelectItem value="small">Small (4px)</SelectItem>
                <SelectItem value="medium">Medium (8px)</SelectItem>
                <SelectItem value="large">Large (16px)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Spacing</Label>
            <Select
              value={formData.spacing}
              onValueChange={(v) => update("spacing", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">Compact</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="comfortable">Comfortable</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Shadow Style</Label>
            <Select
              value={formData.shadowStyle}
              onValueChange={(v) => update("shadowStyle", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (Flat)</SelectItem>
                <SelectItem value="soft">Soft</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="bold">Bold</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Premium Design Features */}
      <Card>
        <CardHeader>
          <CardTitle>Premium Design Features</CardTitle>
          <CardDescription>Custom animations and modern effects</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Component Style (Glassmorphism)</Label>
              <Select
                value={formData.glassEffect}
                onValueChange={(v) => update("glassEffect", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Solid (Default)</SelectItem>
                  <SelectItem value="light">Light Frosted Glass</SelectItem>
                  <SelectItem value="heavy">Heavy Frosted Glass</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Applies a premium blur effect to cards and navigation.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Scroll Animations</Label>
              <Select
                value={formData.animationType}
                onValueChange={(v) => update("animationType", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Static)</SelectItem>
                  <SelectItem value="fade-up">Fade Up</SelectItem>
                  <SelectItem value="slide-right">Slide Right</SelectItem>
                  <SelectItem value="zoom-in">Zoom In</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                How sections reveal themselves as you scroll down.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label>Section Dividers</Label>
              <Select
                value={formData.dividerStyle}
                onValueChange={(v) => update("dividerStyle", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Straight (Default)</SelectItem>
                  <SelectItem value="wave">Fluid Waves</SelectItem>
                  <SelectItem value="slant">Modern Slant</SelectItem>
                  <SelectItem value="curve">Soft Curve</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Replaces straight horizontal lines between page sections with
                organic SVG shapes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hero Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Advanced Hero Configuration</CardTitle>
          <CardDescription>
            Customize your homepage Hero section specifically
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Alignment</Label>
              <Select
                value={formData.homeHeroAlignment}
                onValueChange={(v) => update("homeHeroAlignment", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left Aligned</SelectItem>
                  <SelectItem value="center">Center Aligned</SelectItem>
                  <SelectItem value="right">Right Aligned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Section Height</Label>
              <Select
                value={formData.homeHeroHeight}
                onValueChange={(v) => update("homeHeroHeight", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                  <SelectItem value="full">Full Screen (100vh)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Image Overlay Style</Label>
              <Select
                value={formData.homeHeroOverlayStyle}
                onValueChange={(v) => update("homeHeroOverlayStyle", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Overlay (Image Only)</SelectItem>
                  <SelectItem value="dark">Solid Dark Scrim</SelectItem>
                  <SelectItem value="gradient-dark">
                    Dark Gradient (Fade Up)
                  </SelectItem>
                  <SelectItem value="gradient-primary">
                    Primary Brand Gradient
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Overlay Opacity (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={formData.homeHeroOverlayOpacity}
                onChange={(e) =>
                  update("homeHeroOverlayOpacity", Number(e.target.value))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
