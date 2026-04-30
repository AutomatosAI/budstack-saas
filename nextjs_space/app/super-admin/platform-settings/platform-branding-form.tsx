"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "@/components/ui/sonner";
import { Check, Palette, Type, Layout, Loader2 } from "lucide-react";
import Image from "next/image";

import { FONTS } from "@/app/tenant-admin/branding/tabs/shared";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

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
    automatosApiKey?: string | null;
    automatosAgentId?: number | null;
    automatosHelperAgentId?: number | null;
  };
}

const TEMPLATES = [
  { id: "modern", name: "Modern", description: "Clean and professional" },
  { id: "minimalist", name: "Minimalist", description: "Simple and elegant" },
  { id: "bold", name: "Bold", description: "Vibrant and eye-catching" },
];

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bs-card bs-card-pad">
      <div className="mb-6 border-b border-bs-border-100 pb-4">
        <h2
          className="text-[22px] leading-tight text-bs-fg"
          style={sectionTitleStyle}
        >
          {title}
        </h2>
        <p className="text-sm text-bs-fg-muted mt-1">{description}</p>
      </div>
      {children}
    </section>
  );
}

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

    primaryColor: settings.primaryColor,
    secondaryColor: settings.secondaryColor,
    accentColor: settings.accentColor,
    backgroundColor: settings.backgroundColor,
    textColor: settings.textColor,
    headingColor: settings.headingColor,

    fontFamily: settings.fontFamily,
    headingFontFamily: settings.headingFontFamily,

    template: settings.template,

    automatosApiKey: settings.automatosApiKey || "",
    automatosAgentId: settings.automatosAgentId?.toString() || "",
    automatosHelperAgentId: settings.automatosHelperAgentId?.toString() || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formDataToSend = new FormData();

      Object.entries(formData).forEach(([key, value]) => {
        formDataToSend.append(key, value as string);
      });

      if (logo) formDataToSend.append("logo", logo);
      if (favicon) formDataToSend.append("favicon", favicon);

      const res = await fetch(`/api/super-admin/platform-settings`, {
        method: "POST",
        body: formDataToSend,
      });

      if (!res.ok) throw new Error("Failed to update platform settings");

      toast.success("Platform branding updated successfully");
      router.refresh();
    } catch {
      toast.error("Failed to update platform branding");
    } finally {
      setIsLoading(false);
    }
  };

  const tileBase = "p-4 border-2 rounded-bs-md cursor-pointer transition-all";
  const tileSelected =
    "border-bs-green bg-bs-green/10 shadow-bs-card-hover";
  const tileIdle =
    "border-bs-border-100 hover:border-bs-border bg-bs-card-2/40";

  return (
    <form onSubmit={handleSubmit}>
      <Tabs defaultValue="design" className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full xl:max-w-2xl lg:max-w-xl bg-bs-card border border-bs-border-100 rounded-bs-md p-1">
          <TabsTrigger
            value="design"
            className="rounded-bs-sm data-[state=active]:bg-bs-green data-[state=active]:text-bs-canvas"
          >
            <Layout className="w-4 h-4 mr-2" aria-hidden="true" />
            Design
          </TabsTrigger>
          <TabsTrigger
            value="ai"
            className="rounded-bs-sm data-[state=active]:bg-bs-green data-[state=active]:text-bs-canvas"
          >
            <Layout className="w-4 h-4 mr-2" aria-hidden="true" />
            AI &amp; Widgets
          </TabsTrigger>
          <TabsTrigger
            value="colors"
            className="rounded-bs-sm data-[state=active]:bg-bs-green data-[state=active]:text-bs-canvas"
          >
            <Palette className="w-4 h-4 mr-2" aria-hidden="true" />
            Colors
          </TabsTrigger>
          <TabsTrigger
            value="typography"
            className="rounded-bs-sm data-[state=active]:bg-bs-green data-[state=active]:text-bs-canvas"
          >
            <Type className="w-4 h-4 mr-2" aria-hidden="true" />
            Typography
          </TabsTrigger>
        </TabsList>

        <TabsContent value="design" className="space-y-6">
          <SectionCard
            title="Platform Information"
            description="Basic information about BudStacks"
          >
            <div className="space-y-4">
              <div>
                <Label htmlFor="businessName" className="text-bs-fg">
                  Platform Name *
                </Label>
                <Input
                  id="businessName"
                  value={formData.businessName}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      businessName: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="tagline" className="text-bs-fg">
                  Tagline
                </Label>
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
            </div>
          </SectionCard>

          <SectionCard
            title="Template Style"
            description="Choose the overall design aesthetic"
          >
            <div className="grid grid-cols-3 gap-4">
              {TEMPLATES.map((template) => (
                <div
                  key={template.id}
                  onClick={() =>
                    setFormData({ ...formData, template: template.id })
                  }
                  className={`${tileBase} relative ${
                    formData.template === template.id
                      ? tileSelected
                      : tileIdle
                  }`}
                >
                  {formData.template === template.id && (
                    <Check
                      className="absolute top-2 right-2 w-5 h-5 text-bs-green"
                      aria-hidden="true"
                    />
                  )}
                  <h3 className="font-semibold text-bs-fg">
                    {template.name}
                  </h3>
                  <p className="text-sm text-bs-fg-muted">
                    {template.description}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Brand Images"
            description="Upload your logo and favicon"
          >
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-bs-fg">Platform Logo</Label>
                <p className="text-sm text-bs-fg-muted">
                  Recommended: PNG/SVG, transparent background
                </p>

                {settings.logoUrl && !logo && (
                  <div className="relative w-48 h-24 border border-bs-border-100 rounded-bs-md overflow-hidden bg-bs-card-2">
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
                    <span className="text-sm text-bs-green flex items-center gap-1">
                      <Check className="w-4 h-4" aria-hidden="true" />
                      New logo selected
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-bs-fg">Favicon</Label>
                <p className="text-sm text-bs-fg-muted">
                  Recommended: 32x32px or 64x64px, PNG/ICO
                </p>

                {settings.faviconUrl && !favicon && (
                  <div className="relative w-16 h-16 border border-bs-border-100 rounded-bs-md overflow-hidden bg-bs-card-2">
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
                    <span className="text-sm text-bs-green flex items-center gap-1">
                      <Check className="w-4 h-4" aria-hidden="true" />
                      New favicon selected
                    </span>
                  )}
                </div>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="ai" className="space-y-6">
          <SectionCard
            title="Automatos AI Integration"
            description="Configure the Super Admin Chatbot powered by Automatos."
          >
            <div className="space-y-4">
              <div>
                <Label htmlFor="automatosApiKey" className="text-bs-fg">
                  Automatos API Key
                </Label>
                <Input
                  id="automatosApiKey"
                  value={formData.automatosApiKey}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      automatosApiKey: e.target.value,
                    })
                  }
                  placeholder="ak_pub_..."
                  autoComplete="off"
                  className="font-mono"
                />
                <p className="mt-1 text-sm text-bs-fg-muted">
                  Ensure you use a Public Key for the website widget.
                </p>
              </div>
              <div>
                <Label htmlFor="automatosAgentId" className="text-bs-fg">
                  Customer Support Agent ID (Optional)
                </Label>
                <Input
                  id="automatosAgentId"
                  type="number"
                  value={formData.automatosAgentId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      automatosAgentId: e.target.value,
                    })
                  }
                  placeholder="e.g. 42"
                  className="font-mono"
                />
              </div>
              <div>
                <Label
                  htmlFor="automatosHelperAgentId"
                  className="text-bs-fg"
                >
                  Store Editor Helper Agent ID (Optional)
                </Label>
                <Input
                  id="automatosHelperAgentId"
                  type="number"
                  value={formData.automatosHelperAgentId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      automatosHelperAgentId: e.target.value,
                    })
                  }
                  placeholder="e.g. 43"
                  className="font-mono"
                />
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="colors" className="space-y-6">
          <SectionCard
            title="Color Palette"
            description="Define your brand colors"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="primaryColor" className="text-bs-fg">
                    Primary Color
                  </Label>
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
                      className="font-mono"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="secondaryColor" className="text-bs-fg">
                    Secondary Color
                  </Label>
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
                      className="font-mono"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="accentColor" className="text-bs-fg">
                    Accent Color
                  </Label>
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
                      className="font-mono"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="backgroundColor" className="text-bs-fg">
                    Background Color
                  </Label>
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
                      className="font-mono"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="textColor" className="text-bs-fg">
                    Text Color
                  </Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="color"
                      id="textColor"
                      value={formData.textColor}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          textColor: e.target.value,
                        })
                      }
                      className="w-20 h-10"
                    />
                    <Input
                      type="text"
                      value={formData.textColor}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          textColor: e.target.value,
                        })
                      }
                      placeholder="#1f2937"
                      className="font-mono"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="headingColor" className="text-bs-fg">
                    Heading Color
                  </Label>
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
                      className="font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Color Preview — user-data display, hex literals intentional per PRD §4.6 */}
              <div
                className="mt-6 p-6 rounded-bs-md border border-bs-border-100"
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
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="typography" className="space-y-6">
          <SectionCard
            title="Font Selection"
            description="Choose fonts for your platform"
          >
            <div className="space-y-6">
              <div>
                <Label className="text-bs-fg">Body Font</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {FONTS.map((font) => (
                    <div
                      key={font.id}
                      onClick={() =>
                        setFormData({ ...formData, fontFamily: font.id })
                      }
                      className={`${tileBase} ${
                        formData.fontFamily === font.id
                          ? tileSelected
                          : tileIdle
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4
                            className="font-semibold text-bs-fg"
                            style={{ fontFamily: font.id }}
                          >
                            {font.name}
                          </h4>
                          <p className="text-sm text-bs-fg-muted">
                            {font.category}
                          </p>
                        </div>
                        {formData.fontFamily === font.id && (
                          <Check
                            className="w-5 h-5 text-bs-green flex-shrink-0"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-bs-fg">Heading Font</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {FONTS.map((font) => (
                    <div
                      key={font.id}
                      onClick={() =>
                        setFormData({
                          ...formData,
                          headingFontFamily: font.id,
                        })
                      }
                      className={`${tileBase} ${
                        formData.headingFontFamily === font.id
                          ? tileSelected
                          : tileIdle
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4
                            className="font-semibold text-bs-fg"
                            style={{ fontFamily: font.id }}
                          >
                            {font.name}
                          </h4>
                          <p className="text-sm text-bs-fg-muted">
                            {font.category}
                          </p>
                        </div>
                        {formData.headingFontFamily === font.id && (
                          <Check
                            className="w-5 h-5 text-bs-green flex-shrink-0"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end mt-8">
        <button
          type="submit"
          disabled={isLoading}
          className="bs-btn bs-btn-green gap-2"
        >
          {isLoading ? (
            <>
              <Loader2
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              Saving...
            </>
          ) : (
            "Save Platform Branding"
          )}
        </button>
      </div>
    </form>
  );
}
