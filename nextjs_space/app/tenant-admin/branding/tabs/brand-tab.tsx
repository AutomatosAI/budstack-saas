"use client";

import { useRef, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Move,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { FileUpload } from "./shared";
import type { EditorFormData, SetFormData, LogoPlacement } from "./types";

/** Convert legacy string sizes to px numbers */
const NAV_SIZE_LEGACY: Record<string, number> = { small: 36, medium: 52, large: 72 };
const HERO_SIZE_LEGACY: Record<string, number> = { small: 48, medium: 80, large: 120, watermark: 200 };
function resolveSize(val: number | string, legacy: Record<string, number>, fallback: number): number {
  if (typeof val === 'number') return val;
  return legacy[val] ?? fallback;
}

interface BrandTabProps {
  formData: EditorFormData;
  setFormData: SetFormData;
  logo: File | null;
  favicon: File | null;
  onFileChange: (file: File | null, type: "logo" | "favicon") => void;
  logoUrl?: string | null;
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
        "flex flex-col items-center gap-1.5 p-2.5 rounded-lg border-2 transition-all",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
          : "border-muted hover:border-muted-foreground/30 hover:bg-muted/50",
      )}
    >
      {children}
      <span className={cn("text-[10px] font-medium", selected ? "text-primary" : "text-muted-foreground")}>
        {label}
      </span>
    </button>
  );
}

export function BrandTab({
  formData,
  setFormData,
  logo,
  favicon,
  onFileChange,
  logoUrl,
}: BrandTabProps) {
  const lp = formData.logoPlacement;
  const previewRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const updatePlacement = useCallback(
    (patch: Partial<LogoPlacement>) => {
      setFormData((prev) => ({
        ...prev,
        logoPlacement: { ...prev.logoPlacement, ...patch },
      }));
    },
    [setFormData],
  );

  const handlePreviewPosition = useCallback(
    (clientX: number, clientY: number) => {
      const el = previewRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
      updatePlacement({ heroX: Math.round(x), heroY: Math.round(y) });
    },
    [updatePlacement],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      handlePreviewPosition(e.clientX, e.clientY);

      const onMove = (ev: MouseEvent) => {
        if (draggingRef.current) handlePreviewPosition(ev.clientX, ev.clientY);
      };
      const onUp = () => {
        draggingRef.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [handlePreviewPosition],
  );

  // Resolve preview image URL
  const previewLogoUrl = logo ? URL.createObjectURL(logo) : logoUrl;

  // Hero logo size (px) — resolve legacy string values
  const heroSizePx = resolveSize(lp.heroSize, HERO_SIZE_LEGACY, 80);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Business Information</CardTitle>
          <CardDescription>Your store&apos;s identity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="businessName">Business Name *</Label>
            <Input
              id="businessName"
              value={formData.businessName}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, businessName: e.target.value }))
              }
              required
            />
          </div>
          <div>
            <Label htmlFor="tagline">Tagline</Label>
            <Textarea
              id="tagline"
              value={formData.tagline}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, tagline: e.target.value }))
              }
              placeholder="Your trusted medical cannabis partner"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Brand Images</CardTitle>
          <CardDescription>
            Upload your logo and favicon
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileUpload
            label="Logo"
            description="Recommended: PNG/SVG, transparent background"
            accept="image/*"
            onChange={(file) => onFileChange(file, "logo")}
            file={logo}
          />

          <FileUpload
            label="Favicon"
            description="Recommended: 32x32px or 64x64px, PNG/ICO"
            accept="image/*"
            onChange={(file) => onFileChange(file, "favicon")}
            file={favicon}
          />
        </CardContent>
      </Card>

      {/* === LOGO PLACEMENT === */}
      <Card>
        <CardHeader>
          <CardTitle>Logo Placement</CardTitle>
          <CardDescription>
            Control where and how your logo appears across your site
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* --- Navigation Section --- */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Navigation Bar
            </Label>

            {/* Position */}
            <div className="space-y-1.5">
              <Label className="text-xs">Position</Label>
              <div className="grid grid-cols-3 gap-2">
                <StyleOption
                  label="Left"
                  value="left"
                  selected={lp.navPosition === "left"}
                  onSelect={(v) => updatePlacement({ navPosition: v as LogoPlacement["navPosition"] })}
                >
                  <AlignLeft className="w-5 h-5" />
                </StyleOption>
                <StyleOption
                  label="Center"
                  value="center"
                  selected={lp.navPosition === "center"}
                  onSelect={(v) => updatePlacement({ navPosition: v as LogoPlacement["navPosition"] })}
                >
                  <AlignCenter className="w-5 h-5" />
                </StyleOption>
                <StyleOption
                  label="Right"
                  value="right"
                  selected={lp.navPosition === "right"}
                  onSelect={(v) => updatePlacement({ navPosition: v as LogoPlacement["navPosition"] })}
                >
                  <AlignRight className="w-5 h-5" />
                </StyleOption>
              </div>
            </div>

            {/* Size */}
            <div className="space-y-1.5">
              <Label className="text-xs">Logo Size — {resolveSize(lp.navSize, NAV_SIZE_LEGACY, 52)}px</Label>
              <Slider
                min={24}
                max={120}
                step={2}
                value={[resolveSize(lp.navSize, NAV_SIZE_LEGACY, 52)]}
                onValueChange={([v]) => updatePlacement({ navSize: v })}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>24px</span>
                <span>120px</span>
              </div>
            </div>

            {/* Show Business Name */}
            <div className="flex items-center justify-between">
              <Label className="text-xs">Show business name</Label>
              <Switch
                checked={lp.showBusinessName}
                onCheckedChange={(checked) => updatePlacement({ showBusinessName: checked })}
              />
            </div>
          </div>

          {/* Divider */}
          <div className="border-t" />

          {/* --- Hero Section --- */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Hero Section
            </Label>

            <div className="flex items-center justify-between">
              <Label className="text-xs">Show logo on hero</Label>
              <Switch
                checked={lp.heroShowLogo}
                onCheckedChange={(checked) => updatePlacement({ heroShowLogo: checked })}
              />
            </div>

            {lp.heroShowLogo && (
              <>
                {/* Interactive Preview */}
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Move className="w-3 h-3" /> Click or drag to position
                  </Label>
                  <div
                    ref={previewRef}
                    onMouseDown={handleMouseDown}
                    className="relative w-full aspect-[16/9] rounded-lg overflow-hidden border-2 border-dashed border-muted-foreground/30 cursor-crosshair select-none"
                    style={{
                      background: "linear-gradient(135deg, hsl(var(--primary)/0.2), hsl(var(--muted)))",
                    }}
                  >
                    {/* Overlay for contrast */}
                    <div className="absolute inset-0 bg-black/30" />

                    {/* Position crosshair */}
                    <div
                      className="absolute z-10 pointer-events-none"
                      style={{
                        left: `${lp.heroX}%`,
                        top: `${lp.heroY}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                    >
                      {previewLogoUrl ? (
                        <div
                          className={cn(
                            "border-2 border-white shadow-lg",
                            lp.heroStyle === "circular" && "rounded-full",
                            lp.heroStyle === "badge" && "rounded-xl bg-white/90 p-1",
                            lp.heroStyle === "plain" && "rounded",
                            heroSizePx >= 200 && "opacity-30",
                          )}
                          style={{
                            width: Math.min(heroSizePx * 0.5, 80),
                            height: Math.min(heroSizePx * 0.5, 80),
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={previewLogoUrl}
                            alt="Logo"
                            className={cn(
                              "w-full h-full",
                              lp.heroStyle === "circular" ? "object-cover rounded-full" : "object-contain",
                            )}
                          />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full border-2 border-white bg-white/30 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        </div>
                      )}
                    </div>

                    {/* Grid guides */}
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute left-1/3 top-0 bottom-0 border-l border-white/10" />
                      <div className="absolute left-2/3 top-0 bottom-0 border-l border-white/10" />
                      <div className="absolute top-1/3 left-0 right-0 border-t border-white/10" />
                      <div className="absolute top-2/3 left-0 right-0 border-t border-white/10" />
                    </div>
                  </div>

                  {/* Fine-tune X/Y */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">X Position (%)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={lp.heroX}
                        onChange={(e) => updatePlacement({ heroX: Number(e.target.value) })}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Y Position (%)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={lp.heroY}
                        onChange={(e) => updatePlacement({ heroY: Number(e.target.value) })}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Hero Logo Size */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Size — {heroSizePx}px</Label>
                  <Slider
                    min={24}
                    max={400}
                    step={4}
                    value={[heroSizePx]}
                    onValueChange={([v]) => updatePlacement({ heroSize: v })}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>24px</span>
                    <span>400px</span>
                  </div>
                </div>

                {/* Hero Logo Style */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Style</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <StyleOption
                      label="Plain"
                      value="plain"
                      selected={lp.heroStyle === "plain"}
                      onSelect={(v) => updatePlacement({ heroStyle: v as LogoPlacement["heroStyle"] })}
                    >
                      <div className="w-6 h-6 bg-muted-foreground/20 rounded" />
                    </StyleOption>
                    <StyleOption
                      label="Circular"
                      value="circular"
                      selected={lp.heroStyle === "circular"}
                      onSelect={(v) => updatePlacement({ heroStyle: v as LogoPlacement["heroStyle"] })}
                    >
                      <div className="w-6 h-6 bg-muted-foreground/20 rounded-full border-2 border-muted-foreground/30" />
                    </StyleOption>
                    <StyleOption
                      label="Badge"
                      value="badge"
                      selected={lp.heroStyle === "badge"}
                      onSelect={(v) => updatePlacement({ heroStyle: v as LogoPlacement["heroStyle"] })}
                    >
                      <div className="w-6 h-6 bg-white/80 rounded-lg border border-muted-foreground/20 shadow-sm" />
                    </StyleOption>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Divider */}
          <div className="border-t" />

          {/* --- Footer Section --- */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Footer
            </Label>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Show logo in footer</Label>
              <Switch
                checked={lp.footerShowLogo}
                onCheckedChange={(checked) => updatePlacement({ footerShowLogo: checked })}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
