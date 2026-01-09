
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Upload, Check, Palette, Type, Layout, FileText, Settings, Image as ImageIcon } from 'lucide-react';
import { TenantSettings } from '@/lib/types';
import { tenant_templates } from '@prisma/client';

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

const TEMPLATES = [
  { id: 'modern', name: 'Modern', description: 'Clean and professional' },
  { id: 'minimalist', name: 'Minimalist', description: 'Simple and elegant' },
  { id: 'bold', name: 'Bold', description: 'Vibrant and eye-catching' },
];

const FONTS = [
  { id: 'inter', name: 'Inter', description: 'Modern sans-serif' },
  { id: 'roboto', name: 'Roboto', description: 'Classic sans-serif' },
  { id: 'lato', name: 'Lato', description: 'Friendly sans-serif' },
  { id: 'montserrat', name: 'Montserrat', description: 'Geometric sans-serif' },
  { id: 'poppins', name: 'Poppins', description: 'Rounded sans-serif' },
  { id: 'playfair', name: 'Playfair Display', description: 'Elegant serif' },
];

export default function BrandingForm({ tenant, activeTemplate }: BrandingFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [logo, setLogo] = useState<File | null>(null);
  const [heroImage, setHeroImage] = useState<File | null>(null);
  const [favicon, setFavicon] = useState<File | null>(null);

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

  const [formData, setFormData] = useState({
    // Business
    businessName: tenant.businessName,
    tagline: settings.tagline || '',

    // Colors
    primaryColor: getVal(['colors', 'primary'], settings.primaryColor || '#059669'),
    secondaryColor: getVal(['colors', 'secondary'], settings.secondaryColor || '#34d399'),
    accentColor: getVal(['colors', 'accent'], settings.accentColor || '#10b981'),
    backgroundColor: getVal(['colors', 'background'], settings.backgroundColor || '#ffffff'),
    textColor: getVal(['colors', 'text'], settings.textColor || '#1f2937'),
    headingColor: getVal(['colors', 'heading'], settings.headingColor || '#111827'),

    // Typography
    fontFamily: getVal(['typography', 'fontFamily', 'body'], settings.fontFamily || 'inter'),
    headingFontFamily: getVal(['typography', 'fontFamily', 'heading'], settings.headingFontFamily || settings.fontFamily || 'inter'),
    fontSize: getVal(['typography', 'fontSize', 'base'], settings.fontSize || 'medium'),

    // Layout
    template: settings.template || 'modern', // Template styling preference
    buttonStyle: getVal(['borderRadius', 'button'], settings.buttonStyle || 'rounded'),
    buttonSize: settings.buttonSize || 'medium', // Not strictly part of new DS yet
    borderRadius: getVal(['borderRadius', 'container'], settings.borderRadius || 'medium'),
    spacing: getVal(['spacing', 'scale'], settings.spacing || 'normal'),
    shadowStyle: getVal(['shadows', 'card'], settings.shadowStyle || 'soft'),

    // Hero
    heroType: settings.heroType || 'gradient',

    // Page Content - Home
    homeHeroTitle: templateContent.home?.heroTitle || settingsContent.home?.heroTitle || 'Welcome to Your Medical Cannabis Journey',
    homeHeroSubtitle: templateContent.home?.heroSubtitle || settingsContent.home?.heroSubtitle || 'Premium medical cannabis products delivered with care',
    homeHeroCtaText: templateContent.home?.heroCtaText || settingsContent.home?.heroCtaText || 'Get Started',

    // Page Content - About
    aboutTitle: templateContent.about?.title || settingsContent.about?.title || 'About Us',
    aboutContent: templateContent.about?.content || settingsContent.about?.content || 'We are dedicated to providing high-quality medical cannabis products...',

    // Page Content - Contact
    contactTitle: templateContent.contact?.title || settingsContent.contact?.title || 'Get in Touch',
    contactDescription: templateContent.contact?.description || settingsContent.contact?.description || 'Have questions? We are here to help.',
    contactEmail: templateContent.contact?.email || settingsContent.contact?.email || '',
    contactPhone: templateContent.contact?.phone || settingsContent.contact?.phone || '',
    contactAddress: templateContent.contact?.address || settingsContent.contact?.address || '',

    // Advanced
    customCSS: activeTemplate?.customCss || settings.customCSS || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formDataToSend = new FormData();

      // Extract business name
      const { businessName, ...settings } = formData;

      // Append business name
      formDataToSend.append('businessName', businessName);

      // Append settings as JSON string
      formDataToSend.append('settings', JSON.stringify({
        ...settings,
        pageContent: {
          home: {
            heroTitle: formData.homeHeroTitle,
            heroSubtitle: formData.homeHeroSubtitle,
            heroCtaText: formData.homeHeroCtaText,
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
        aboutTitle: undefined,
        aboutContent: undefined,
        contactTitle: undefined,
        contactDescription: undefined,
        contactEmail: undefined,
        contactPhone: undefined,
        contactAddress: undefined,
      }));

      // Append files
      if (logo) formDataToSend.append('logo', logo);
      if (heroImage) formDataToSend.append('heroImage', heroImage);
      if (favicon) formDataToSend.append('favicon', favicon);

      const res = await fetch(`/api/tenant-admin/branding`, {
        method: 'POST',
        body: formDataToSend,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to update branding');
      }

      toast.success('✅ Branding updated successfully! Changes applied to all pages.');
      router.refresh();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update branding';
      toast.error(errorMessage);
      console.error('Branding update error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (file: File | null, type: 'logo' | 'heroImage' | 'favicon') => {
    if (type === 'logo') setLogo(file);
    if (type === 'heroImage') setHeroImage(file);
    if (type === 'favicon') setFavicon(file);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Tabs defaultValue="design" className="space-y-6">
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="design"><Layout className="w-4 h-4 mr-2" />Design</TabsTrigger>
          <TabsTrigger value="colors"><Palette className="w-4 h-4 mr-2" />Colors</TabsTrigger>
          <TabsTrigger value="typography"><Type className="w-4 h-4 mr-2" />Typography</TabsTrigger>
          <TabsTrigger value="layout"><Settings className="w-4 h-4 mr-2" />Layout</TabsTrigger>
          <TabsTrigger value="content"><FileText className="w-4 h-4 mr-2" />Content</TabsTrigger>
          <TabsTrigger value="advanced"><Settings className="w-4 h-4 mr-2" />Advanced</TabsTrigger>
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
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="tagline">Tagline</Label>
                <Textarea
                  id="tagline"
                  value={formData.tagline}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                  placeholder="Your trusted medical cannabis partner"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Template Style</CardTitle>
              <CardDescription>Choose the overall design aesthetic</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {TEMPLATES.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => setFormData({ ...formData, template: template.id as any })}
                    className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all ${formData.template === template.id
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    {formData.template === template.id && (
                      <Check className="absolute top-2 right-2 w-5 h-5 text-green-500" />
                    )}
                    <h3 className="font-semibold">{template.name}</h3>
                    <p className="text-sm text-gray-600">{template.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Brand Images</CardTitle>
              <CardDescription>Upload your logo, hero image, and favicon</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FileUpload
                label="Logo"
                description="Recommended: PNG/SVG, transparent background"
                accept="image/*"
                onChange={(file) => handleFileChange(file, 'logo')}
                file={logo}
              />

              <div>
                <Label>Hero Section Type</Label>
                <Select
                  value={formData.heroType}
                  onValueChange={(value) => setFormData({ ...formData, heroType: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gradient">Gradient Background</SelectItem>
                    <SelectItem value="image">Image Background</SelectItem>
                    <SelectItem value="video">Video Background</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.heroType === 'image' && (
                <FileUpload
                  label="Hero Image"
                  description="Recommended: 1920x1080px, JPG/PNG"
                  accept="image/*"
                  onChange={(file) => handleFileChange(file, 'heroImage')}
                  file={heroImage}
                />
              )}

              <FileUpload
                label="Favicon"
                description="Recommended: 32x32px or 64x64px, PNG/ICO"
                accept="image/*"
                onChange={(file) => handleFileChange(file, 'favicon')}
                file={favicon}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* COLORS TAB */}
        <TabsContent value="colors" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Brand Colors</CardTitle>
              <CardDescription>Define your color palette (applies to ALL pages)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <ColorPicker
                  label="Primary Color"
                  description="Main brand color (buttons, headers)"
                  value={formData.primaryColor}
                  onChange={(value) => setFormData({ ...formData, primaryColor: value })}
                />
                <ColorPicker
                  label="Secondary Color"
                  description="Secondary elements, links"
                  value={formData.secondaryColor}
                  onChange={(value) => setFormData({ ...formData, secondaryColor: value })}
                />
                <ColorPicker
                  label="Accent Color"
                  description="Call-to-action highlights"
                  value={formData.accentColor}
                  onChange={(value) => setFormData({ ...formData, accentColor: value })}
                />
                <ColorPicker
                  label="Background Color"
                  description="Page background"
                  value={formData.backgroundColor}
                  onChange={(value) => setFormData({ ...formData, backgroundColor: value })}
                />
                <ColorPicker
                  label="Text Color"
                  description="Body text"
                  value={formData.textColor}
                  onChange={(value) => setFormData({ ...formData, textColor: value })}
                />
                <ColorPicker
                  label="Heading Color"
                  description="Heading text"
                  value={formData.headingColor}
                  onChange={(value) => setFormData({ ...formData, headingColor: value })}
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
              <CardDescription>Font styles (applies to ALL pages)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Body Font</Label>
                <Select
                  value={formData.fontFamily}
                  onValueChange={(value) => setFormData({ ...formData, fontFamily: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONTS.map((font) => (
                      <SelectItem key={font.id} value={font.id}>
                        <div>
                          <div className="font-semibold">{font.name}</div>
                          <div className="text-xs text-gray-500">{font.description}</div>
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
                  onValueChange={(value) => setFormData({ ...formData, headingFontFamily: value as any })}
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
                          <div className="text-xs text-gray-500">{font.description}</div>
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
                  onValueChange={(value) => setFormData({ ...formData, fontSize: value as any })}
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
              <CardTitle>Button Styles</CardTitle>
              <CardDescription>Customize button appearance (applies to ALL pages)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Button Shape</Label>
                <Select
                  value={formData.buttonStyle}
                  onValueChange={(value) => setFormData({ ...formData, buttonStyle: value as any })}
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
                  onValueChange={(value) => setFormData({ ...formData, buttonSize: value as any })}
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
                  onValueChange={(value) => setFormData({ ...formData, borderRadius: value as any })}
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
                  onValueChange={(value) => setFormData({ ...formData, spacing: value as any })}
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
                  onValueChange={(value) => setFormData({ ...formData, shadowStyle: value as any })}
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

        {/* CONTENT TAB */}
        <TabsContent value="content" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Home Page Content</CardTitle>
              <CardDescription>Customize your homepage text (editable by you)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Hero Title</Label>
                <Input
                  value={formData.homeHeroTitle}
                  onChange={(e) => setFormData({ ...formData, homeHeroTitle: e.target.value })}
                  placeholder="Welcome to Your Medical Cannabis Journey"
                />
              </div>
              <div>
                <Label>Hero Subtitle</Label>
                <Textarea
                  value={formData.homeHeroSubtitle}
                  onChange={(e) => setFormData({ ...formData, homeHeroSubtitle: e.target.value })}
                  placeholder="Premium medical cannabis products delivered with care"
                  rows={2}
                />
              </div>
              <div>
                <Label>Hero Button Text</Label>
                <Input
                  value={formData.homeHeroCtaText}
                  onChange={(e) => setFormData({ ...formData, homeHeroCtaText: e.target.value })}
                  placeholder="Get Started"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>About Page Content</CardTitle>
              <CardDescription>Tell your story (editable by you)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Page Title</Label>
                <Input
                  value={formData.aboutTitle}
                  onChange={(e) => setFormData({ ...formData, aboutTitle: e.target.value })}
                  placeholder="About Us"
                />
              </div>
              <div>
                <Label>About Content</Label>
                <Textarea
                  value={formData.aboutContent}
                  onChange={(e) => setFormData({ ...formData, aboutContent: e.target.value })}
                  placeholder="We are dedicated to providing high-quality medical cannabis products..."
                  rows={6}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact Page Content</CardTitle>
              <CardDescription>Your contact information (editable by you)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Page Title</Label>
                <Input
                  value={formData.contactTitle}
                  onChange={(e) => setFormData({ ...formData, contactTitle: e.target.value })}
                  placeholder="Get in Touch"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.contactDescription}
                  onChange={(e) => setFormData({ ...formData, contactDescription: e.target.value })}
                  placeholder="Have questions? We're here to help."
                  rows={2}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  placeholder="info@yourstore.com"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  placeholder="+351 123 456 789"
                />
              </div>
              <div>
                <Label>Address</Label>
                <Textarea
                  value={formData.contactAddress}
                  onChange={(e) => setFormData({ ...formData, contactAddress: e.target.value })}
                  placeholder="123 Medical Lane, Lisbon, Portugal"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">ℹ️ Content Management Note</h4>
            <p className="text-sm text-blue-800">
              <strong>Personal Pages (You Control):</strong> Home, About, Contact - Edit text here.<br />
              <strong>Country-Based Pages (API Control):</strong> Products, Medical Conditions, How It Works, Consultation, Education - Content comes from your country's regulations and our CRM. You can only customize the theme/colors for these pages.
            </p>
          </div>
        </TabsContent>

        {/* ADVANCED TAB */}
        <TabsContent value="advanced" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Custom CSS</CardTitle>
              <CardDescription>Add custom CSS for advanced styling (applies to ALL pages)</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.customCSS}
                onChange={(e) => setFormData({ ...formData, customCSS: e.target.value })}
                placeholder=".my-custom-class { color: red; }"
                rows={10}
                className="font-mono text-sm"
              />
              <p className="text-sm text-gray-500 mt-2">
                Advanced users only. Use CSS selectors to override default styles.
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
                href={`https://healingbuds.abacusai.app/store/${tenant.subdomain}`}
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

      {/* Submit Button - Fixed at Bottom */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 mt-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            ✨ Changes apply to <strong>ALL pages</strong> in your store
          </p>
          <Button type="submit" disabled={isLoading} size="lg" className="min-w-[200px]">
            {isLoading ? 'Saving...' : 'Save All Changes'}
          </Button>
        </div>
      </div>
    </form>
  );
}

// Color Picker Component
function ColorPicker({ label, description, value, onChange }: {
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
function FileUpload({ label, description, accept, onChange, file }: {
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
            <p className="text-sm text-gray-600">Click to upload or drag and drop</p>
          )}
        </label>
      </div>
    </div>
  );
}
