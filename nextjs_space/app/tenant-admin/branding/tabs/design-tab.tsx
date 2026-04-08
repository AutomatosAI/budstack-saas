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
import { cn } from "@/lib/utils";
import type { EditorFormData, SetFormData } from "./types";

interface DesignTabProps {
  formData: EditorFormData;
  setFormData: SetFormData;
}

/** Visual radio button for picking a style option */
function StyleOption({
  label,
  value,
  selected,
  onSelect,
  children,
}: {
  label: string;
  value: string;
  selected: boolean;
  onSelect: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={cn(
        "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
          : "border-muted hover:border-muted-foreground/30 hover:bg-muted/50",
      )}
    >
      {children}
      <span className={cn("text-xs font-medium", selected ? "text-primary" : "text-muted-foreground")}>
        {label}
      </span>
    </button>
  );
}

export function DesignTab({ formData, setFormData }: DesignTabProps) {
  const update = (field: keyof EditorFormData, value: any) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6">
      {/* === BUTTON STYLES — Visual Picker === */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Button Styles</CardTitle>
          <CardDescription>Shape, size, and hover effects for all CTA buttons</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Button Shape */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Shape</Label>
            <div className="grid grid-cols-3 gap-2">
              <StyleOption label="Rounded" value="rounded" selected={formData.buttonStyle === "rounded"} onSelect={(v) => update("buttonStyle", v)}>
                <div className="w-full h-9 bg-primary/80 rounded-lg flex items-center justify-center text-white text-xs font-medium">Button</div>
              </StyleOption>
              <StyleOption label="Square" value="square" selected={formData.buttonStyle === "square"} onSelect={(v) => update("buttonStyle", v)}>
                <div className="w-full h-9 bg-primary/80 rounded-sm flex items-center justify-center text-white text-xs font-medium">Button</div>
              </StyleOption>
              <StyleOption label="Pill" value="pill" selected={formData.buttonStyle === "pill"} onSelect={(v) => update("buttonStyle", v)}>
                <div className="w-full h-9 bg-primary/80 rounded-full flex items-center justify-center text-white text-xs font-medium">Button</div>
              </StyleOption>
            </div>
          </div>

          {/* Button Size */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Size</Label>
            <div className="grid grid-cols-3 gap-2">
              <StyleOption label="Small" value="small" selected={formData.buttonSize === "small"} onSelect={(v) => update("buttonSize", v)}>
                <div className="h-10 flex items-center justify-center">
                  <div className="px-3 py-1.5 bg-primary/80 rounded-md text-white text-[10px] font-medium">Get Started</div>
                </div>
              </StyleOption>
              <StyleOption label="Medium" value="medium" selected={formData.buttonSize === "medium"} onSelect={(v) => update("buttonSize", v)}>
                <div className="h-10 flex items-center justify-center">
                  <div className="px-4 py-2 bg-primary/80 rounded-md text-white text-xs font-medium">Get Started</div>
                </div>
              </StyleOption>
              <StyleOption label="Large" value="large" selected={formData.buttonSize === "large"} onSelect={(v) => update("buttonSize", v)}>
                <div className="h-10 flex items-center justify-center">
                  <div className="px-5 py-2.5 bg-primary/80 rounded-md text-white text-sm font-medium">Get Started</div>
                </div>
              </StyleOption>
            </div>
          </div>

          {/* Button Hover Effect */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Hover Effect</Label>
            <div className="grid grid-cols-2 gap-2">
              <StyleOption label="None" value="none" selected={formData.buttonHoverEffect === "none"} onSelect={(v) => update("buttonHoverEffect", v)}>
                <div className="h-8 flex items-center justify-center">
                  <div className="px-4 py-1.5 bg-slate-300 rounded-md text-slate-600 text-[10px] font-medium">Static</div>
                </div>
              </StyleOption>
              <StyleOption label="Lift" value="lift" selected={formData.buttonHoverEffect === "lift"} onSelect={(v) => update("buttonHoverEffect", v)}>
                <div className="h-8 flex items-center justify-center">
                  <div className="px-4 py-1.5 bg-primary/80 rounded-md text-white text-[10px] font-medium -translate-y-0.5 shadow-md">Lift Up</div>
                </div>
              </StyleOption>
              <StyleOption label="Glow" value="glow" selected={formData.buttonHoverEffect === "glow"} onSelect={(v) => update("buttonHoverEffect", v)}>
                <div className="h-8 flex items-center justify-center">
                  <div className="px-4 py-1.5 bg-primary/80 rounded-md text-white text-[10px] font-medium shadow-[0_0_12px_rgba(0,0,0,0.25)]">Glow</div>
                </div>
              </StyleOption>
              <StyleOption label="Scale" value="scale" selected={formData.buttonHoverEffect === "scale"} onSelect={(v) => update("buttonHoverEffect", v)}>
                <div className="h-8 flex items-center justify-center">
                  <div className="px-4 py-1.5 bg-primary/80 rounded-md text-white text-[10px] font-medium scale-105">Scale Up</div>
                </div>
              </StyleOption>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* === LAYOUT & CARDS === */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cards & Layout</CardTitle>
          <CardDescription>Global shapes, shadows, and spacing for content cards</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Border Radius */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Card Corners</Label>
            <div className="grid grid-cols-4 gap-2">
              {([
                { v: "none", label: "Sharp", radius: "rounded-none" },
                { v: "small", label: "Subtle", radius: "rounded" },
                { v: "medium", label: "Rounded", radius: "rounded-lg" },
                { v: "large", label: "Soft", radius: "rounded-2xl" },
              ] as const).map((opt) => (
                <StyleOption key={opt.v} label={opt.label} value={opt.v} selected={formData.borderRadius === opt.v} onSelect={(v) => update("borderRadius", v)}>
                  <div className={cn("w-full h-12 bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20", opt.radius)} />
                </StyleOption>
              ))}
            </div>
          </div>

          {/* Shadow Style */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Card Shadow</Label>
            <div className="grid grid-cols-4 gap-2">
              {([
                { v: "none", label: "Flat", shadow: "shadow-none" },
                { v: "soft", label: "Soft", shadow: "shadow-sm" },
                { v: "medium", label: "Medium", shadow: "shadow-md" },
                { v: "bold", label: "Bold", shadow: "shadow-xl" },
              ] as const).map((opt) => (
                <StyleOption key={opt.v} label={opt.label} value={opt.v} selected={formData.shadowStyle === opt.v} onSelect={(v) => update("shadowStyle", v)}>
                  <div className={cn("w-full h-12 bg-white rounded-lg border", opt.shadow)} />
                </StyleOption>
              ))}
            </div>
          </div>

          {/* Spacing */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Section Spacing</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: "compact", label: "Compact", gap: "gap-1" },
                { v: "normal", label: "Normal", gap: "gap-2" },
                { v: "comfortable", label: "Airy", gap: "gap-3" },
              ] as const).map((opt) => (
                <StyleOption key={opt.v} label={opt.label} value={opt.v} selected={formData.spacing === opt.v} onSelect={(v) => update("spacing", v)}>
                  <div className={cn("w-full flex flex-col items-stretch", opt.gap)}>
                    <div className="h-2.5 bg-primary/30 rounded-sm" />
                    <div className="h-2.5 bg-primary/20 rounded-sm" />
                    <div className="h-2.5 bg-primary/10 rounded-sm" />
                  </div>
                </StyleOption>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* === PREMIUM DESIGN FEATURES === */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            Premium Effects
            <span className="text-[10px] bg-gradient-to-r from-violet-500 to-pink-500 text-white px-2 py-0.5 rounded-full font-semibold">PRO</span>
          </CardTitle>
          <CardDescription>Glass effects, animations, and section dividers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Glass Effect */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Glassmorphism</Label>
            <div className="grid grid-cols-3 gap-2">
              <StyleOption label="Solid" value="none" selected={formData.glassEffect === "none"} onSelect={(v) => update("glassEffect", v)}>
                <div className="w-full h-12 bg-white rounded-lg border flex items-center justify-center">
                  <div className="w-5 h-5 rounded bg-primary/60" />
                </div>
              </StyleOption>
              <StyleOption label="Light Glass" value="light" selected={formData.glassEffect === "light"} onSelect={(v) => update("glassEffect", v)}>
                <div className="w-full h-12 rounded-lg border flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-200/40 to-purple-200/40" />
                  <div className="relative w-5 h-5 rounded bg-white/70 backdrop-blur-sm border border-white/30" />
                </div>
              </StyleOption>
              <StyleOption label="Heavy Glass" value="heavy" selected={formData.glassEffect === "heavy"} onSelect={(v) => update("glassEffect", v)}>
                <div className="w-full h-12 rounded-lg border flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-300/60 to-purple-300/60" />
                  <div className="relative w-5 h-5 rounded bg-white/40 backdrop-blur-md border border-white/20" />
                </div>
              </StyleOption>
            </div>
            <p className="text-[10px] text-muted-foreground">Frosted glass blur on cards and content boxes.</p>
          </div>

          {/* Scroll Animations */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Scroll Animations</Label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { v: "none", label: "None", desc: "Static content" },
                { v: "fade-up", label: "Fade Up", desc: "Float upward" },
                { v: "slide-right", label: "Slide In", desc: "Slide from left" },
                { v: "zoom-in", label: "Zoom In", desc: "Scale into view" },
              ] as const).map((opt) => (
                <StyleOption key={opt.v} label={opt.label} value={opt.v} selected={formData.animationType === opt.v} onSelect={(v) => update("animationType", v)}>
                  <div className="h-8 w-full flex items-center justify-center">
                    <span className="text-[9px] text-muted-foreground leading-tight text-center">{opt.desc}</span>
                  </div>
                </StyleOption>
              ))}
            </div>
          </div>

          {/* Section Dividers — SVG previews */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Section Dividers</Label>
            <div className="grid grid-cols-2 gap-2">
              <StyleOption label="Straight" value="none" selected={formData.dividerStyle === "none"} onSelect={(v) => update("dividerStyle", v)}>
                <div className="w-full h-8 flex flex-col justify-center">
                  <div className="h-3 bg-primary/20 rounded-t-sm" />
                  <div className="h-px bg-primary/30" />
                  <div className="h-3 bg-primary/10 rounded-b-sm" />
                </div>
              </StyleOption>
              <StyleOption label="Wave" value="wave" selected={formData.dividerStyle === "wave"} onSelect={(v) => update("dividerStyle", v)}>
                <div className="w-full h-8 flex flex-col justify-center overflow-hidden">
                  <div className="h-3 bg-primary/20 rounded-t-sm" />
                  <svg viewBox="0 0 120 12" className="w-full h-3 -my-px">
                    <path d="M0,0 C30,12 60,0 90,8 L120,0 L120,12 L0,12 Z" fill="hsl(var(--primary) / 0.1)" />
                  </svg>
                </div>
              </StyleOption>
              <StyleOption label="Slant" value="slant" selected={formData.dividerStyle === "slant"} onSelect={(v) => update("dividerStyle", v)}>
                <div className="w-full h-8 flex flex-col justify-center overflow-hidden">
                  <div className="h-3 bg-primary/20 rounded-t-sm" />
                  <svg viewBox="0 0 120 12" className="w-full h-3 -my-px">
                    <polygon points="0,0 120,12 120,12 0,12" fill="hsl(var(--primary) / 0.1)" />
                  </svg>
                </div>
              </StyleOption>
              <StyleOption label="Curve" value="curve" selected={formData.dividerStyle === "curve"} onSelect={(v) => update("dividerStyle", v)}>
                <div className="w-full h-8 flex flex-col justify-center overflow-hidden">
                  <div className="h-3 bg-primary/20 rounded-t-sm" />
                  <svg viewBox="0 0 120 12" className="w-full h-3 -my-px">
                    <path d="M0,0 Q60,24 120,0 L120,12 L0,12 Z" fill="hsl(var(--primary) / 0.1)" />
                  </svg>
                </div>
              </StyleOption>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hero Section removed — alignment, height, overlay style and opacity
         are now per-section fields in the Content tab via section schemas */}
    </div>
  );
}
