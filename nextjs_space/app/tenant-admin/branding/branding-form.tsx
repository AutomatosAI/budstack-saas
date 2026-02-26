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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/sonner";
import {
  Upload,
  Check,
  Palette,
  Type,
  Layout,
  FileText,
  Settings,
  Image as ImageIcon,
  GripVertical,
  Trash2,
  Plus,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SECTION_REGISTRY } from "@/lib/section-registry";

// When a new section is added from the modal, it needs default config properties 
// to ensure the left-sidebar form fields generate correctly. 
const SECTION_DEFAULTS: Record<string, Record<string, any>> = {
  HeroFullScreen: { heading: "Welcome", subtitle: "A full screen hero", ctaText: "Start", imageUrl: "" },
  HeroSplit: { heading: "New Split Hero", subtitle: "Describe it here", ctaText: "Click Me", imageUrl: "" },
  HeroVideo: { heading: "Video Hero", subtitle: "Watch this", videoUrl: "" },
  HeroMinimal: { heading: "Clean & Simple", subtitle: "Minimalist hero block" },
  ValueProps: { title: "Why Choose Us" }, // Does not support array editing yet
  ProductShowcase: { heading: "Our Products", subtitle: "Explore our range" },
  Testimonials: { heading: "What They Say", subtitle: "Customer feedback" },
  About: { heading: "About Us", content: "Our story", imageUrl: "" },
  Gallery: { heading: "Gallery", subtitle: "See our work" },
  Stats: { heading: "By The Numbers" },
  FAQ: { heading: "Frequently Asked Questions", subtitle: "Find answers here" },
  BlogFeed: { heading: "Latest News", subtitle: "Read our blog" },
  Features: { heading: "Features", subtitle: "What we offer", imageUrl: "" },
  ImageShowcase: { heading: "Showcase", subtitle: "Highlight an image", imageUrl: "" },
  CTABanner: { heading: "Ready?", subtitle: "Let's go", ctaText: "Start" },
  CTAWithImage: { heading: "Join Us", subtitle: "Don't wait", ctaText: "Sign Up", imageUrl: "" },
  CTASplit: { heading: "Contact Us", subtitle: "We are here help", ctaText: "Email" },
};
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
import { TenantSettings } from "@/lib/types";
import { tenant_templates } from "@prisma/client";
import { hslToHex, hexToHsl } from "@/lib/color-utils";
import { getTenantUrl } from "@/lib/tenant-utils";
import { TemplateRenderer } from "@/components/template-renderer";
import { TenantThemeProvider } from "@/components/tenant-theme-provider";

function SortableSectionItem({ id, section, onRemove }: { id: string; section: any; onRemove: (id: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center justify-between p-3 mb-2 bg-white border rounded-md shadow-sm">
      <div className="flex items-center gap-3">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-100 rounded">
          <GripVertical className="h-4 w-4 text-gray-400" />
        </div>
        <span className="font-medium text-sm capitalize flex items-center">
          {section.type.replace(/([A-Z])/g, ' $1').trim()}
          <span className="text-muted-foreground font-normal ml-2 text-xs">
            {section.id.length > 8 ? `...${section.id.slice(-6)}` : section.id}
          </span>
        </span>
      </div>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => onRemove(id)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface BrandingFormProps {
  tenant: {
    id: string;
    businessName: string;
    subdomain: string;
    customDomain: string | null;
    settings: any;
  };
  activeTemplate?: tenant_templates | null;
}

const FONTS = [
  { id: "inter", name: "Inter", description: "Modern sans-serif" },
  { id: "roboto", name: "Roboto", description: "Classic sans-serif" },
  { id: "lato", name: "Lato", description: "Friendly sans-serif" },
  { id: "montserrat", name: "Montserrat", description: "Geometric sans-serif" },
  { id: "poppins", name: "Poppins", description: "Rounded sans-serif" },
  { id: "playfair", name: "Playfair Display", description: "Elegant serif" },
  { id: "outfit", name: "Outfit", description: "Modern geometric sans-serif" },
  { id: "nunito", name: "Nunito", description: "Rounded friendly sans-serif" },
];

/** Extract the primary font name from a CSS font-family string and return the matching FONTS id.
 *  e.g. "'Outfit', -apple-system, ..." → "outfit"
 */
function resolveFontId(cssValue: string | undefined): string | undefined {
  if (!cssValue) return undefined;
  // Already a short id (no quotes, no commas)
  if (!cssValue.includes(",") && !cssValue.includes("'")) {
    return FONTS.find((f) => f.id === cssValue) ? cssValue : undefined;
  }
  // Extract first font name from CSS string
  const first = cssValue.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
  return FONTS.find((f) => f.name.toLowerCase() === first.toLowerCase())?.id;
}

/** Check if a value matches one of the allowed Select option values.
 *  Returns the value if it matches, undefined otherwise.
 */
function matchOption(value: any, options: string[]): string | undefined {
  if (!value || typeof value !== "string") return undefined;
  return options.includes(value) ? value : undefined;
}

// Valid dropdown values for layout fields
const FONT_SIZES = ["small", "medium", "large"];
const BUTTON_STYLES = ["rounded", "square", "pill"];
const BORDER_RADII = ["none", "small", "medium", "large"];
const SPACINGS = ["compact", "normal", "comfortable"];
const SHADOW_STYLES = ["none", "soft", "medium", "bold"];

function SectionImageUploader({
  value,
  onChange
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/tenant-admin/branding/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      if (data.url) onChange(data.url);
    } catch (err) {
      toast.error("Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mt-1 flex gap-2 items-center">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://..."
        className="flex-1"
      />
      <div className="relative border rounded-md p-1.5 flex h-10 w-10 items-center justify-center bg-muted/50 hover:bg-muted cursor-pointer shrink-0 transition-colors">
        <input
          type="file"
          accept="image/*"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={handleUpload}
          disabled={isUploading}
        />
        {isUploading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
      </div>
    </div>
  );
}

export default function BrandingForm({
  tenant,
  activeTemplate,
}: BrandingFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [logo, setLogo] = useState<File | null>(null);
  const [heroImage, setHeroImage] = useState<File | null>(null);
  const [favicon, setFavicon] = useState<File | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isAddSectionOpen, setIsAddSectionOpen] = useState(false);

  const settings = (tenant.settings as TenantSettings) || {};

  // Helper to get value from template designSystem OR legacy settings
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

  // Track which color fields the user explicitly modified
  // Only modified colors get sent to the API — prevents overwriting template theme with form defaults
  const [dirtyColors, setDirtyColors] = useState<Set<string>>(new Set());

  // dynamically parse the initial section configs from the layout
  const initialSectionConfigs: Record<string, Record<string, any>> = {};
  const initialLayoutSections: any[] = [];
  if ((activeTemplate as any)?.layout && ((activeTemplate as any).layout as any).sections) {
    ((activeTemplate as any).layout as any).sections.forEach((section: any, index: number) => {
      const sectionId = section.id || `section-${index}`;
      initialLayoutSections.push({ ...section, id: sectionId });
      if (section.config) {
        initialSectionConfigs[sectionId] = { ...section.config };
      }
    });
  }

  const [formData, setFormData] = useState({
    // Dynamic Section Configuration
    sectionConfigs: initialSectionConfigs,
    layoutSections: initialLayoutSections,

    // Business
    businessName: tenant.businessName,
    tagline: settings.tagline || "",

    // Colors — convert HSL channels from designSystem to hex for <input type="color">
    primaryColor: hslToHex(
      getVal(["colors", "primary"], null),
      settings.primaryColor || "#059669",
    ),
    secondaryColor: hslToHex(
      getVal(["colors", "secondary"], null),
      settings.secondaryColor || "#34d399",
    ),
    accentColor: hslToHex(
      getVal(["colors", "accent"], null),
      settings.accentColor || "#10b981",
    ),
    backgroundColor: hslToHex(
      getVal(["colors", "background"], null),
      settings.backgroundColor || "#ffffff",
    ),
    textColor: hslToHex(
      getVal(["colors", "text"], null),
      settings.textColor || "#1f2937",
    ),
    headingColor: hslToHex(
      getVal(["colors", "heading"], null),
      settings.headingColor || "#111827",
    ),

    // Typography — resolve CSS font-family strings to dropdown IDs
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

    // Layout — designSystem may have full tokens (sm/md/lg) or dropdown IDs; validate before using
    template: settings.template || "modern",
    buttonStyle:
      matchOption(getVal(["borderRadius", "button"], undefined), BUTTON_STYLES) ||
      settings.buttonStyle || "rounded",
    buttonSize: settings.buttonSize || "medium",
    borderRadius:
      matchOption(getVal(["borderRadius", "container"], undefined), BORDER_RADII) ||
      settings.borderRadius || "medium",
    spacing:
      matchOption(getVal(["spacing", "scale"], undefined), SPACINGS) ||
      settings.spacing || "normal",
    shadowStyle:
      matchOption(getVal(["shadows", "card"], undefined), SHADOW_STYLES) ||
      settings.shadowStyle || "soft",

    // Premium Styling Features
    glassEffect: settings.glassEffect || "none",
    animationType: settings.animationType || "none",
    dividerStyle: settings.dividerStyle || "none",

    // Hero Customization
    heroType: settings.heroType || "gradient-image",

    // Interactive
    educationHotspots: settingsContent.educationHotspots || [],

    // Page Content - Home (supports nested home.heroTitle AND flat homeHeroTitle from defaults.json)
    homeHeroTitle:
      templateContent.home?.heroTitle ||
      templateContent.homeHeroTitle ||
      settingsContent.home?.heroTitle ||
      "Welcome to Your Medical Cannabis Journey",
    homeHeroSubtitle:
      templateContent.home?.heroSubtitle ||
      templateContent.homeHeroSubtitle ||
      settingsContent.home?.heroSubtitle ||
      "Premium medical cannabis products delivered with care",
    homeHeroCtaText:
      templateContent.home?.heroCtaText ||
      templateContent.homeHeroCtaText ||
      settingsContent.home?.heroCtaText ||
      "Get Started",
    homeHeroAlignment: templateContent.home?.heroAlignment || settingsContent.home?.heroAlignment || "left",
    homeHeroHeight: templateContent.home?.heroHeight || settingsContent.home?.heroHeight || "large",
    homeHeroOverlayStyle: templateContent.home?.heroOverlayStyle || settingsContent.home?.heroOverlayStyle || "gradient-dark",
    homeHeroOverlayOpacity: templateContent.home?.heroOverlayOpacity ?? settingsContent.home?.heroOverlayOpacity ?? 70,

    // Page Content - About
    aboutTitle:
      templateContent.about?.title ||
      templateContent.aboutTitle ||
      settingsContent.about?.title ||
      "About Us",
    aboutContent:
      templateContent.about?.content ||
      templateContent.aboutContent ||
      templateContent.aboutMission ||
      settingsContent.about?.content ||
      "We are dedicated to providing high-quality medical cannabis products...",

    // Page Content - Contact
    contactTitle:
      templateContent.contact?.title ||
      settingsContent.contact?.title ||
      "Get in Touch",
    contactDescription:
      templateContent.contact?.description ||
      settingsContent.contact?.description ||
      "Have questions? We are here to help.",
    contactEmail:
      templateContent.contact?.email || settingsContent.contact?.email || "",
    contactPhone:
      templateContent.contact?.phone || settingsContent.contact?.phone || "",
    contactAddress:
      templateContent.contact?.address ||
      settingsContent.contact?.address ||
      "",

    // Advanced
    customCSS: activeTemplate?.customCss || settings.customCSS || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formDataToSend = new FormData();

      // Extract business name
      const { businessName, ...settings } = formData;

      // Append business name
      formDataToSend.append("businessName", businessName);

      // Only include colors that the user explicitly changed (prevents overwriting template theme with defaults)
      const colorFields: Record<string, string> = {};
      if (dirtyColors.has("primaryColor")) colorFields.primaryColor = settings.primaryColor;
      if (dirtyColors.has("secondaryColor")) colorFields.secondaryColor = settings.secondaryColor;
      if (dirtyColors.has("accentColor")) colorFields.accentColor = settings.accentColor;
      if (dirtyColors.has("backgroundColor")) colorFields.backgroundColor = settings.backgroundColor;
      if (dirtyColors.has("textColor")) colorFields.textColor = settings.textColor;
      if (dirtyColors.has("headingColor")) colorFields.headingColor = settings.headingColor;

      // Strip unmodified color fields from settings to prevent overwriting template CSS vars
      const { primaryColor, secondaryColor, accentColor, backgroundColor, textColor, headingColor, ...settingsWithoutColors } = settings;

      // Append settings as JSON string
      formDataToSend.append(
        "settings",
        JSON.stringify({
          ...settingsWithoutColors,
          ...colorFields,
          pageContent: {
            educationHotspots: formData.educationHotspots,
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
              title: formData.aboutTitle,
              content: formData.aboutContent,
            },
            contact: {
              title: formData.contactTitle,
              description: formData.contactDescription,
              email: formData.contactEmail,
              phone: formData.contactPhone,
              address: formData.contactAddress,
            },
          },
          // Remove the flattened page content fields from root level
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
        }),
      );

      // Append files
      if (logo) formDataToSend.append("logo", logo);
      if (heroImage) formDataToSend.append("heroImage", heroImage);
      if (favicon) formDataToSend.append("favicon", favicon);

      const res = await fetch(`/api/tenant-admin/branding`, {
        method: "POST",
        body: formDataToSend,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to update branding");
      }

      toast.success(
        "✅ Branding updated successfully! Changes applied to all pages.",
      );
      router.refresh();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update branding";
      toast.error(errorMessage);
      console.error("Branding update error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (
    file: File | null,
    type: "logo" | "heroImage" | "favicon",
  ) => {
    if (type === "logo") setLogo(file);
    if (type === "heroImage") setHeroImage(file);
    if (type === "favicon") setFavicon(file);
  };

  // Construct instantaneous Live Preview data without waiting for the database
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
    },
    borderRadius: {
      ...((activeTemplate?.designSystem as any)?.borderRadius || {}),
      container: formData.borderRadius,
      button: formData.buttonStyle,
    },
    spacing: {
      ...((activeTemplate?.designSystem as any)?.spacing || {}),
      scale: formData.spacing,
    },
    button: {
      ...((activeTemplate?.designSystem as any)?.button || {}),
      size: formData.buttonSize,
    },
    shadows: {
      ...((activeTemplate?.designSystem as any)?.shadows || {}),
      card: formData.shadowStyle,
    },
    // Adding premium CSS root settings
    glassEffect: formData.glassEffect,
    animationType: formData.animationType,
    dividerStyle: formData.dividerStyle,
  };

  const livePageContent = {
    ...((activeTemplate?.pageContent as any) || {}),
    educationHotspots: formData.educationHotspots,
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
      title: formData.aboutTitle,
      content: formData.aboutContent,
    },
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
        pageContent: livePageContent, // For interactive components that might read tenant.settings.pageContent
      }
    } as any,
    consultationUrl: "#",
    productsUrl: "#",
    contactUrl: "#",
    aboutUrl: "#",
    heroImageUrl: heroImage ? URL.createObjectURL(heroImage) : ((activeTemplate as any)?.layout?.defaults?.heroImagePath) || undefined,
    logoUrl: logo ? URL.createObjectURL(logo) : ((activeTemplate as any)?.layout?.defaults?.logoPath) || undefined,
    designSystem: liveDesignSystem,
    pageContent: livePageContent,
    customCss: formData.customCSS,
    // Provide standard layout settings as fallback
    navigation: "NavDark",
    footer: "FooterBrand",
    valueProps: ((activeTemplate?.pageContent as any)?.valueProps) || [],
  };

  // Combine layout with the live edited sectionConfigs and drag-and-drop array order
  const liveLayout = (activeTemplate as any)?.layout ? {
    ...((activeTemplate as any).layout as any),
    navigation: ((activeTemplate as any).layout as any).navigation || "NavDark",
    footer: ((activeTemplate as any).layout as any).footer || "FooterSimple",
    sections: formData.layoutSections.map((section: any) => {
      if (formData.sectionConfigs[section.id]) {
        return {
          ...section,
          config: { ...section.config, ...formData.sectionConfigs[section.id] }
        };
      }
      return section;
    })
  } : null;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
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
        const oldIndex = prev.layoutSections.findIndex((s) => s.id === active.id);
        const newIndex = prev.layoutSections.findIndex((s) => s.id === over.id);

        return {
          ...prev,
          layoutSections: arrayMove(prev.layoutSections, oldIndex, newIndex),
        };
      });
    }
  }

  function handleAddSection(type: string) {
    const newSection = {
      id: `${type.toLowerCase()}-${Date.now().toString(36)}`,
      type: type,
      config: SECTION_DEFAULTS[type] || { heading: "New Section", subtitle: "Edit me" }
    };
    setFormData((prev) => ({
      ...prev,
      layoutSections: [...prev.layoutSections, newSection],
      sectionConfigs: {
        ...prev.sectionConfigs,
        [newSection.id]: { ...newSection.config }
      }
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
    <div className="flex flex-col xl:flex-row gap-6 h-[calc(100vh-10rem)] overflow-hidden">
      {/* LEFT: Editor Sidebar */}
      <div className="w-full xl:w-[450px] flex-shrink-0 flex flex-col overflow-y-auto pr-2 pb-20 editor-scrollbar">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-20 py-4 border-b flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Layout className="w-5 h-5 text-primary" />
              Store Editor
            </h2>
            <Button
              type="submit"
              disabled={isLoading}
              size="sm"
            >
              {isLoading ? "Publishing..." : "Publish Site"}
            </Button>
          </div>

          <Tabs defaultValue="design" className="space-y-6">
            <TabsList className="grid w-full h-auto grid-cols-3 gap-2 sm:grid-cols-3 md:gap-2">
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
                Type
              </TabsTrigger>
              <TabsTrigger value="layout">
                <Settings className="w-4 h-4 mr-2" />
                Layout
              </TabsTrigger>
              <TabsTrigger value="content">
                <FileText className="w-4 h-4 mr-2" />
                Content
              </TabsTrigger>
              <TabsTrigger value="education">
                <FileText className="w-4 h-4 mr-2" />
                Education
              </TabsTrigger>
              <TabsTrigger value="advanced">
                <Settings className="w-4 h-4 mr-2" />
                Advanced
              </TabsTrigger>
            </TabsList>

            {/* DESIGN TAB */}
            <TabsContent value="design" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Business Information</CardTitle>
                  <CardDescription>Your store's identity</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="businessName">Business Name *</Label>
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
                    Upload your logo, hero image, and favicon
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FileUpload
                    label="Logo"
                    description="Recommended: PNG/SVG, transparent background"
                    accept="image/*"
                    onChange={(file) => handleFileChange(file, "logo")}
                    file={logo}
                  />

                  <div>
                    <Label>Hero Section Type</Label>
                    <Select
                      value={formData.heroType}
                      onValueChange={(value) =>
                        setFormData({ ...formData, heroType: value as any })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gradient">
                          Gradient Background
                        </SelectItem>
                        <SelectItem value="gradient-image">
                          Gradient Image Background
                        </SelectItem>
                        <SelectItem value="image">Image Background</SelectItem>
                        <SelectItem value="video">Video Background</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(formData.heroType === "image" || formData.heroType === "gradient-image") && (
                    <FileUpload
                      label="Hero Image"
                      description="Recommended: 1920x1080px, JPG/PNG"
                      accept="image/*"
                      onChange={(file) => handleFileChange(file, "heroImage")}
                      file={heroImage}
                    />
                  )}

                  <FileUpload
                    label="Favicon"
                    description="Recommended: 32x32px or 64x64px, PNG/ICO"
                    accept="image/*"
                    onChange={(file) => handleFileChange(file, "favicon")}
                    file={favicon}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Premium Design Features</CardTitle>
                  <CardDescription>Custom animations and modern effects</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="glassEffect">Component Style (Glassmorphism)</Label>
                      <Select
                        value={formData.glassEffect}
                        onValueChange={(value) =>
                          setFormData({ ...formData, glassEffect: value as any })
                        }
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
                      <p className="text-xs text-muted-foreground mt-1">Applies a premium blur effect to cards and navigation.</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="animationType">Scroll Animations</Label>
                      <Select
                        value={formData.animationType}
                        onValueChange={(value) =>
                          setFormData({ ...formData, animationType: value as any })
                        }
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
                      <p className="text-xs text-muted-foreground mt-1">How sections reveal themselves as you scroll down.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dividerStyle">Section Dividers</Label>
                      <Select
                        value={formData.dividerStyle}
                        onValueChange={(value) =>
                          setFormData({ ...formData, dividerStyle: value as any })
                        }
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
                      <p className="text-xs text-muted-foreground mt-1">Replaces straight horizontal lines between page sections with organic SVG shapes.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Advanced Hero Configuration</CardTitle>
                  <CardDescription>Customize your homepage Hero section specifically</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="homeHeroAlignment">Alignment</Label>
                      <Select
                        value={formData.homeHeroAlignment}
                        onValueChange={(value) =>
                          setFormData({ ...formData, homeHeroAlignment: value as any })
                        }
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
                      <Label htmlFor="homeHeroHeight">Section Height</Label>
                      <Select
                        value={formData.homeHeroHeight}
                        onValueChange={(value) =>
                          setFormData({ ...formData, homeHeroHeight: value as any })
                        }
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
                      <Label htmlFor="homeHeroOverlayStyle">Image Overlay Style</Label>
                      <Select
                        value={formData.homeHeroOverlayStyle}
                        onValueChange={(value) =>
                          setFormData({ ...formData, homeHeroOverlayStyle: value as any })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Overlay (Image Only)</SelectItem>
                          <SelectItem value="dark">Solid Dark Scrim</SelectItem>
                          <SelectItem value="gradient-dark">Dark Gradient (Fade Up)</SelectItem>
                          <SelectItem value="gradient-primary">Primary Brand Gradient</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="homeHeroOverlayOpacity">Overlay Opacity (%)</Label>
                      <Input
                        id="homeHeroOverlayOpacity"
                        type="number"
                        min="0"
                        max="100"
                        value={formData.homeHeroOverlayOpacity}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            homeHeroOverlayOpacity: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* COLORS TAB */}
            <TabsContent value="colors" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Brand Colors</CardTitle>
                  <CardDescription>
                    Define your color palette (applies to ALL pages)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    <ColorPicker
                      label="Primary Color"
                      description="Main brand color (buttons, headers)"
                      value={formData.primaryColor}
                      onChange={(value) => {
                        setFormData({ ...formData, primaryColor: value });
                        setDirtyColors((prev) => new Set(prev).add("primaryColor"));
                      }}
                    />
                    <ColorPicker
                      label="Secondary Color"
                      description="Secondary elements, links"
                      value={formData.secondaryColor}
                      onChange={(value) => {
                        setFormData({ ...formData, secondaryColor: value });
                        setDirtyColors((prev) => new Set(prev).add("secondaryColor"));
                      }}
                    />
                    <ColorPicker
                      label="Accent Color"
                      description="Call-to-action highlights"
                      value={formData.accentColor}
                      onChange={(value) => {
                        setFormData({ ...formData, accentColor: value });
                        setDirtyColors((prev) => new Set(prev).add("accentColor"));
                      }}
                    />
                    <ColorPicker
                      label="Background Color"
                      description="Page background"
                      value={formData.backgroundColor}
                      onChange={(value) => {
                        setFormData({ ...formData, backgroundColor: value });
                        setDirtyColors((prev) => new Set(prev).add("backgroundColor"));
                      }}
                    />
                    <ColorPicker
                      label="Text Color"
                      description="Body text"
                      value={formData.textColor}
                      onChange={(value) => {
                        setFormData({ ...formData, textColor: value });
                        setDirtyColors((prev) => new Set(prev).add("textColor"));
                      }}
                    />
                    <ColorPicker
                      label="Heading Color"
                      description="Heading text"
                      value={formData.headingColor}
                      onChange={(value) => {
                        setFormData({ ...formData, headingColor: value });
                        setDirtyColors((prev) => new Set(prev).add("headingColor"));
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TYPOGRAPHY TAB */}
            <TabsContent value="typography" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Typography</CardTitle>
                  <CardDescription>
                    Font styles (applies to ALL pages)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label>Body Font</Label>
                    <Select
                      value={formData.fontFamily}
                      onValueChange={(value) =>
                        setFormData({ ...formData, fontFamily: value as any })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FONTS.map((font) => (
                          <SelectItem key={font.id} value={font.id}>
                            <div>
                              <div className="font-semibold">{font.name}</div>
                              <div className="text-xs text-gray-500">
                                {font.description}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Heading Font</Label>
                    <Select
                      value={formData.headingFontFamily}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          headingFontFamily: value as any,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="same">Same as body</SelectItem>
                        {FONTS.map((font) => (
                          <SelectItem key={font.id} value={font.id}>
                            <div>
                              <div className="font-semibold">{font.name}</div>
                              <div className="text-xs text-gray-500">
                                {font.description}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Font Size</Label>
                    <Select
                      value={formData.fontSize}
                      onValueChange={(value) =>
                        setFormData({ ...formData, fontSize: value as any })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small (14px)</SelectItem>
                        <SelectItem value="medium">Medium (16px)</SelectItem>
                        <SelectItem value="large">Large (18px)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* LAYOUT TAB */}
            <TabsContent value="layout" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Section Ordering</CardTitle>
                  <CardDescription>Drag and drop to reorder sections. Use the trash icon to remove a section.</CardDescription>
                </CardHeader>
                <CardContent>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragCancel={handleDragCancel}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext items={formData.layoutSections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                      {formData.layoutSections.map((section) => (
                        <SortableSectionItem key={section.id} id={section.id} section={section} onRemove={handleRemoveSection} />
                      ))}
                    </SortableContext>
                    <DragOverlay>
                      {activeId ? (
                        <SortableSectionItem
                          id={activeId}
                          section={formData.layoutSections.find((s) => s.id === activeId)}
                          onRemove={() => { }}
                        />
                      ) : null}
                    </DragOverlay>
                  </DndContext>

                  <div className="mt-4 pt-4 border-t">
                    <Dialog open={isAddSectionOpen} onOpenChange={setIsAddSectionOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full border-dashed">
                          <Plus className="h-4 w-4 mr-2" /> Add Section
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Component Library</DialogTitle>
                          <DialogDescription>
                            Select a new section to add it to your layout.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                          {Object.keys(SECTION_REGISTRY).map((type) => (
                            <Button
                              key={type}
                              variant="outline"
                              className="h-auto py-6 flex flex-col justify-center items-center gap-2 hover:bg-slate-50 transition-colors"
                              onClick={() => handleAddSection(type)}
                            >
                              <div className="font-semibold">{type.replace(/([A-Z])/g, ' $1').trim()}</div>
                              <div className="text-xs text-muted-foreground opacity-60 font-mono">{type}</div>
                            </Button>
                          ))}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>

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
                      onValueChange={(value) =>
                        setFormData({ ...formData, buttonStyle: value as any })
                      }
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
                      onValueChange={(value) =>
                        setFormData({ ...formData, buttonSize: value as any })
                      }
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
                      onValueChange={(value) =>
                        setFormData({ ...formData, borderRadius: value as any })
                      }
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
                      onValueChange={(value) =>
                        setFormData({ ...formData, spacing: value as any })
                      }
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
                      onValueChange={(value) =>
                        setFormData({ ...formData, shadowStyle: value as any })
                      }
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
            </TabsContent>

            {/* DYNAMIC CONTENT TAB */}
            <TabsContent value="content" className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-blue-900 mb-2">
                  ℹ️ Live Store Editor
                </h4>
                <p className="text-sm text-blue-800">
                  The fields below are dynamically generated based on your selected template's layout.
                  Editing them here will instantly update the preview on the right.
                </p>
              </div>

              {formData.layoutSections.map((section: any) => {
                // Skip sections without a config or ID
                if (!section.id || !section.config) return null;

                const configValues = formData.sectionConfigs[section.id] || {};

                return (
                  <Card key={section.id}>
                    <CardHeader>
                      <CardTitle className="capitalize">
                        {section.type.replace(/([A-Z])/g, ' $1').trim()}
                        <span className="text-muted-foreground text-sm font-normal ml-2">
                          (#{section.id})
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {Object.entries(configValues).map(([key, value]) => {
                        // Only render generic string fields for now (exclude arrays/objects directly)
                        if (typeof value !== 'string') return null;

                        // Determine if it should be a textarea (longer content)
                        const isLongText = key.toLowerCase().includes('content') ||
                          key.toLowerCase().includes('description') ||
                          key.toLowerCase().includes('subtitle');

                        // Determine if it looks like an image URL
                        const isImage = key.toLowerCase().includes('image') ||
                          key.toLowerCase().includes('logo') ||
                          key.toLowerCase().includes('icon');

                        return (
                          <div key={`${section.id}-${key}`}>
                            <Label className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</Label>

                            {isImage ? (
                              <SectionImageUploader
                                value={value as string}
                                onChange={(url) => {
                                  setFormData({
                                    ...formData,
                                    sectionConfigs: {
                                      ...formData.sectionConfigs,
                                      [section.id]: {
                                        ...formData.sectionConfigs[section.id],
                                        [key]: url
                                      }
                                    }
                                  });
                                }}
                              />
                            ) : isLongText ? (
                              <Textarea
                                value={value as string}
                                onChange={(e) => {
                                  setFormData({
                                    ...formData,
                                    sectionConfigs: {
                                      ...formData.sectionConfigs,
                                      [section.id]: {
                                        ...formData.sectionConfigs[section.id],
                                        [key]: e.target.value
                                      }
                                    }
                                  });
                                }}
                                rows={3}
                                className="mt-1"
                              />
                            ) : (
                              <Input
                                value={value as string}
                                onChange={(e) => {
                                  setFormData({
                                    ...formData,
                                    sectionConfigs: {
                                      ...formData.sectionConfigs,
                                      [section.id]: {
                                        ...formData.sectionConfigs[section.id],
                                        [key]: e.target.value
                                      }
                                    }
                                  });
                                }}
                                className="mt-1"
                              />
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>

            {/* EDUCATION TAB - Interactive Hotspots */}
            <TabsContent value="education" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Interactive Education Content</CardTitle>
                  <CardDescription>Add interactive hotspots to imagery across the site.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex justify-between items-center">
                    <Label>Image Hotspots</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          educationHotspots: [
                            ...formData.educationHotspots,
                            {
                              id: Date.now().toString(),
                              targetSectionId: "all",
                              title: "New Hotspot",
                              description: "",
                              x: 50,
                              y: 50,
                            },
                          ],
                        })
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
                      {formData.educationHotspots.map((hotspot: any, index: number) => (
                        <div key={hotspot.id} className="p-4 border rounded-lg space-y-4 relative bg-card">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              const newHotspots = [...formData.educationHotspots];
                              newHotspots.splice(index, 1);
                              setFormData({ ...formData, educationHotspots: newHotspots });
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
                                  const newHotspots = [...formData.educationHotspots];
                                  newHotspots[index].title = e.target.value;
                                  setFormData({ ...formData, educationHotspots: newHotspots });
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Target Section</Label>
                              <Select
                                value={hotspot.targetSectionId || "all"}
                                onValueChange={(value) => {
                                  const newHotspots = [...formData.educationHotspots];
                                  newHotspots[index].targetSectionId = value;
                                  setFormData({ ...formData, educationHotspots: newHotspots });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="All Sections" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All Sections (Global)</SelectItem>
                                  {formData.layoutSections
                                    .filter((s: any) => s.id && s.visible !== false)
                                    .map((s: any) => (
                                      <SelectItem key={s.id} value={s.id}>
                                        {s.type.replace(/([A-Z])/g, ' $1').trim()} (#{s.id})
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
                                  min="0" max="100"
                                  value={hotspot.x}
                                  onChange={(e) => {
                                    const newHotspots = [...formData.educationHotspots];
                                    newHotspots[index].x = Number(e.target.value);
                                    setFormData({ ...formData, educationHotspots: newHotspots });
                                  }}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Y Position (%)</Label>
                                <Input
                                  type="number"
                                  min="0" max="100"
                                  value={hotspot.y}
                                  onChange={(e) => {
                                    const newHotspots = [...formData.educationHotspots];
                                    newHotspots[index].y = Number(e.target.value);
                                    setFormData({ ...formData, educationHotspots: newHotspots });
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
                                const newHotspots = [...formData.educationHotspots];
                                newHotspots[index].description = e.target.value;
                                setFormData({ ...formData, educationHotspots: newHotspots });
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ADVANCED TAB */}
            <TabsContent value="advanced" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Custom CSS</CardTitle>
                  <CardDescription>
                    Add custom CSS for advanced styling (applies to ALL pages)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={formData.customCSS}
                    onChange={(e) =>
                      setFormData({ ...formData, customCSS: e.target.value })
                    }
                    placeholder=".my-custom-class { color: red; }"
                    rows={10}
                    className="font-mono text-sm"
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    Advanced users only. Use CSS selectors to override default
                    styles.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Preview Your Store</CardTitle>
                  <CardDescription>See how your changes look live</CardDescription>
                </CardHeader>
                <CardContent>
                  <a
                    href={getTenantUrl(tenant)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <ImageIcon className="w-5 h-5 mr-2" />
                    View Live Store
                  </a>
                  <p className="text-sm text-gray-500 mt-2">
                    Open your store in a new tab to preview changes
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </form>
      </div>

      {/* RIGHT: Live Preview Pane */}
      <div className="flex-1 bg-muted/20 border-2 rounded-xl border-dashed overflow-hidden relative shadow-inner isolate z-0">
        <div className="absolute top-0 inset-x-0 h-10 bg-muted/80 backdrop-blur-md border-b flex items-center justify-between px-4 font-mono text-xs text-muted-foreground z-50">
          <div className="flex items-center gap-4">
            <div className="flex gap-1.5 mr-4">
              <div className="w-3 h-3 rounded-full bg-red-400/80"></div>
              <div className="w-3 h-3 rounded-full bg-amber-400/80"></div>
              <div className="w-3 h-3 rounded-full bg-green-400/80"></div>
            </div>
            <span>Live Preview — {formData.businessName || tenant.businessName}</span>
          </div>
        </div>

        <div className="w-full h-full pt-10 overflow-y-auto preview-scrollbar bg-background">
          {liveLayout ? (
            <TenantThemeProvider
              tenant={tenant as any}
              tenantTemplate={{ designSystem: liveDesignSystem, customCss: formData.customCSS }}
            >
              <TemplateRenderer
                layout={liveLayout as any}
                sectionProps={liveSectionProps}
                customCss={formData.customCSS}
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
    </div>
  );
}

// Color Picker Component
function ColorPicker({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <p className="text-xs text-gray-500 mb-2">{description}</p>
      <div className="flex gap-2">
        <Input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-16 h-10 p-1 cursor-pointer"
        />
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="flex-1"
        />
      </div>
    </div>
  );
}

// File Upload Component
function FileUpload({
  label,
  description,
  accept,
  onChange,
  file,
}: {
  label: string;
  description: string;
  accept: string;
  onChange: (file: File | null) => void;
  file: File | null;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <p className="text-xs text-gray-500 mb-2">{description}</p>
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors">
        <input
          type="file"
          accept={accept}
          onChange={(e) => onChange(e.target.files?.[0] || null)}
          className="hidden"
          id={`file-${label}`}
        />
        <label htmlFor={`file-${label}`} className="cursor-pointer">
          <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
          {file ? (
            <p className="text-sm text-green-600 font-medium">{file.name}</p>
          ) : (
            <p className="text-sm text-gray-600">
              Click to upload or drag and drop
            </p>
          )}
        </label>
      </div>
    </div>
  );
}
