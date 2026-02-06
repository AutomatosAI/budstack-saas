export interface SectionProps {
  tenant: { businessName: string; subdomain: string; [k: string]: any };
  consultationUrl: string;
  productsUrl: string;
  contactUrl: string;
  aboutUrl: string;
  heroImageUrl?: string | null;
  logoUrl?: string | null;
  designSystem?: any;
  pageContent?: any;
  navigation?: any;
  footer?: any;
  valueProps?: Array<{ title: string; description: string; icon: string }>;
  posts?: any[];
  sectionConfig?: Record<string, any>;
}
