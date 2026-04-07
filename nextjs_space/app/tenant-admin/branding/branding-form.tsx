"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/sonner";
import Script from "next/script";
import {
  Layout,
  Palette,
  Type,
  FileText,
  Settings,
  Eye,
  Brush,
  GraduationCap,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TenantSettings } from "@/lib/types";
import { tenant_templates } from "@prisma/client";
import { hslToHex, hexToHsl } from "@/lib/color-utils";
import { getTenantUrl } from "@/lib/tenant-utils";
import { TemplateRenderer } from "@/components/template-renderer";
import { TenantThemeProvider } from "@/components/tenant-theme-provider";
import { StoreEditorHelperBot } from "@/components/admin/StoreEditorHelperBot";

// Tab components
import { BrandTab } from "./tabs/brand-tab";
import { LayoutTab } from "./tabs/layout-tab";
import { DesignTab } from "./tabs/design-tab";
import { ColoursTab } from "./tabs/colours-tab";
import { ContentTab } from "./tabs/content-tab";
import { TypeTab } from "./tabs/type-tab";
import { EducationTab } from "./tabs/education-tab";
import { AdvancedTab } from "./tabs/advanced-tab";
import type { EditorFormData } from "./tabs/types";
import { DEFAULT_NAV_LINKS, DEFAULT_FOOTER_SECTIONS } from "@/lib/section-schemas";

// --- Constants ---

const FONTS_MAP: Record<string, boolean> = {
  inter: true, roboto: true, lato: true, montserrat: true,
  poppins: true, playfair: true, outfit: true, nunito: true,
};

const FONT_NAMES: Record<string, string> = {
  inter: "Inter", roboto: "Roboto", lato: "Lato", montserrat: "Montserrat",
  poppins: "Poppins", playfair: "Playfair Display", outfit: "Outfit", nunito: "Nunito",
};

function resolveFontId(cssValue: string | undefined): string | undefined {
  if (!cssValue) return undefined;
  if (!cssValue.includes(",") && !cssValue.includes("'")) {
    return FONTS_MAP[cssValue] ? cssValue : undefined;
  }
  const first = cssValue.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
  const entry = Object.entries(FONT_NAMES).find(
    ([, name]) => name.toLowerCase() === first.toLowerCase(),
  );
  return entry?.[0];
}

function matchOption(value: any, options: string[]): string | undefined {
  if (!value || typeof value !== "string") return undefined;
  return options.includes(value) ? value : undefined;
}

const FONT_SIZES = ["small", "medium", "large"];
const BUTTON_STYLES = ["rounded", "square", "pill"];
const BORDER_RADII = ["none", "small", "medium", "large"];
const SPACINGS = ["compact", "normal", "comfortable"];
const SHADOW_STYLES = ["none", "soft", "medium", "bold"];

// --- Component ---

interface BrandingFormProps {
  tenant: {
    id: string;
    businessName: string;
    subdomain: string;
    customDomain: string | null;
    settings: any;
  };
  activeTemplate?: tenant_templates | null;
  /** Override the API endpoint for saving (e.g. super-admin marketplace editing) */
  apiEndpoint?: string;
  /** Label for the publish button */
  publishLabel?: string;
}

export default function BrandingForm({ tenant, activeTemplate, apiEndpoint, publishLabel }: BrandingFormProps) {
  const templateCss = (activeTemplate as any)?.templateCss as string | null;
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [logo, setLogo] = useState<File | null>(null);
  const [favicon, setFavicon] = useState<File | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [dirtyColors, setDirtyColors] = useState<Set<string>>(new Set());

  const settings = (tenant.settings as TenantSettings) || {};
  const automatosApiKey = settings?.automatosApiKey;
  const automatosHelperAgentId = settings?.automatosHelperAgentId;

  const getVal = (path: string[], fallback: any) => {
    if (activeTemplate?.designSystem) {
      let current: any = activeTemplate.designSystem;
      for (const key of path) {
        if (current?.[key] === undefined) return fallback;
        current = current[key];
      }
      return current;
    }
    return fallback;
  };

  const templateContent = (activeTemplate?.pageContent as any) || {};
  const settingsContent = (settings.pageContent as any) || {};

  // Parse initial layout sections
  const initialSectionConfigs: Record<string, Record<string, any>> = {};
  const initialLayoutSections: any[] = [];
  const initialColorOverrides: Record<string, Record<string, string>> = {};
  if ((activeTemplate as any)?.layout?.sections) {
    ((activeTemplate as any).layout.sections as any[]).forEach((section: any, index: number) => {
      const sectionId = section.id || `section-${index}`;
      initialLayoutSections.push({ ...section, id: sectionId });
      if (section.config) {
        initialSectionConfigs[sectionId] = { ...section.config };
      }
      // Initialize color overrides from stored layout (hex values)
      if (section.colorOverrides) {
        initialColorOverrides[sectionId] = { ...section.colorOverrides };
      }
    });
  }

  const [formData, setFormData] = useState<EditorFormData>({
    sectionConfigs: initialSectionConfigs,
    layoutSections: initialLayoutSections,

    businessName: tenant.businessName,
    tagline: settings.tagline || "",

    primaryColor: hslToHex(getVal(["colors", "primary"], null), settings.primaryColor || "#059669"),
    secondaryColor: hslToHex(getVal(["colors", "secondary"], null), settings.secondaryColor || "#34d399"),
    accentColor: hslToHex(getVal(["colors", "accent"], null), settings.accentColor || "#10b981"),
    backgroundColor: hslToHex(getVal(["colors", "background"], null), settings.backgroundColor || "#ffffff"),
    textColor: hslToHex(getVal(["colors", "text"], null), settings.textColor || "#1f2937"),
    headingColor: hslToHex(getVal(["colors", "heading"], null), settings.headingColor || "#111827"),

    sectionColorOverrides: initialColorOverrides,

    navColorOverrides: (activeTemplate as any)?.layout?.navigationConfig?.colorOverrides || {},
    footerColorOverrides: (activeTemplate as any)?.layout?.footerConfig?.colorOverrides || {},

    fontFamily:
      resolveFontId(getVal(["typography", "fontFamily", "base"], undefined)) ||
      resolveFontId(getVal(["typography", "fontFamily", "body"], undefined)) ||
      settings.fontFamily || "inter",
    headingFontFamily:
      resolveFontId(getVal(["typography", "fontFamily", "heading"], undefined)) ||
      settings.headingFontFamily || settings.fontFamily || "inter",
    fontSize:
      matchOption(getVal(["typography", "fontSize", "base"], undefined), FONT_SIZES) ||
      settings.fontSize || "medium",
    fontWeight: getVal(["typography", "fontWeight", "body"], undefined) || settings.fontWeight || "400",
    headingFontWeight: getVal(["typography", "fontWeight", "heading"], undefined) || settings.headingFontWeight || "700",
    letterSpacingPreset: getVal(["typography", "letterSpacing"], undefined) || settings.letterSpacingPreset || "normal",

    template: settings.template || "modern",
    buttonStyle:
      matchOption(getVal(["borderRadius", "button"], undefined), BUTTON_STYLES) ||
      settings.buttonStyle || "rounded",
    buttonSize: getVal(["button", "size"], undefined) || settings.buttonSize || "medium",
    borderRadius:
      matchOption(getVal(["borderRadius", "container"], undefined), BORDER_RADII) ||
      settings.borderRadius || "medium",
    spacing:
      matchOption(getVal(["spacing", "scale"], undefined), SPACINGS) ||
      settings.spacing || "normal",
    shadowStyle:
      matchOption(getVal(["shadows", "card"], undefined), SHADOW_STYLES) ||
      settings.shadowStyle || "soft",

    glassEffect: getVal(["glassEffect"], undefined) || settings.glassEffect || "none",
    animationType: getVal(["animationType"], undefined) || settings.animationType || "none",
    dividerStyle: getVal(["dividerStyle"], undefined) || settings.dividerStyle || "none",
    buttonHoverEffect: getVal(["buttonHoverEffect"], undefined) || (settings as any).buttonHoverEffect || "none",

    // Navigation & Footer — read from layout.json data on template
    navigationStyle: (activeTemplate as any)?.layout?.navigation || "NavDark",
    navigationConfig: {
      links: (activeTemplate as any)?.layout?.navigationConfig?.links
        || (activeTemplate?.navigation as any)?.links
        || DEFAULT_NAV_LINKS,
      cta: (activeTemplate as any)?.layout?.navigationConfig?.cta
        || (activeTemplate?.navigation as any)?.cta
        || { label: "Check Eligibility", href: "/consultation" },
      cta2: (activeTemplate as any)?.layout?.navigationConfig?.cta2
        || (activeTemplate?.navigation as any)?.cta2
        || undefined,
      showCart: (activeTemplate as any)?.layout?.navigationConfig?.showCart
        ?? (activeTemplate?.navigation as any)?.showCart
        ?? true,
    },
    footerStyle: (activeTemplate as any)?.layout?.footer || "FooterBrand",
    footerConfig: {
      tagline: (activeTemplate as any)?.layout?.footerConfig?.tagline
        || (activeTemplate?.footer as any)?.tagline
        || "",
      sections: (activeTemplate as any)?.layout?.footerConfig?.sections
        || (activeTemplate?.footer as any)?.sections
        || DEFAULT_FOOTER_SECTIONS,
      socialLinks: (activeTemplate as any)?.layout?.footerConfig?.socialLinks
        || (activeTemplate?.footer as any)?.socialLinks
        || [],
      disclaimer: (activeTemplate as any)?.layout?.footerConfig?.disclaimer
        || (activeTemplate?.footer as any)?.disclaimer
        || "",
      address: (activeTemplate as any)?.layout?.footerConfig?.address
        || (activeTemplate?.footer as any)?.address
        || "",
      email: (activeTemplate as any)?.layout?.footerConfig?.email
        || (activeTemplate?.footer as any)?.email
        || "",
    },

    educationHotspots: settingsContent.educationHotspots || [],

    logoPlacement: templateContent.logoPlacement || settingsContent.logoPlacement || {
      navPosition: "left",
      navSize: 52,
      showBusinessName: true,
      heroShowLogo: true,
      heroX: 50,
      heroY: 20,
      heroSize: 80,
      heroStyle: "circular",
      footerShowLogo: true,
    },

    homeHeroTitle: templateContent.home?.heroTitle || templateContent.homeHeroTitle || settingsContent.home?.heroTitle || "Welcome to Your Medical Cannabis Journey",
    homeHeroSubtitle: templateContent.home?.heroSubtitle || templateContent.homeHeroSubtitle || settingsContent.home?.heroSubtitle || "Premium medical cannabis products delivered with care",
    homeHeroCtaText: templateContent.home?.heroCtaText || templateContent.homeHeroCtaText || settingsContent.home?.heroCtaText || "Get Started",
    homeHeroAlignment: templateContent.home?.heroAlignment || settingsContent.home?.heroAlignment || "left",
    homeHeroHeight: templateContent.home?.heroHeight || settingsContent.home?.heroHeight || "large",
    homeHeroOverlayStyle: templateContent.home?.heroOverlayStyle || settingsContent.home?.heroOverlayStyle || "gradient-dark",
    homeHeroOverlayOpacity: templateContent.home?.heroOverlayOpacity ?? settingsContent.home?.heroOverlayOpacity ?? 70,

    aboutTitle: templateContent.about?.title || templateContent.aboutTitle || settingsContent.about?.title || "About Us",
    aboutContent: templateContent.about?.content || templateContent.aboutContent || templateContent.aboutMission || settingsContent.about?.content || "We are dedicated to providing high-quality medical cannabis products...",

    contactTitle: templateContent.contact?.title || settingsContent.contact?.title || "Get in Touch",
    contactDescription: templateContent.contact?.description || settingsContent.contact?.description || "Have questions? We are here to help.",
    contactEmail: templateContent.contact?.email || settingsContent.contact?.email || "",
    contactPhone: templateContent.contact?.phone || settingsContent.contact?.phone || "",
    contactAddress: templateContent.contact?.address || settingsContent.contact?.address || "",

    customCSS: activeTemplate?.customCss || settings.customCSS || "",
  });

  // --- AI Co-Pilot ---
  const handleAutomatosAction = useCallback((actionName: string, payload: any) => {
    try {
      if (actionName === "UPDATE_SECTION_CONFIG") {
        const { sectionId, key, value } = payload;
        if (!sectionId || !key || value === undefined) return;
        setFormData((prev) => ({
          ...prev,
          sectionConfigs: {
            ...prev.sectionConfigs,
            [sectionId]: { ...prev.sectionConfigs[sectionId], [key]: value },
          },
        }));
        toast.success(`AI Co-Pilot updated ${key} in ${sectionId}`);
      }
    } catch (e) {
      console.error("[Automatos] Failed to apply action.", e);
    }
  }, []);

  const aiContext = useMemo(() => ({
    template: formData.template,
    businessName: formData.businessName,
    activeSections: formData.layoutSections.map((s: any) => ({ id: s.id, type: s.type })),
    currentConfigs: formData.sectionConfigs,
  }), [formData.template, formData.businessName, formData.layoutSections, formData.sectionConfigs]);

  // --- Submit ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const formDataToSend = new FormData();
      const { businessName, ...settingsData } = formData;
      formDataToSend.append("businessName", businessName);

      // Send templateId so the API saves to the correct template (not just the active one)
      if (activeTemplate?.id) {
        formDataToSend.append("templateId", activeTemplate.id);
      }

      const colorFields: Record<string, string> = {};
      if (dirtyColors.has("primaryColor")) colorFields.primaryColor = settingsData.primaryColor;
      if (dirtyColors.has("secondaryColor")) colorFields.secondaryColor = settingsData.secondaryColor;
      if (dirtyColors.has("accentColor")) colorFields.accentColor = settingsData.accentColor;
      if (dirtyColors.has("backgroundColor")) colorFields.backgroundColor = settingsData.backgroundColor;
      if (dirtyColors.has("textColor")) colorFields.textColor = settingsData.textColor;
      if (dirtyColors.has("headingColor")) colorFields.headingColor = settingsData.headingColor;

      const {
        primaryColor, secondaryColor, accentColor, backgroundColor, textColor, headingColor,
        sectionColorOverrides,
        ...settingsWithoutColors
      } = settingsData;

      formDataToSend.append("settings", JSON.stringify({
        ...settingsWithoutColors,
        ...colorFields,
        sectionColorOverrides,
        pageContent: {
          educationHotspots: formData.educationHotspots,
          logoPlacement: formData.logoPlacement,
          home: {
            heroTitle: formData.homeHeroTitle,
            heroSubtitle: formData.homeHeroSubtitle,
            heroCtaText: formData.homeHeroCtaText,
            heroAlignment: formData.homeHeroAlignment,
            heroHeight: formData.homeHeroHeight,
            heroOverlayStyle: formData.homeHeroOverlayStyle,
            heroOverlayOpacity: formData.homeHeroOverlayOpacity,
          },
          about: { title: formData.aboutTitle, content: formData.aboutContent },
          contact: {
            title: formData.contactTitle,
            description: formData.contactDescription,
            email: formData.contactEmail,
            phone: formData.contactPhone,
            address: formData.contactAddress,
          },
        },
        homeHeroTitle: undefined,
        homeHeroSubtitle: undefined,
        homeHeroCtaText: undefined,
        homeHeroAlignment: undefined,
        homeHeroHeight: undefined,
        homeHeroOverlayStyle: undefined,
        homeHeroOverlayOpacity: undefined,
        aboutTitle: undefined,
        aboutContent: undefined,
        contactTitle: undefined,
        contactDescription: undefined,
        contactEmail: undefined,
        contactPhone: undefined,
        contactAddress: undefined,
      }));

      if (logo) formDataToSend.append("logo", logo);
      if (favicon) formDataToSend.append("favicon", favicon);

      const res = await fetch(apiEndpoint || `/api/tenant-admin/branding`, { method: "POST", body: formDataToSend });
      if (!res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const errorData = await res.json();
          throw new Error(errorData.message || "Failed to update branding");
        }
        throw new Error(`Server error (${res.status}). Check deploy logs.`);
      }

      toast.success("Branding updated successfully! Changes applied to all pages.");
      router.refresh();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update branding";
      toast.error(errorMessage);
      console.error("Branding update error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (file: File | null, type: "logo" | "favicon") => {
    if (type === "logo") setLogo(file);
    if (type === "favicon") setFavicon(file);
  };

  // --- Live Preview Data ---
  const liveDesignSystem = {
    ...(activeTemplate?.designSystem as any),
    colors: {
      ...((activeTemplate?.designSystem as any)?.colors || {}),
      primary: hexToHsl(formData.primaryColor),
      secondary: hexToHsl(formData.secondaryColor),
      accent: hexToHsl(formData.accentColor),
      background: hexToHsl(formData.backgroundColor),
      text: hexToHsl(formData.textColor),
      heading: hexToHsl(formData.headingColor),
    },
    typography: {
      ...((activeTemplate?.designSystem as any)?.typography || {}),
      fontFamily: {
        base: formData.fontFamily || "inter",
        heading: formData.headingFontFamily || formData.fontFamily || "inter",
      },
      fontSize: { base: formData.fontSize },
      fontWeight: { body: formData.fontWeight, heading: formData.headingFontWeight },
      letterSpacing: formData.letterSpacingPreset,
    },
    borderRadius: {
      ...((activeTemplate?.designSystem as any)?.borderRadius || {}),
      container: formData.borderRadius,
      button: formData.buttonStyle,
    },
    spacing: { ...((activeTemplate?.designSystem as any)?.spacing || {}), scale: formData.spacing },
    button: { ...((activeTemplate?.designSystem as any)?.button || {}), size: formData.buttonSize },
    shadows: { ...((activeTemplate?.designSystem as any)?.shadows || {}), card: formData.shadowStyle },
    glassEffect: formData.glassEffect,
    animationType: formData.animationType,
    dividerStyle: formData.dividerStyle,
    buttonHoverEffect: formData.buttonHoverEffect,
  };

  const livePageContent = {
    ...((activeTemplate?.pageContent as any) || {}),
    educationHotspots: formData.educationHotspots,
    logoPlacement: formData.logoPlacement,
    home: {
      heroTitle: formData.homeHeroTitle,
      heroSubtitle: formData.homeHeroSubtitle,
      heroCtaText: formData.homeHeroCtaText,
      heroAlignment: formData.homeHeroAlignment,
      heroHeight: formData.homeHeroHeight,
      heroOverlayStyle: formData.homeHeroOverlayStyle,
      heroOverlayOpacity: formData.homeHeroOverlayOpacity,
    },
    about: { title: formData.aboutTitle, content: formData.aboutContent },
    contact: {
      title: formData.contactTitle,
      description: formData.contactDescription,
      email: formData.contactEmail,
      phone: formData.contactPhone,
      address: formData.contactAddress,
    },
  };

  const liveSectionProps = {
    tenant: {
      ...tenant,
      subdomain: tenant.subdomain || "preview",
      settings: {
        ...(tenant.settings as any),
        glassEffect: formData.glassEffect,
        animationType: formData.animationType,
        dividerStyle: formData.dividerStyle,
        pageContent: livePageContent,
      },
    } as any,
    consultationUrl: "#",
    productsUrl: "#",
    contactUrl: "#",
    aboutUrl: "#",
    heroImageUrl: ((activeTemplate as any)?.layout?.defaults?.heroImagePath)
      || ((activeTemplate as any)?.signedHeroImageUrl)
      || undefined,
    logoUrl: logo
      ? URL.createObjectURL(logo)
      : ((activeTemplate as any)?.layout?.defaults?.logoPath)
      || ((activeTemplate as any)?.signedLogoUrl)
      || undefined,
    designSystem: liveDesignSystem,
    pageContent: livePageContent,
    customCss: formData.customCSS,
    navigation: formData.navigationConfig,
    footer: formData.footerConfig,
    valueProps: ((activeTemplate?.pageContent as any)?.valueProps) || [],
  };

  // Build live layout with section configs and color overrides baked into sections
  const liveLayout = (activeTemplate as any)?.layout
    ? {
      ...((activeTemplate as any).layout as any),
      navigation: formData.navigationStyle,
      navigationConfig: {
        ...formData.navigationConfig,
        ...(Object.keys(formData.navColorOverrides).length > 0
          ? { colorOverrides: formData.navColorOverrides }
          : {}),
      },
      footer: formData.footerStyle,
      footerConfig: {
        ...formData.footerConfig,
        ...(Object.keys(formData.footerColorOverrides).length > 0
          ? { colorOverrides: formData.footerColorOverrides }
          : {}),
      },
      sections: formData.layoutSections.map((section: any) => {
        const mergedConfig = formData.sectionConfigs[section.id]
          ? { ...section.config, ...formData.sectionConfigs[section.id] }
          : section.config;
        const overrides = formData.sectionColorOverrides[section.id];
        return {
          ...section,
          config: mergedConfig,
          ...(overrides && Object.keys(overrides).length > 0
            ? { colorOverrides: overrides }
            : {}),
        };
      }),
    }
    : null;

  // --- Render ---
  return (
    <div className="flex flex-col lg:flex-row gap-2 lg:gap-6 h-[calc(100vh-7rem)] lg:h-[calc(100vh-10rem)] overflow-hidden">
      {/* LEFT: Editor Sidebar */}
      <div
        className={cn(
          "w-full lg:w-[420px] flex-shrink-0 flex flex-col overflow-y-auto pr-2 pb-20 editor-scrollbar",
          showPreview && "hidden lg:flex",
        )}
      >
        <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-6">
          <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-20 py-3 lg:py-4 border-b flex items-center justify-between mb-4 lg:mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Layout className="w-5 h-5 text-primary" />
              Store Editor
            </h2>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="lg:hidden"
                onClick={() => setShowPreview(true)}
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button type="submit" disabled={isLoading} size="sm">
                {isLoading ? "Publishing..." : (publishLabel || "Publish Site")}
              </Button>
            </div>
          </div>

          <Tabs defaultValue="brand" className="space-y-4 lg:space-y-6">
            <TabsList className="grid w-full h-auto grid-cols-4 grid-rows-2 gap-1">
              <TabsTrigger value="brand" className="text-xs px-2">
                <Store className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Brand</span>
              </TabsTrigger>
              <TabsTrigger value="layout" className="text-xs px-2">
                <Layout className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Layout</span>
              </TabsTrigger>
              <TabsTrigger value="design" className="text-xs px-2">
                <Brush className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Design</span>
              </TabsTrigger>
              <TabsTrigger value="colours" className="text-xs px-2">
                <Palette className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Colours</span>
              </TabsTrigger>
              <TabsTrigger value="content" className="text-xs px-2">
                <FileText className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Content</span>
              </TabsTrigger>
              <TabsTrigger value="type" className="text-xs px-2">
                <Type className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Type</span>
              </TabsTrigger>
              <TabsTrigger value="education" className="text-xs px-2">
                <GraduationCap className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Education</span>
              </TabsTrigger>
              <TabsTrigger value="advanced" className="text-xs px-2">
                <Settings className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Advanced</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="brand">
              <BrandTab
                formData={formData}
                setFormData={setFormData}
                logo={logo}
                favicon={favicon}
                onFileChange={handleFileChange}
                logoUrl={((activeTemplate as any)?.layout?.defaults?.logoPath) || ((activeTemplate as any)?.signedLogoUrl) || undefined}
              />
            </TabsContent>

            <TabsContent value="layout">
              <LayoutTab formData={formData} setFormData={setFormData} />
            </TabsContent>

            <TabsContent value="design">
              <DesignTab formData={formData} setFormData={setFormData} />
            </TabsContent>

            <TabsContent value="colours">
              <ColoursTab
                formData={formData}
                setFormData={setFormData}
                dirtyColors={dirtyColors}
                setDirtyColors={setDirtyColors}
              />
            </TabsContent>

            <TabsContent value="content">
              <ContentTab formData={formData} setFormData={setFormData} />
            </TabsContent>

            <TabsContent value="type">
              <TypeTab formData={formData} setFormData={setFormData} />
            </TabsContent>

            <TabsContent value="education">
              <EducationTab formData={formData} setFormData={setFormData} />
            </TabsContent>

            <TabsContent value="advanced">
              <AdvancedTab
                formData={formData}
                setFormData={setFormData}
                tenant={tenant}
              />
            </TabsContent>
          </Tabs>
        </form>
      </div>

      {/* RIGHT: Live Preview Pane */}
      <div
        className={cn(
          "flex-1 min-w-0 bg-muted/20 border-2 rounded-xl border-dashed overflow-hidden relative shadow-inner isolate z-0",
          "hidden lg:block",
          showPreview &&
          "!block fixed inset-0 z-50 rounded-none border-0 lg:relative lg:z-0 lg:rounded-xl lg:border-2",
        )}
      >
        {showPreview && (
          <button
            onClick={() => setShowPreview(false)}
            className="lg:hidden absolute top-3 left-3 z-[60] bg-background/90 backdrop-blur-sm border rounded-lg px-3 py-1.5 text-sm font-medium shadow-md"
          >
            &larr; Back to Editor
          </button>
        )}
        <div className="absolute top-0 inset-x-0 h-10 bg-muted/80 backdrop-blur-md border-b flex items-center justify-between px-4 font-mono text-xs text-muted-foreground z-50">
          <div className="flex items-center gap-4">
            <div className="flex gap-1.5 mr-4">
              <div className="w-3 h-3 rounded-full bg-red-400/80" />
              <div className="w-3 h-3 rounded-full bg-amber-400/80" />
              <div className="w-3 h-3 rounded-full bg-green-400/80" />
            </div>
            <span>Live Preview &mdash; {formData.businessName || tenant.businessName}</span>
          </div>
        </div>

        <div
          className="w-full max-w-full h-full pt-10 overflow-y-auto overflow-x-hidden preview-scrollbar bg-background relative"
          style={{ transform: "scale(1)" }}
        >
          {automatosApiKey && (
            <div className="absolute top-4 right-4 z-50">
              <StoreEditorHelperBot
                apiKey={automatosApiKey}
                agentId={automatosHelperAgentId ? Number(automatosHelperAgentId) : undefined}
                editorContext={aiContext}
                onAction={handleAutomatosAction}
              />
            </div>
          )}

          {liveLayout ? (
            <TenantThemeProvider
              tenant={tenant as any}
              tenantTemplate={{ designSystem: liveDesignSystem, customCss: formData.customCSS }}
            >
              <TemplateRenderer
                layout={liveLayout as any}
                sectionProps={liveSectionProps}
                customCss={[templateCss, formData.customCSS].filter(Boolean).join("\n")}
                renderChrome={true}
              />
            </TenantThemeProvider>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground flex-col gap-4">
              <Layout className="w-12 h-12 opacity-20" />
              <p>No valid template layout selected.</p>
            </div>
          )}
        </div>
      </div>

      {/* 🚀 PageAgent Demo Integration */}
      <Script
        src="https://cdn.jsdelivr.net/npm/page-agent@1.5.7/dist/iife/page-agent.demo.js"
        strategy="lazyOnload"
        crossOrigin="anonymous"
      />
    </div>
  );
}
