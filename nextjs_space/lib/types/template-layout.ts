export interface LayoutSection {
  type: string;
  id?: string;
  config?: Record<string, any>;
  visible?: boolean;
}

export interface TemplateLayout {
  version: string;
  navigation: string;
  sections: LayoutSection[];
  footer: string;
  settings?: {
    wrapperClass?: string;
    googleFontsUrl?: string;
    sectionPadding?: string; // e.g. "2rem" or "2rem/3rem/3.5rem" (mobile/sm/md)
  };
}
