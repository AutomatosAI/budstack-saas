import dynamic from "next/dynamic";
import React from "react";

/**
 * Registry of available storefront templates.
 * Using dynamic imports to avoid bundling templates that aren't used,
 * and to prevent build errors from missing template folders.
 */
export const TEMPLATE_COMPONENTS: Record<string, any> = {
  healingbuds: dynamic(() => import("@/templates/healingbuds/index")),
  "wellness-nature": dynamic(() => import("@/templates/wellness-nature/index")),
  "gta-cannabis": dynamic(() => import("@/templates/gta-cannabis/index")),
};

/**
 * Registry of template-specific Navigation components.
 * Templates without a specific navigation will use the default platform navigation.
 */
export const TEMPLATE_NAVIGATION: Record<string, any> = {
  healingbuds: dynamic(
    () => import("@/templates/healingbuds/components/Navigation"),
  ),
  "wellness-nature": dynamic(
    () => import("@/templates/wellness-nature/components/Navigation"),
  ),
  "gta-cannabis": dynamic(() =>
    import("@/templates/gta-cannabis/components/Navigation").then((m) => {
      // GTA Cannabis uses a named export 'Navigation'
      const mod = m as any;
      if (mod.Navigation) return mod.Navigation;
      return mod.default || mod;
    }),
  ),
};

/**
 * Registry of template-specific Footer components.
 * Templates without a specific footer will use the default platform footer.
 */
export const TEMPLATE_FOOTER: Record<string, any> = {
  healingbuds: dynamic(
    () => import("@/templates/healingbuds/components/Footer"),
  ),
  "wellness-nature": dynamic(
    () => import("@/templates/wellness-nature/components/Footer"),
  ),
  "gta-cannabis": dynamic(
    () => import("@/templates/gta-cannabis/components/Footer"),
  ),
};
