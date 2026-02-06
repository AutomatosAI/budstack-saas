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
  };
}
