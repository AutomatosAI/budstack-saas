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
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
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
  Clock,
  MapPin,
  Mail,
  Phone,
  Globe,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  BookOpen,
  ShoppingBag,
  Stethoscope,
  Info,
  MessageCircle,
  FileQuestion,
  Newspaper,
} from "lucide-react";
import { TenantSettings } from "@/lib/types";

interface ComprehensiveBrandingFormProps {
  tenant: {
    id: string;
    businessName: string;
    subdomain: string;
    customDomain: string | null;
    settings: any;
  };
}

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
const DAY_LABELS = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export default function ComprehensiveBrandingForm({
  tenant,
}: ComprehensiveBrandingFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [logo, setLogo] = useState<File | null>(null);
  const [heroImage, setHeroImage] = useState<File | null>(null);
  const [favicon, setFavicon] = useState<File | null>(null);

  const settings = (tenant.settings as TenantSettings) || {};

  // Initialize form data with all fields
  const [formData, setFormData] = useState({
    businessName: tenant.businessName,
    tagline: settings.tagline || "",

    // Business Info
    businessPhone: settings.businessInfo?.phone || "",
    businessEmail: settings.businessInfo?.email || "",
    businessAddress: settings.businessInfo?.address || "",
    businessCity: settings.businessInfo?.city || "",
    businessCountry: settings.businessInfo?.country || "Portugal",
    emergencyLine: settings.businessInfo?.emergencyLine || "",
    supportHours: settings.businessInfo?.supportHours || "Mon-Fri: 9AM-6PM",

    // Business Hours
    ...Object.fromEntries(
      DAYS.flatMap((day) => [
        [`${day}Open`, settings.businessHours?.[day]?.open || "09:00"],
        [`${day}Close`, settings.businessHours?.[day]?.close || "18:00"],
        [
          `${day}Closed`,
          settings.businessHours?.[day]?.closed || day === "sunday",
        ],
      ]),
    ),

    // Footer
    footerDescription:
      settings.footer?.description ||
      "Safe, legal access to medical cannabis in Portugal. Providing personalized treatment plans through licensed healthcare professionals.",
    footerCopyrightText:
      settings.footer?.copyrightText ||
      `© ${new Date().getFullYear()} ${tenant.businessName}. All rights reserved.`,
    footerServingArea:
      settings.footer?.servingArea || "Serving All of Portugal",
    footerServingDetails:
      settings.footer?.servingDetails ||
      "From Lisbon to Porto, Algarve to Braga",
    footerFacebook: settings.footer?.socialMedia?.facebook || "",
    footerTwitter: settings.footer?.socialMedia?.twitter || "",
    footerInstagram: settings.footer?.socialMedia?.instagram || "",
    footerLinkedin: settings.footer?.socialMedia?.linkedin || "",

    // Colors
    primaryColor: settings.primaryColor || "#059669",
    secondaryColor: settings.secondaryColor || "#34d399",
    accentColor: settings.accentColor || "#10b981",
    backgroundColor: settings.backgroundColor || "#ffffff",
    textColor: settings.textColor || "#1f2937",
    headingColor: settings.headingColor || "#111827",

    // Typography
    fontFamily: settings.fontFamily || "inter",
    headingFontFamily:
      settings.headingFontFamily || settings.fontFamily || "inter",
    fontSize: settings.fontSize || "medium",

    // Layout
    template: settings.template || "modern",
    buttonStyle: settings.buttonStyle || "rounded",
    buttonSize: settings.buttonSize || "medium",
    borderRadius: settings.borderRadius || "medium",
    spacing: settings.spacing || "normal",
    shadowStyle: settings.shadowStyle || "soft",
    heroType: settings.heroType || "gradient",

    // Home Page
    homeHeroTitle:
      settings.pageContent?.home?.heroTitle ||
      "Welcome to Your Medical Cannabis Journey",
    homeHeroSubtitle:
      settings.pageContent?.home?.heroSubtitle ||
      "Premium medical cannabis products delivered with care",
    homeHeroCtaText: settings.pageContent?.home?.heroCtaText || "Get Started",

    // About Page
    aboutTitle: settings.pageContent?.about?.title || "About Us",
    aboutSubtitle:
      settings.pageContent?.about?.subtitle ||
      "Your trusted partner in medical cannabis",
    aboutContent:
      settings.pageContent?.about?.content ||
      "We are dedicated to providing high-quality medical cannabis products...",

    // Contact Page
    contactTitle: settings.pageContent?.contact?.title || "Contact Us",
    contactSubtitle:
      settings.pageContent?.contact?.subtitle ||
      "Have questions? We are here to help. Reach out to our team anytime.",
    contactFormTitle:
      settings.pageContent?.contact?.formTitle || "Send us a message",
    contactEmergencyNote:
      settings.pageContent?.contact?.emergencyNote ||
      "For urgent medical concerns, please contact your healthcare provider or emergency services.",

    // Products Page
    productsTitle:
      settings.pageContent?.products?.title || "Medical Cannabis Products",
    productsSubtitle:
      settings.pageContent?.products?.subtitle ||
      "Browse our curated selection of EU-GMP certified medical cannabis strains. All products require a valid prescription.",
    productsSearchPlaceholder:
      settings.pageContent?.products?.searchPlaceholder || "Search products...",

    // How It Works Page
    howItWorksTitle: settings.pageContent?.howItWorks?.title || "How It Works",
    howItWorksSubtitle:
      settings.pageContent?.howItWorks?.subtitle ||
      "Your path to legal medical cannabis in four simple steps",
    howItWorksDescription:
      settings.pageContent?.howItWorks?.description ||
      "Getting started with medical cannabis is straightforward, safe, and legal",
    howItWorksStep1Title:
      settings.pageContent?.howItWorks?.steps?.[0]?.title ||
      "Book Your Consultation",
    howItWorksStep1Desc:
      settings.pageContent?.howItWorks?.steps?.[0]?.description ||
      "Schedule an online consultation with one of our licensed medical professionals.",
    howItWorksStep2Title:
      settings.pageContent?.howItWorks?.steps?.[1]?.title ||
      "Medical Assessment",
    howItWorksStep2Desc:
      settings.pageContent?.howItWorks?.steps?.[1]?.description ||
      "Discuss your medical history and conditions during a confidential video consultation.",
    howItWorksStep3Title:
      settings.pageContent?.howItWorks?.steps?.[2]?.title ||
      "Receive Your Prescription",
    howItWorksStep3Desc:
      settings.pageContent?.howItWorks?.steps?.[2]?.description ||
      "If approved, receive your medical cannabis prescription and product recommendations.",
    howItWorksStep4Title:
      settings.pageContent?.howItWorks?.steps?.[3]?.title ||
      "Order Your Products",
    howItWorksStep4Desc:
      settings.pageContent?.howItWorks?.steps?.[3]?.description ||
      "Browse our catalog and order your prescribed products with secure delivery.",
    howItWorksComplianceTitle:
      settings.pageContent?.howItWorks?.complianceTitle ||
      "Legal & Regulatory Compliance",

    // Consultation Page
    consultationTitle:
      settings.pageContent?.consultation?.title || "Book a Consultation",
    consultationSubtitle:
      settings.pageContent?.consultation?.subtitle ||
      "Schedule your video consultation with a licensed medical professional",
    consultationDescription:
      settings.pageContent?.consultation?.description ||
      "Our licensed healthcare professionals are here to evaluate your condition and determine if medical cannabis is right for you.",

    // Conditions Page
    conditionsTitle:
      settings.pageContent?.conditions?.title || "Medical Conditions",
    conditionsSubtitle:
      settings.pageContent?.conditions?.subtitle ||
      "Conditions treatable with medical cannabis",
    conditionsDescription:
      settings.pageContent?.conditions?.description ||
      "Medical cannabis may be effective for various conditions. Consult with our healthcare professionals to learn more.",

    // FAQ Page
    faqTitle: settings.pageContent?.faq?.title || "Frequently Asked Questions",
    faqSubtitle:
      settings.pageContent?.faq?.subtitle ||
      "Find answers to common questions about medical cannabis",
    faqDescription:
      settings.pageContent?.faq?.description ||
      "Have questions? Find answers to the most common questions about medical cannabis, our services, and the legal framework.",

    // Blog Page
    blogTitle: settings.pageContent?.blog?.title || "Education & News",
    blogSubtitle:
      settings.pageContent?.blog?.subtitle ||
      "Latest updates and educational content",
    blogDescription:
      settings.pageContent?.blog?.description ||
      "Stay informed with the latest news, research, and educational content about medical cannabis.",

    // Advanced
    customCSS: settings.customCSS || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const submitFormData = new FormData();
      submitFormData.append("businessName", formData.businessName);

      // Construct the settings object
      const settingsData: TenantSettings = {
        tagline: formData.tagline,

        // Business Info
        businessInfo: {
          phone: formData.businessPhone,
          email: formData.businessEmail,
          address: formData.businessAddress,
          city: formData.businessCity,
          country: formData.businessCountry,
          emergencyLine: formData.emergencyLine,
          supportHours: formData.supportHours,
        },

        // Business Hours
        businessHours: Object.fromEntries(
          DAYS.map((day) => [
            day,
            {
              open: formData[`${day}Open` as keyof typeof formData] as string,
              close: formData[`${day}Close` as keyof typeof formData] as string,
              closed: formData[
                `${day}Closed` as keyof typeof formData
              ] as boolean,
            },
          ]),
        ),

        // Footer
        footer: {
          description: formData.footerDescription,
          copyrightText: formData.footerCopyrightText,
          servingArea: formData.footerServingArea,
          servingDetails: formData.footerServingDetails,
          socialMedia: {
            facebook: formData.footerFacebook,
            twitter: formData.footerTwitter,
            instagram: formData.footerInstagram,
            linkedin: formData.footerLinkedin,
          },
        },

        // Colors
        primaryColor: formData.primaryColor,
        secondaryColor: formData.secondaryColor,
        accentColor: formData.accentColor,
        backgroundColor: formData.backgroundColor,
        textColor: formData.textColor,
        headingColor: formData.headingColor,

        // Typography
        fontFamily: formData.fontFamily as any,
        headingFontFamily: formData.headingFontFamily as any,
        fontSize: formData.fontSize as any,

        // Layout
        template: formData.template as any,
        buttonStyle: formData.buttonStyle as any,
        buttonSize: formData.buttonSize as any,
        borderRadius: formData.borderRadius as any,
        spacing: formData.spacing as any,
        shadowStyle: formData.shadowStyle as any,
        heroType: formData.heroType as any,

        // Page Content
        pageContent: {
          home: {
            heroTitle: formData.homeHeroTitle,
            heroSubtitle: formData.homeHeroSubtitle,
            heroCtaText: formData.homeHeroCtaText,
          },
          about: {
            title: formData.aboutTitle,
            subtitle: formData.aboutSubtitle,
            content: formData.aboutContent,
          },
          contact: {
            title: formData.contactTitle,
            subtitle: formData.contactSubtitle,
            formTitle: formData.contactFormTitle,
            emergencyNote: formData.contactEmergencyNote,
          },
          products: {
            title: formData.productsTitle,
            subtitle: formData.productsSubtitle,
            searchPlaceholder: formData.productsSearchPlaceholder,
          },
          howItWorks: {
            title: formData.howItWorksTitle,
            subtitle: formData.howItWorksSubtitle,
            description: formData.howItWorksDescription,
            steps: [
              {
                number: 1,
                title: formData.howItWorksStep1Title,
                description: formData.howItWorksStep1Desc,
              },
              {
                number: 2,
                title: formData.howItWorksStep2Title,
                description: formData.howItWorksStep2Desc,
              },
              {
                number: 3,
                title: formData.howItWorksStep3Title,
                description: formData.howItWorksStep3Desc,
              },
              {
                number: 4,
                title: formData.howItWorksStep4Title,
                description: formData.howItWorksStep4Desc,
              },
            ],
            complianceTitle: formData.howItWorksComplianceTitle,
          },
          consultation: {
            title: formData.consultationTitle,
            subtitle: formData.consultationSubtitle,
            description: formData.consultationDescription,
          },
          conditions: {
            title: formData.conditionsTitle,
            subtitle: formData.conditionsSubtitle,
            description: formData.conditionsDescription,
          },
          faq: {
            title: formData.faqTitle,
            subtitle: formData.faqSubtitle,
            description: formData.faqDescription,
          },
          blog: {
            title: formData.blogTitle,
            subtitle: formData.blogSubtitle,
            description: formData.blogDescription,
          },
        },

        // Advanced
        customCSS: formData.customCSS,

        // Preserve existing paths
        logoPath: settings.logoPath,
        heroImagePath: settings.heroImagePath,
        faviconPath: settings.faviconPath,
      };

      submitFormData.append("settings", JSON.stringify(settingsData));

      // Add files if selected
      if (logo) submitFormData.append("logo", logo);
      if (heroImage) submitFormData.append("heroImage", heroImage);
      if (favicon) submitFormData.append("favicon", favicon);

      const response = await fetch(`/api/tenant-admin/branding`, {
        method: "PUT",
        body: submitFormData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update branding");
      }

      toast.success("Branding updated successfully!");
      router.refresh();
    } catch (error: any) {
      console.error("Error updating branding:", error);
      toast.error(error.message || "Failed to update branding");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs defaultValue="business" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6 lg:grid-cols-12">
          <TabsTrigger value="business" className="text-xs">
            <MapPin className="w-3 h-3 mr-1" />
            Business
          </TabsTrigger>
          <TabsTrigger value="hours" className="text-xs">
            <Clock className="w-3 h-3 mr-1" />
            Hours
          </TabsTrigger>
          <TabsTrigger value="footer" className="text-xs">
            <Globe className="w-3 h-3 mr-1" />
            Footer
          </TabsTrigger>
          <TabsTrigger value="design" className="text-xs">
            <Palette className="w-3 h-3 mr-1" />
            Design
          </TabsTrigger>
          <TabsTrigger value="home" className="text-xs">
            <Layout className="w-3 h-3 mr-1" />
            Home
          </TabsTrigger>
          <TabsTrigger value="about" className="text-xs">
            <Info className="w-3 h-3 mr-1" />
            About
          </TabsTrigger>
          <TabsTrigger value="contact" className="text-xs">
            <Mail className="w-3 h-3 mr-1" />
            Contact
          </TabsTrigger>
          <TabsTrigger value="products" className="text-xs">
            <ShoppingBag className="w-3 h-3 mr-1" />
            Products
          </TabsTrigger>
          <TabsTrigger value="how-it-works" className="text-xs">
            <FileText className="w-3 h-3 mr-1" />
            How It Works
          </TabsTrigger>
          <TabsTrigger value="consultation" className="text-xs">
            <Stethoscope className="w-3 h-3 mr-1" />
            Consultation
          </TabsTrigger>
          <TabsTrigger value="other-pages" className="text-xs">
            <BookOpen className="w-3 h-3 mr-1" />
            Other
          </TabsTrigger>
          <TabsTrigger value="advanced" className="text-xs">
            <Settings className="w-3 h-3 mr-1" />
            Advanced
          </TabsTrigger>
        </TabsList>

        {/* BUSINESS INFO TAB */}
        <TabsContent value="business" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Business Information
              </CardTitle>
              <CardDescription>
                Your business contact details displayed across the website
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name</Label>
                  <Input
                    id="businessName"
                    value={formData.businessName}
                    onChange={(e) =>
                      setFormData({ ...formData, businessName: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tagline">Tagline</Label>
                  <Input
                    id="tagline"
                    placeholder="Your business tagline"
                    value={formData.tagline}
                    onChange={(e) =>
                      setFormData({ ...formData, tagline: e.target.value })
                    }
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="businessPhone">Phone Number</Label>
                  <Input
                    id="businessPhone"
                    placeholder="+351 XXX XXX XXX"
                    value={formData.businessPhone}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        businessPhone: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="businessEmail">Email Address</Label>
                  <Input
                    id="businessEmail"
                    type="email"
                    placeholder="info@example.com"
                    value={formData.businessEmail}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        businessEmail: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emergencyLine">Emergency Line (24/7)</Label>
                  <Input
                    id="emergencyLine"
                    placeholder="+351 XXX XXX XXX"
                    value={formData.emergencyLine}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        emergencyLine: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supportHours">Support Hours</Label>
                  <Input
                    id="supportHours"
                    placeholder="Mon-Fri: 9AM-6PM"
                    value={formData.supportHours}
                    onChange={(e) =>
                      setFormData({ ...formData, supportHours: e.target.value })
                    }
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="businessAddress">Street Address</Label>
                <Input
                  id="businessAddress"
                  placeholder="123 Main Street"
                  value={formData.businessAddress}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      businessAddress: e.target.value,
                    })
                  }
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="businessCity">City</Label>
                  <Input
                    id="businessCity"
                    placeholder="Lisbon"
                    value={formData.businessCity}
                    onChange={(e) =>
                      setFormData({ ...formData, businessCity: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="businessCountry">Country</Label>
                  <Input
                    id="businessCountry"
                    placeholder="Portugal"
                    value={formData.businessCountry}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        businessCountry: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BUSINESS HOURS TAB */}
        <TabsContent value="hours" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Business Hours
              </CardTitle>
              <CardDescription>
                Set your operating hours for each day of the week
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {DAYS.map((day) => (
                <div key={day} className="flex items-center gap-4">
                  <div className="w-32">
                    <Label>{DAY_LABELS[day]}</Label>
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <Switch
                      checked={
                        !formData[`${day}Closed` as keyof typeof formData]
                      }
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, [`${day}Closed`]: !checked })
                      }
                    />
                    {!formData[`${day}Closed` as keyof typeof formData] ? (
                      <>
                        <Input
                          type="time"
                          value={
                            formData[
                              `${day}Open` as keyof typeof formData
                            ] as string
                          }
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              [`${day}Open`]: e.target.value,
                            })
                          }
                          className="w-32"
                        />
                        <span>to</span>
                        <Input
                          type="time"
                          value={
                            formData[
                              `${day}Close` as keyof typeof formData
                            ] as string
                          }
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              [`${day}Close`]: e.target.value,
                            })
                          }
                          className="w-32"
                        />
                      </>
                    ) : (
                      <span className="text-muted-foreground">Closed</span>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* FOOTER TAB */}
        <TabsContent value="footer" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Footer Content
              </CardTitle>
              <CardDescription>
                Customize the footer content displayed on all pages
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="footerDescription">Footer Description</Label>
                <Textarea
                  id="footerDescription"
                  rows={3}
                  placeholder="A brief description about your business"
                  value={formData.footerDescription}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      footerDescription: e.target.value,
                    })
                  }
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="footerServingArea">Serving Area Title</Label>
                <Input
                  id="footerServingArea"
                  placeholder="Serving All of Portugal"
                  value={formData.footerServingArea}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      footerServingArea: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="footerServingDetails">
                  Serving Area Details
                </Label>
                <Input
                  id="footerServingDetails"
                  placeholder="From Lisbon to Porto, Algarve to Braga"
                  value={formData.footerServingDetails}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      footerServingDetails: e.target.value,
                    })
                  }
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <Label>Social Media Links</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="footerFacebook"
                      className="flex items-center gap-2"
                    >
                      <Facebook className="w-4 h-4" />
                      Facebook
                    </Label>
                    <Input
                      id="footerFacebook"
                      placeholder="https://facebook.com/yourpage"
                      value={formData.footerFacebook}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          footerFacebook: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="footerTwitter"
                      className="flex items-center gap-2"
                    >
                      <Twitter className="w-4 h-4" />
                      Twitter
                    </Label>
                    <Input
                      id="footerTwitter"
                      placeholder="https://twitter.com/yourhandle"
                      value={formData.footerTwitter}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          footerTwitter: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="footerInstagram"
                      className="flex items-center gap-2"
                    >
                      <Instagram className="w-4 h-4" />
                      Instagram
                    </Label>
                    <Input
                      id="footerInstagram"
                      placeholder="https://instagram.com/yourhandle"
                      value={formData.footerInstagram}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          footerInstagram: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="footerLinkedin"
                      className="flex items-center gap-2"
                    >
                      <Linkedin className="w-4 h-4" />
                      LinkedIn
                    </Label>
                    <Input
                      id="footerLinkedin"
                      placeholder="https://linkedin.com/company/yourcompany"
                      value={formData.footerLinkedin}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          footerLinkedin: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="footerCopyrightText">Copyright Text</Label>
                <Input
                  id="footerCopyrightText"
                  placeholder="© 2025 Your Business. All rights reserved."
                  value={formData.footerCopyrightText}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      footerCopyrightText: e.target.value,
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Continue with remaining tabs in next message due to length... */}
        {/* DESIGN TAB - Colors & Typography */}
        <TabsContent value="design" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Colors & Typography</CardTitle>
              <CardDescription>Customize the visual appearance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Primary Color</Label>
                  <Input
                    id="primaryColor"
                    type="color"
                    value={formData.primaryColor}
                    onChange={(e) =>
                      setFormData({ ...formData, primaryColor: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondaryColor">Secondary Color</Label>
                  <Input
                    id="secondaryColor"
                    type="color"
                    value={formData.secondaryColor}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        secondaryColor: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accentColor">Accent Color</Label>
                  <Input
                    id="accentColor"
                    type="color"
                    value={formData.accentColor}
                    onChange={(e) =>
                      setFormData({ ...formData, accentColor: e.target.value })
                    }
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fontFamily">Body Font</Label>
                  <Select
                    value={formData.fontFamily}
                    onValueChange={(value) =>
                      setFormData({ ...formData, fontFamily: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inter">Inter</SelectItem>
                      <SelectItem value="roboto">Roboto</SelectItem>
                      <SelectItem value="lato">Lato</SelectItem>
                      <SelectItem value="poppins">Poppins</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="headingFontFamily">Heading Font</Label>
                  <Select
                    value={formData.headingFontFamily}
                    onValueChange={(value) =>
                      setFormData({ ...formData, headingFontFamily: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inter">Inter</SelectItem>
                      <SelectItem value="playfair">Playfair Display</SelectItem>
                      <SelectItem value="montserrat">Montserrat</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HOME PAGE TAB */}
        <TabsContent value="home" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Home Page Content</CardTitle>
              <CardDescription>
                Customize your homepage hero section
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="homeHeroTitle">Hero Title</Label>
                <Input
                  id="homeHeroTitle"
                  value={formData.homeHeroTitle}
                  onChange={(e) =>
                    setFormData({ ...formData, homeHeroTitle: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="homeHeroSubtitle">Hero Subtitle</Label>
                <Textarea
                  id="homeHeroSubtitle"
                  rows={2}
                  value={formData.homeHeroSubtitle}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      homeHeroSubtitle: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="homeHeroCtaText">
                  Call-to-Action Button Text
                </Label>
                <Input
                  id="homeHeroCtaText"
                  value={formData.homeHeroCtaText}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      homeHeroCtaText: e.target.value,
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABOUT PAGE TAB */}
        <TabsContent value="about" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>About Page Content</CardTitle>
              <CardDescription>Tell your story</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="aboutTitle">Page Title</Label>
                <Input
                  id="aboutTitle"
                  value={formData.aboutTitle}
                  onChange={(e) =>
                    setFormData({ ...formData, aboutTitle: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="aboutSubtitle">Page Subtitle</Label>
                <Input
                  id="aboutSubtitle"
                  value={formData.aboutSubtitle}
                  onChange={(e) =>
                    setFormData({ ...formData, aboutSubtitle: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="aboutContent">About Content</Label>
                <Textarea
                  id="aboutContent"
                  rows={6}
                  value={formData.aboutContent}
                  onChange={(e) =>
                    setFormData({ ...formData, aboutContent: e.target.value })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONTACT PAGE TAB */}
        <TabsContent value="contact" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact Page Content</CardTitle>
              <CardDescription>Contact form and information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contactTitle">Page Title</Label>
                <Input
                  id="contactTitle"
                  value={formData.contactTitle}
                  onChange={(e) =>
                    setFormData({ ...formData, contactTitle: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactSubtitle">Page Subtitle</Label>
                <Textarea
                  id="contactSubtitle"
                  rows={2}
                  value={formData.contactSubtitle}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      contactSubtitle: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactFormTitle">Contact Form Title</Label>
                <Input
                  id="contactFormTitle"
                  value={formData.contactFormTitle}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      contactFormTitle: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactEmergencyNote">
                  Emergency Support Note
                </Label>
                <Textarea
                  id="contactEmergencyNote"
                  rows={2}
                  value={formData.contactEmergencyNote}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      contactEmergencyNote: e.target.value,
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PRODUCTS PAGE TAB */}
        <TabsContent value="products" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Products Page Content</CardTitle>
              <CardDescription>
                Product catalog header and description
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="productsTitle">Page Title</Label>
                <Input
                  id="productsTitle"
                  value={formData.productsTitle}
                  onChange={(e) =>
                    setFormData({ ...formData, productsTitle: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="productsSubtitle">Page Subtitle</Label>
                <Textarea
                  id="productsSubtitle"
                  rows={2}
                  value={formData.productsSubtitle}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      productsSubtitle: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="productsSearchPlaceholder">
                  Search Placeholder Text
                </Label>
                <Input
                  id="productsSearchPlaceholder"
                  value={formData.productsSearchPlaceholder}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      productsSearchPlaceholder: e.target.value,
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HOW IT WORKS PAGE TAB */}
        <TabsContent value="how-it-works" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>How It Works Page</CardTitle>
              <CardDescription>
                Process steps and compliance information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="howItWorksTitle">Page Title</Label>
                <Input
                  id="howItWorksTitle"
                  value={formData.howItWorksTitle}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      howItWorksTitle: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="howItWorksSubtitle">Page Subtitle</Label>
                <Input
                  id="howItWorksSubtitle"
                  value={formData.howItWorksSubtitle}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      howItWorksSubtitle: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="howItWorksDescription">Page Description</Label>
                <Textarea
                  id="howItWorksDescription"
                  rows={2}
                  value={formData.howItWorksDescription}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      howItWorksDescription: e.target.value,
                    })
                  }
                />
              </div>

              <Separator />

              {[1, 2, 3, 4].map((num) => (
                <div key={num} className="space-y-4 p-4 border rounded-lg">
                  <h4 className="font-semibold">Step {num}</h4>
                  <div className="space-y-2">
                    <Label htmlFor={`howItWorksStep${num}Title`}>Title</Label>
                    <Input
                      id={`howItWorksStep${num}Title`}
                      value={
                        formData[
                          `howItWorksStep${num}Title` as keyof typeof formData
                        ] as string
                      }
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          [`howItWorksStep${num}Title`]: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`howItWorksStep${num}Desc`}>
                      Description
                    </Label>
                    <Textarea
                      id={`howItWorksStep${num}Desc`}
                      rows={2}
                      value={
                        formData[
                          `howItWorksStep${num}Desc` as keyof typeof formData
                        ] as string
                      }
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          [`howItWorksStep${num}Desc`]: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              ))}

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="howItWorksComplianceTitle">
                  Compliance Section Title
                </Label>
                <Input
                  id="howItWorksComplianceTitle"
                  value={formData.howItWorksComplianceTitle}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      howItWorksComplianceTitle: e.target.value,
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONSULTATION PAGE TAB */}
        <TabsContent value="consultation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Consultation Page</CardTitle>
              <CardDescription>Booking page content</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="consultationTitle">Page Title</Label>
                <Input
                  id="consultationTitle"
                  value={formData.consultationTitle}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      consultationTitle: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="consultationSubtitle">Page Subtitle</Label>
                <Input
                  id="consultationSubtitle"
                  value={formData.consultationSubtitle}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      consultationSubtitle: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="consultationDescription">
                  Page Description
                </Label>
                <Textarea
                  id="consultationDescription"
                  rows={3}
                  value={formData.consultationDescription}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      consultationDescription: e.target.value,
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* OTHER PAGES TAB */}
        <TabsContent value="other-pages" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Conditions Page</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="conditionsTitle">Page Title</Label>
                <Input
                  id="conditionsTitle"
                  value={formData.conditionsTitle}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      conditionsTitle: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="conditionsSubtitle">Page Subtitle</Label>
                <Input
                  id="conditionsSubtitle"
                  value={formData.conditionsSubtitle}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      conditionsSubtitle: e.target.value,
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>FAQ Page</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="faqTitle">Page Title</Label>
                <Input
                  id="faqTitle"
                  value={formData.faqTitle}
                  onChange={(e) =>
                    setFormData({ ...formData, faqTitle: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="faqSubtitle">Page Subtitle</Label>
                <Input
                  id="faqSubtitle"
                  value={formData.faqSubtitle}
                  onChange={(e) =>
                    setFormData({ ...formData, faqSubtitle: e.target.value })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Blog Page</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="blogTitle">Page Title</Label>
                <Input
                  id="blogTitle"
                  value={formData.blogTitle}
                  onChange={(e) =>
                    setFormData({ ...formData, blogTitle: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="blogSubtitle">Page Subtitle</Label>
                <Input
                  id="blogSubtitle"
                  value={formData.blogSubtitle}
                  onChange={(e) =>
                    setFormData({ ...formData, blogSubtitle: e.target.value })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ADVANCED TAB */}
        <TabsContent value="advanced" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>
                Custom CSS and advanced configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customCSS">Custom CSS</Label>
                <Textarea
                  id="customCSS"
                  rows={10}
                  placeholder="/* Add your custom CSS here */"
                  value={formData.customCSS}
                  onChange={(e) =>
                    setFormData({ ...formData, customCSS: e.target.value })
                  }
                  className="font-mono text-sm"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-4 sticky bottom-0 bg-background p-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Upload className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
