"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/sonner";
import {
  Upload,
  Check,
  Palette,
  Type,
  Layout,
  Image as ImageIcon,
} from "lucide-react";
import Image from "next/image";

interface PlatformBrandingFormProps {
  settings: {
    id: string;
    businessName: string;
    tagline: string | null;
    logoUrl: string | null;
    faviconUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;
    textColor: string;
    headingColor: string;
    fontFamily: string;
    headingFontFamily: string;
    template: string;
  };
}

const TEMPLATES = [
  { id: "modern", name: "Modern", description: "Clean and professional" },
  { id: "minimalist", name: "Minimalist", description: "Simple and elegant" },
  { id: "bold", name: "Bold", description: "Vibrant and eye-catching" },
];

const FONTS = [
  { id: "inter", name: "Inter", description: "Modern sans-serif" },
  { id: "roboto", name: "Roboto", description: "Classic sans-serif" },
  { id: "lato", name: "Lato", description: "Friendly sans-serif" },
  { id: "montserrat", name: "Montserrat", description: "Geometric sans-serif" },
  { id: "poppins", name: "Poppins", description: "Rounded sans-serif" },
  { id: "playfair", name: "Playfair Display", description: "Elegant serif" },
];

export default function PlatformBrandingForm({
  settings,
}: PlatformBrandingFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [logo, setLogo] = useState<File | null>(null);
  const [favicon, setFavicon] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    businessName: settings.businessName,
    tagline: settings.tagline || "",

    // Colors
    primaryColor: settings.primaryColor,
    secondaryColor: settings.secondaryColor,
    accentColor: settings.accentColor,
    backgroundColor: settings.backgroundColor,
    textColor: settings.textColor,
    headingColor: settings.headingColor,

    // Typography
    fontFamily: settings.fontFamily,
    headingFontFamily: settings.headingFontFamily,

    // Template
    template: settings.template,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formDataToSend = new FormData();

      // Append all form data
      Object.entries(formData).forEach(([key, value]) => {
        formDataToSend.append(key, value as string);
      });

      // Append files
      if (logo) formDataToSend.append("logo", logo);
      if (favicon) formDataToSend.append("favicon", favicon);

      const res = await fetch(`/api/super-admin/platform-settings`, {
        method: "POST",
        body: formDataToSend,
      });

      if (!res.ok) throw new Error("Failed to update platform settings");

      toast.success("✅ Platform branding updated successfully!");
      router.refresh();
    } catch (error) {
      toast.error("Failed to update platform branding");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Tabs defaultValue="design" className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="design">
            <Layout className="w-4 h-4 mr-2" />
            Design
          </TabsTrigger>
          <TabsTrigger value="colors">
            <Palette className="w-4 h-4 mr-2" />
            Colors
          </TabsTrigger>
          <TabsTrigger value="typography">
            <Type className="w-4 h-4 mr-2" />
            Typography
          </TabsTrigger>
        </TabsList>

        {/* DESIGN TAB */}
        <TabsContent value="design" className="space-y-6">
          <Card className="bg-white rounded-2xl border border-slate-200/50 shadow-2xl">
            <CardHeader className="border-b border-slate-100">
              <CardTitle>Platform Information</CardTitle>
              <CardDescription>
                Basic information about BudStack
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div>
                <Label htmlFor="businessName">Platform Name *</Label>
                <Input
                  id="businessName"
                  value={formData.businessName}
                  onChange={(e) =>
                    setFormData({ ...formData, businessName: e.target.value })
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
                    setFormData({ ...formData, tagline: e.target.value })
                  }
                  placeholder="White-Label Medical Cannabis E-Commerce Platform"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white rounded-2xl border border-slate-200/50 shadow-2xl">
            <CardHeader className="border-b border-slate-100">
              <CardTitle>Template Style</CardTitle>
              <CardDescription>
                Choose the overall design aesthetic
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-3 gap-4">
                {TEMPLATES.map((template) => (
                  <div
                    key={template.id}
                    onClick={() =>
                      setFormData({ ...formData, template: template.id })
                    }
                    className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all ${formData.template === template.id
                      ? "border-emerald-500 bg-emerald-50 shadow-md"
                      : "border-slate-200 hover:border-slate-300 hover:shadow"
                      }`}
                  >
                    {formData.template === template.id && (
                      <Check className="absolute top-2 right-2 w-5 h-5 text-emerald-600" />
                    )}
                    <h3 className="font-semibold text-slate-900">
                      {template.name}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {template.description}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white rounded-2xl border border-slate-200/50 shadow-2xl">
            <CardHeader className="border-b border-slate-100">
              <CardTitle>Brand Images</CardTitle>
              <CardDescription>Upload your logo and favicon</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {/* Logo Upload */}
              <div className="space-y-2">
                <Label>Platform Logo</Label>
                <p className="text-sm text-slate-500">
                  Recommended: PNG/SVG, transparent background
                </p>

                {settings.logoUrl && !logo && (
                  <div className="relative w-48 h-24 border rounded-lg overflow-hidden bg-slate-50 shadow-sm">
                    <Image
                      src={settings.logoUrl}
                      alt="Current logo"
                      fill
                      className="object-contain p-2"
                    />
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setLogo(e.target.files?.[0] || null)}
                    className="max-w-xs"
                  />
                  {logo && (
                    <span className="text-sm text-emerald-600 flex items-center gap-1">
                      <Check className="w-4 h-4" />
                      New logo selected
                    </span>
                  )}
                </div>
              </div>

              {/* Favicon Upload */}
              <div className="space-y-2">
                <Label>Favicon</Label>
                <p className="text-sm text-slate-500">
                  Recommended: 32x32px or 64x64px, PNG/ICO
                </p>

                {settings.faviconUrl && !favicon && (
                  <div className="relative w-16 h-16 border rounded-lg overflow-hidden bg-slate-50 shadow-sm">
                    <Image
                      src={settings.faviconUrl}
                      alt="Current favicon"
                      fill
                      className="object-contain p-1"
                    />
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFavicon(e.target.files?.[0] || null)}
                    className="max-w-xs"
                  />
                  {favicon && (
                    <span className="text-sm text-emerald-600 flex items-center gap-1">
                      <Check className="w-4 h-4" />
                      New favicon selected
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* COLORS TAB */}
        <TabsContent value="colors" className="space-y-6">
          <Card className="bg-white rounded-2xl border border-slate-200/50 shadow-2xl">
            <CardHeader className="border-b border-slate-100">
              <CardTitle>Color Palette</CardTitle>
              <CardDescription>Define your brand colors</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="primaryColor">Primary Color</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="color"
                      id="primaryColor"
                      value={formData.primaryColor}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          primaryColor: e.target.value,
                        })
                      }
                      className="w-20 h-10"
                    />
                    <Input
                      type="text"
                      value={formData.primaryColor}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          primaryColor: e.target.value,
                        })
                      }
                      placeholder="#059669"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="secondaryColor">Secondary Color</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="color"
                      id="secondaryColor"
                      value={formData.secondaryColor}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          secondaryColor: e.target.value,
                        })
                      }
                      className="w-20 h-10"
                    />
                    <Input
                      type="text"
                      value={formData.secondaryColor}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          secondaryColor: e.target.value,
                        })
                      }
                      placeholder="#34d399"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="accentColor">Accent Color</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="color"
                      id="accentColor"
                      value={formData.accentColor}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          accentColor: e.target.value,
                        })
                      }
                      className="w-20 h-10"
                    />
                    <Input
                      type="text"
                      value={formData.accentColor}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          accentColor: e.target.value,
                        })
                      }
                      placeholder="#10b981"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="backgroundColor">Background Color</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="color"
                      id="backgroundColor"
                      value={formData.backgroundColor}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          backgroundColor: e.target.value,
                        })
                      }
                      className="w-20 h-10"
                    />
                    <Input
                      type="text"
                      value={formData.backgroundColor}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          backgroundColor: e.target.value,
                        })
                      }
                      placeholder="#ffffff"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="textColor">Text Color</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="color"
                      id="textColor"
                      value={formData.textColor}
                      onChange={(e) =>
                        setFormData({ ...formData, textColor: e.target.value })
                      }
                      className="w-20 h-10"
                    />
                    <Input
                      type="text"
                      value={formData.textColor}
                      onChange={(e) =>
                        setFormData({ ...formData, textColor: e.target.value })
                      }
                      placeholder="#1f2937"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="headingColor">Heading Color</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="color"
                      id="headingColor"
                      value={formData.headingColor}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          headingColor: e.target.value,
                        })
                      }
                      className="w-20 h-10"
                    />
                    <Input
                      type="text"
                      value={formData.headingColor}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          headingColor: e.target.value,
                        })
                      }
                      placeholder="#111827"
                    />
                  </div>
                </div>
              </div>

              {/* Color Preview */}
              <div
                className="mt-6 p-6 rounded-lg border"
                style={{ backgroundColor: formData.backgroundColor }}
              >
                <h3
                  className="text-2xl font-bold mb-2"
                  style={{
                    color: formData.headingColor,
                    fontFamily: formData.headingFontFamily,
                  }}
                >
                  Preview Heading
                </h3>
                <p
                  className="mb-4"
                  style={{
                    color: formData.textColor,
                    fontFamily: formData.fontFamily,
                  }}
                >
                  This is how your text will look with the selected colors and
                  fonts.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="px-4 py-2 rounded"
                    style={{
                      backgroundColor: formData.primaryColor,
                      color: "#ffffff",
                    }}
                  >
                    Primary Button
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 rounded"
                    style={{
                      backgroundColor: formData.secondaryColor,
                      color: "#ffffff",
                    }}
                  >
                    Secondary Button
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 rounded"
                    style={{
                      backgroundColor: formData.accentColor,
                      color: "#ffffff",
                    }}
                  >
                    Accent Button
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TYPOGRAPHY TAB */}
        <TabsContent value="typography" className="space-y-6">
          <Card className="bg-white rounded-2xl border border-slate-200/50 shadow-2xl">
            <CardHeader className="border-b border-slate-100">
              <CardTitle>Font Selection</CardTitle>
              <CardDescription>Choose fonts for your platform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div>
                <Label>Body Font</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {FONTS.map((font) => (
                    <div
                      key={font.id}
                      onClick={() =>
                        setFormData({ ...formData, fontFamily: font.id })
                      }
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${formData.fontFamily === font.id
                        ? "border-emerald-500 bg-emerald-50 shadow-md"
                        : "border-slate-200 hover:border-slate-300 hover:shadow"
                        }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4
                            className="font-semibold"
                            style={{ fontFamily: font.id }}
                          >
                            {font.name}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {font.description}
                          </p>
                        </div>
                        {formData.fontFamily === font.id && (
                          <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>Heading Font</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {FONTS.map((font) => (
                    <div
                      key={font.id}
                      onClick={() =>
                        setFormData({ ...formData, headingFontFamily: font.id })
                      }
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${formData.headingFontFamily === font.id
                        ? "border-emerald-500 bg-emerald-50 shadow-md"
                        : "border-slate-200 hover:border-slate-300 hover:shadow"
                        }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4
                            className="font-semibold"
                            style={{ fontFamily: font.id }}
                          >
                            {font.name}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {font.description}
                          </p>
                        </div>
                        {formData.headingFontFamily === font.id && (
                          <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end mt-8">
        <Button
          type="submit"
          size="lg"
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium shadow-md hover:shadow-lg transition-all"
        >
          {isLoading ? "Saving..." : "Save Platform Branding"}
        </Button>
      </div>
    </form>
  );
}
