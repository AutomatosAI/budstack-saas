export interface SectionColorOverrides {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  surface?: string;
  text?: string;
  heading?: string;
  border?: string;
}

export interface LayoutSection {
  type: string;
  id?: string;
  config?: Record<string, any>;
  visible?: boolean;
  colorOverrides?: SectionColorOverrides;
}

export interface TemplateLayout {
  version: string;
  navigation: string;
  navigationConfig?: Record<string, any>;
  sections: LayoutSection[];
  footer: string;
  footerConfig?: Record<string, any>;
  settings?: {
    wrapperClass?: string;
    googleFontsUrl?: string;
    sectionPadding?: string; // e.g. "2rem" or "2rem/3rem/3.5rem" (mobile/sm/md)
  };
}
