import dynamic from "next/dynamic";
import React from "react";

/**
 * Registry of available storefront templates (LEGACY React-based).
 *
 * ⚠️  This registry is for legacy React templates ONLY.
 * All templates have been migrated to data-only format (layout.json).
 * New templates use the section-registry.ts system instead.
 *
 * NOTE: healingbuds, gta-cannabis, and wellness-nature have all been
 * migrated to data-only format. They no longer need React component entries here.
 *
 * Last updated: 2026-02-11
 */

export const TEMPLATE_COMPONENTS: Record<string, any> = {
  // All templates migrated to data-only format
};

/**
 * Registry of template-specific Navigation components.
 * Templates without a specific navigation will use the default platform navigation.
 */
export const TEMPLATE_NAVIGATION: Record<string, any> = {
  // All templates migrated to data-only format
};

/**
 * Registry of template-specific Footer components.
 * Templates without a specific footer will use the default platform footer.
 */
export const TEMPLATE_FOOTER: Record<string, any> = {
  // All templates migrated to data-only format
};

