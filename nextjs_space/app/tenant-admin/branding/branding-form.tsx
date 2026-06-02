"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/sonner";
import Script from "next/script";
import {
  Layout,
  FileText,
  Eye,
  Store,
  Monitor,
  Tablet,
  Smartphone,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TenantSettings } from "@/lib/types";
import { tenant_templates } from "@prisma/client";
import { hexToHsl } from "@/lib/color-utils";
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
// EducationTab and AdvancedTab imports removed while those tabs are hidden —
// restore them together with the TabsTrigger/TabsContent blocks when re-enabling.
import type { EditorFormData } from "./tabs/types";
import { buildInitialFormData } from "./branding-form-initial-data";

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
  /** "tenant" (default) loads tenant_templates by id; "marketplace" previews
   *  the base template at templates/{slug} without a tenantTemplateId. */
  previewMode?: "tenant" | "marketplace";
}

export default function BrandingForm({ tenant, activeTemplate, apiEndpoint, publishLabel, previewMode = "tenant" }: BrandingFormProps) {
  const templateCss = (activeTemplate as any)?.templateCss as string | null;
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [logo, setLogo] = useState<File | null>(null);
  const [favicon, setFavicon] = useState<File | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [dirtyColors, setDirtyColors] = useState<Set<string>>(new Set());
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");

  /** Scrollable container that wraps the inline desktop preview. Used by
   *  scrollPreviewToSection to scroll/pulse a section when the user selects
   *  it in the Content accordion. */
  const previewScrollRef = useRef<HTMLDivElement>(null);

  /** Scroll the preview pane to a section and pulse a brief highlight.
   *  Desktop only — tablet/mobile render in an iframe and are skipped.
   *  Respects prefers-reduced-motion. */
  const scrollPreviewToSection = useCallback((sectionId: string) => {
    if (previewDevice !== "desktop") return;
    const container = previewScrollRef.current;
    if (!container) return;
    // Querying with CSS.escape isn't strictly needed for [attr="..."] selectors
    const target = container.querySelector<HTMLElement>(
      `[data-section-id="${sectionId}"]`,
    );
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "start" });

    const reduced = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    // Outline pulse via Web Animations API — no CSS dependency
    try {
      target.animate(
        [
          { outline: "0 solid hsl(var(--tenant-color-accent, 270 60% 50%) / 0.8)", outlineOffset: "-0px" },
          { outline: "4px solid hsl(var(--tenant-color-accent, 270 60% 50%) / 0.7)", outlineOffset: "-4px" },
          { outline: "0 solid hsl(var(--tenant-color-accent, 270 60% 50%) / 0)", outlineOffset: "-0px" },
        ],
        { duration: 1200, easing: "ease-out" },
      );
    } catch {
      // Older browsers without multi-prop Web Animations support — skip silently
    }
  }, [previewDevice]);

  const settings = (tenant.settings as TenantSettings) || {};
  const automatosApiKey = settings?.automatosApiKey;
  const automatosHelperAgentId = settings?.automatosHelperAgentId;

  const [formData, setFormData] = useState<EditorFormData>(() =>
    buildInitialFormData(tenant, activeTemplate),
  );

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
          about: {
            heroTitle: formData.aboutHeroTitle,
            heroSubtitle: formData.aboutHeroSubtitle,
            missionTitle: formData.aboutMissionTitle,
            missionParagraphs: formData.aboutMissionParagraphs
              .split(/\n{2,}/)
              .map((p) => p.trim())
              .filter(Boolean),
          },
          contact: {
            title: formData.contactTitle,
            description: formData.contactDescription,
            email: formData.contactEmail,
            phone: formData.contactPhone,
            address: formData.contactAddress,
          },
          // Mirror into support.* so the /contact route (which reads pageContent.support)
          // renders the stored email/phone without any further template change.
          support: {
            contactEmail: formData.contactEmail,
            contactPhone: formData.contactPhone,
          },
        },
        homeHeroTitle: undefined,
        homeHeroSubtitle: undefined,
        homeHeroCtaText: undefined,
        homeHeroAlignment: undefined,
        homeHeroHeight: undefined,
        homeHeroOverlayStyle: undefined,
        homeHeroOverlayOpacity: undefined,
        aboutHeroTitle: undefined,
        aboutHeroSubtitle: undefined,
        aboutMissionTitle: undefined,
        aboutMissionParagraphs: undefined,
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
      fontSize: { base: formData.fontSize, hero: formData.heroFontSize, section: formData.sectionFontSize },
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
    about: {
      heroTitle: formData.aboutHeroTitle,
      heroSubtitle: formData.aboutHeroSubtitle,
      missionTitle: formData.aboutMissionTitle,
      missionParagraphs: formData.aboutMissionParagraphs
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean),
    },
    contact: {
      title: formData.contactTitle,
      description: formData.contactDescription,
      email: formData.contactEmail,
      phone: formData.contactPhone,
      address: formData.contactAddress,
    },
    support: {
      ...((activeTemplate?.pageContent as any)?.support || {}),
      contactEmail: formData.contactEmail,
      contactPhone: formData.contactPhone,
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
    heroImageUrl: ((activeTemplate as any)?.signedHeroImageUrl)
      || ((activeTemplate as any)?.layout?.defaults?.heroImagePath)
      || undefined,
    logoUrl: logo
      ? URL.createObjectURL(logo)
      : ((activeTemplate as any)?.signedLogoUrl)
      || ((activeTemplate as any)?.layout?.defaults?.logoPath)
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
    <div className="store-editor flex flex-col lg:flex-row gap-2 lg:gap-6 h-[calc(100vh-7rem)] lg:h-[calc(100vh-10rem)] overflow-hidden">
      {/* LEFT: Editor Sidebar */}
      <div
        className={cn(
          "w-full lg:w-[420px] flex-shrink-0 flex flex-col overflow-y-auto pr-2 pb-20 editor-scrollbar",
          showPreview && "hidden lg:flex",
        )}
      >
        <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-6">
          <div className="sticky top-0 bg-bs-canvas/95 backdrop-blur-sm z-20 py-3 lg:py-4 border-b border-bs-border-100 flex items-center justify-between mb-4 lg:mb-6">
            <h2
              className="flex items-center gap-2 text-[22px] leading-tight"
              style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
            >
              <Layout className="w-5 h-5 text-bs-green" aria-hidden="true" />
              Store Editor
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="bs-btn bs-btn-ghost bs-btn-sm lg:hidden h-8 w-8 p-0 flex items-center justify-center"
                onClick={() => setShowPreview(true)}
                aria-label="Show preview"
              >
                <Eye className="h-4 w-4" aria-hidden="true" />
              </button>
              {(() => {
                // Both tenant admins and super admins use the same preview tool.
                // In "marketplace" mode the activeTemplate.id is a row in `templates`,
                // not `tenant_templates`, so we must NOT pass tenantTemplateId — the
                // preview route would 404. Falling through with just the slug loads
                // the base template from templates/{slug} in S3.
                const baseSlug = (activeTemplate as any)?.templates?.slug || tenant.subdomain;
                const previewHref = previewMode === "marketplace" || !activeTemplate?.id
                  ? `/store/preview/${baseSlug}`
                  : `/store/preview/${baseSlug}?tenantTemplateId=${activeTemplate.id}`;
                return (
                  <a
                    href={previewHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bs-btn bs-btn-ghost bs-btn-sm gap-1.5"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    Preview
                  </a>
                );
              })()}
              <button
                type="submit"
                disabled={isLoading}
                className="bs-btn bs-btn-green bs-btn-sm disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    Publishing...
                  </>
                ) : (
                  publishLabel || "Publish Site"
                )}
              </button>
            </div>
          </div>

          <Tabs defaultValue="brand" className="space-y-4 lg:space-y-6">
            <TabsList className="grid w-full h-auto grid-cols-3 gap-1">
              <TabsTrigger value="brand" className="text-xs px-2">
                <Store className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Brand</span>
              </TabsTrigger>
              <TabsTrigger value="layout" className="text-xs px-2">
                <Layout className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Layout</span>
              </TabsTrigger>
              <TabsTrigger value="content" className="text-xs px-2">
                <FileText className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Content</span>
              </TabsTrigger>
              {/* Education and Advanced tabs hidden for now — keeping it
                  simple for early users. Re-enable by restoring the
                  TabsTrigger and TabsContent blocks below. */}
            </TabsList>

            {/* BRAND — identity + global colours + global design tokens + global typography */}
            <TabsContent value="brand" className="space-y-6">
              <BrandTab
                formData={formData}
                setFormData={setFormData}
                logo={logo}
                favicon={favicon}
                onFileChange={handleFileChange}
                logoUrl={((activeTemplate as any)?.signedLogoUrl) || ((activeTemplate as any)?.layout?.defaults?.logoPath) || undefined}
              />
              <ColoursTab
                formData={formData}
                setFormData={setFormData}
                dirtyColors={dirtyColors}
                setDirtyColors={setDirtyColors}
              />
              <DesignTab formData={formData} setFormData={setFormData} />
              <TypeTab formData={formData} setFormData={setFormData} />
            </TabsContent>

            {/* LAYOUT — section list: reorder, add, remove, show/hide. */}
            <TabsContent value="layout" className="space-y-6">
              <LayoutTab formData={formData} setFormData={setFormData} />
            </TabsContent>

            {/* CONTENT — per-section accordion. Each item expands to Content
                and Colour sub-tabs. Selecting a section scrolls and pulses
                the live preview. */}
            <TabsContent value="content" className="space-y-6">
              <ContentTab
                formData={formData}
                setFormData={setFormData}
                onSectionSelect={scrollPreviewToSection}
              />
            </TabsContent>

            {/* Education and Advanced TabsContent hidden — see note above. */}
          </Tabs>
        </form>
      </div>

      {/* RIGHT: Live Preview Pane */}
      <div
        className={cn(
          "flex-1 min-w-0 bg-bs-card-2/40 border border-dashed border-bs-border-100 rounded-bs-md overflow-hidden relative shadow-inner isolate z-0",
          "hidden lg:block",
          showPreview &&
          "!block fixed inset-0 z-50 rounded-none border-0 lg:relative lg:z-0 lg:rounded-bs-md lg:border",
        )}
      >
        {showPreview && (
          <button
            onClick={() => setShowPreview(false)}
            className="lg:hidden absolute top-3 left-3 z-[60] bs-btn bs-btn-ghost bs-btn-sm"
          >
            &larr; Back to Editor
          </button>
        )}
        <div className="absolute top-0 inset-x-0 h-10 bg-bs-card-2/80 backdrop-blur-md border-b border-bs-border-100 flex items-center justify-between px-4 font-mono text-xs text-bs-fg-muted z-50">
          <div className="flex items-center gap-4">
            <div className="flex gap-1.5 mr-4">
              <div className="w-3 h-3 rounded-full bg-red-400/80" />
              <div className="w-3 h-3 rounded-full bg-amber-400/80" />
              <div className="w-3 h-3 rounded-full bg-green-400/80" />
            </div>
            <span>Live Preview &mdash; {formData.businessName || tenant.businessName}</span>
          </div>
          <div className="flex items-center gap-1 bg-bs-canvas/60 rounded-bs-sm p-0.5">
            {([
              { id: "desktop" as const, icon: Monitor, label: "Desktop" },
              { id: "tablet" as const, icon: Tablet, label: "Tablet" },
              { id: "mobile" as const, icon: Smartphone, label: "Mobile" },
            ]).map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setPreviewDevice(d.id)}
                className={cn(
                  "p-1.5 rounded-bs-sm transition-all",
                  previewDevice === d.id
                    ? "bg-bs-green text-bs-canvas"
                    : "text-bs-fg-muted hover:text-bs-fg hover:bg-bs-card-2",
                )}
                title={d.label}
              >
                <d.icon size={14} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>

        {/* Desktop: inline React preview */}
        {previewDevice === "desktop" && (
          <div
            ref={previewScrollRef}
            className="w-full h-full pt-10 overflow-y-auto overflow-x-hidden preview-scrollbar bg-bs-canvas relative"
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
              <div className="flex items-center justify-center h-full text-bs-fg-muted flex-col gap-4">
                <Layout className="w-12 h-12 opacity-20" aria-hidden="true" />
                <p>No valid template layout selected.</p>
              </div>
            )}
          </div>
        )}

        {/* Tablet/Mobile: iframe with real viewport width so media queries fire */}
        {previewDevice !== "desktop" && (() => {
          const baseSlug = (activeTemplate as any)?.templates?.slug || tenant.subdomain;
          if (!activeTemplate?.id) {
            return (
              <div className="flex items-center justify-center h-full text-bs-fg-muted">
                <p>No active template selected.</p>
              </div>
            );
          }
          // Marketplace mode: omit tenantTemplateId — see Preview button comment above.
          const iframeSrc = previewMode === "marketplace"
            ? `/store/preview/${baseSlug}?embed=true&t=${Date.now()}`
            : `/store/preview/${baseSlug}?tenantTemplateId=${activeTemplate.id}&embed=true&t=${Date.now()}`;
          console.log('[branding-form] iframe src:', iframeSrc);
          return (
            <div
              className="flex justify-center bg-slate-100 dark:bg-slate-900 pt-10"
              style={{ height: "100%" }}
            >
              <div
                className="bg-white shadow-2xl overflow-hidden"
                style={{
                  width: previewDevice === "tablet" ? "768px" : "375px",
                  maxWidth: "100%",
                  height: "calc(100% - 2.5rem)",
                  borderRadius: previewDevice === "mobile" ? "0 0 2rem 2rem" : undefined,
                }}
              >
                <iframe
                  key={`${previewDevice}-${activeTemplate.id}`}
                  src={iframeSrc}
                  className="w-full h-full border-0"
                  title={`${previewDevice === "tablet" ? "Tablet" : "Mobile"} preview`}
                />
              </div>
            </div>
          );
        })()}
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
