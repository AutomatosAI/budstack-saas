'use client';

import { useMemo } from 'react';
import { getSectionComponent } from '@/lib/section-registry';
import type { SectionProps } from '@/lib/types/section-props';
import type { TemplateLayout } from '@/lib/types/template-layout';
import { motion } from 'framer-motion';
import { sanitizeCss } from '@/lib/css-utils';
import { hexToHsl } from '@/lib/color-utils';

interface Props {
  layout: TemplateLayout;
  sectionProps: SectionProps;
  customCss?: string | null;
  renderChrome?: boolean; // When false, skip nav/footer (layout handles them)
}

// --- SVG Divider Helpers ---
function WaveDivider({ fill = "var(--tenant-bg, #ffffff)", className = "" }: { fill?: string, className?: string }) {
  return (
    <div className={`w-full overflow-hidden leading-none relative z-10 -ml-1 ${className}`} style={{ marginTop: '-1px' }}>
      <svg className="relative block w-[calc(100%+1.3px)] h-[50px] sm:h-[100px]" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
        <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" fill={fill} />
      </svg>
    </div>
  );
}

function SlantDivider({ fill = "var(--tenant-bg, #ffffff)", className = "" }: { fill?: string, className?: string }) {
  return (
    <div className={`w-full overflow-hidden leading-none relative z-10 ${className}`} style={{ marginTop: '-1px' }}>
      <svg className="relative block w-full h-[50px] sm:h-[100px]" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
        <path d="M1200 120L0 16.48V0h1200v120z" fill={fill} />
      </svg>
    </div>
  );
}

function CurveDivider({ fill = "var(--tenant-bg, #ffffff)", className = "" }: { fill?: string, className?: string }) {
  return (
    <div className={`w-full overflow-hidden leading-none relative z-10 ${className}`} style={{ marginTop: '-1px' }}>
      <svg className="relative block w-[calc(100%+1.3px)] h-[50px] sm:h-[100px]" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
        <path d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z" opacity=".25" fill={fill} />
        <path d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z" opacity=".5" fill={fill} />
        <path d="M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V0Z" fill={fill} />
      </svg>
    </div>
  );
}
// --- End SVG Helpers ---


/** Build inline CSS variable overrides from a colorOverrides object.
 *  Optional `defaults` are applied first, then overrides layer on top. */
function buildColorOverrideStyle(
  overrides?: Record<string, string>,
  defaults?: Record<string, string>,
): React.CSSProperties {
  const style: Record<string, string> = {};
  // Apply defaults first
  if (defaults) {
    for (const [k, v] of Object.entries(defaults)) {
      if (v) style[`--tenant-color-${k}`] = v;
    }
  }
  // Apply explicit overrides on top
  if (overrides) {
    for (const [k, v] of Object.entries(overrides)) {
      if (v && typeof v === 'string' && v.trim()) {
        const hslValue = v.startsWith('#') ? hexToHsl(v) : v;
        style[`--tenant-color-${k}`] = hslValue;
      }
    }
  }
  return style;
}

/** Dark defaults for FooterBrand / FooterFull — prevents white-on-white
 *  when no footer color overrides are set. */
const DARK_FOOTER_DEFAULTS: Record<string, string> = {
  background: '220 15% 10%',
  text: '0 0% 100%',
  heading: '0 0% 100%',
  border: '0 0% 100%',
};

export function TemplateRenderer({ layout, sectionProps, customCss, renderChrome = true }: Props) {
  const showChrome = renderChrome;
  const navType = layout.navigation || 'NavDark';
  const footerType = layout.footer || 'FooterBrand';
  const NavComponent = showChrome ? getSectionComponent(navType) : null;
  const FooterComponent = showChrome ? getSectionComponent(footerType) : null;
  const sanitizedCss = useMemo(() => sanitizeCss(customCss), [customCss]);

  // Generate per-section color override CSS from layout sections
  const sectionColorCss = useMemo(() => {
    return layout.sections
      .filter(s => s.id && s.colorOverrides)
      .map(s => {
        const declarations = Object.entries(s.colorOverrides!)
          .filter(([, v]) => v?.trim())
          .map(([k, v]) => {
            // Convert hex (#abc123) to HSL channel format (H S% L%) so
            // hsl(var(--tenant-color-*)) works in section components.
            const hslValue = v!.startsWith('#') ? hexToHsl(v!) : v;
            return `--tenant-color-${k}: ${hslValue}`;
          })
          .join('; ');
        if (!declarations) return '';
        // Use CSS.escape when available (browser), fallback to simple escaping (SSR)
        const escaped = typeof globalThis.CSS?.escape === 'function'
          ? globalThis.CSS.escape(s.id!)
          : s.id!.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
        return `#${escaped} { ${declarations}; }`;
      })
      .filter(Boolean)
      .join('\n');
  }, [layout.sections]);

  // Generate section padding overrides from layout.settings.sectionPadding
  // This is rendered server-side so it doesn't depend on S3 CSS loading
  const sectionPaddingCss = useMemo(() => {
    const padding = layout.settings?.sectionPadding;
    if (!padding) return '';
    const heroTypes = ['HeroFullScreen', 'HeroSplit', 'HeroVideo', 'HeroMinimal', 'HeroCollage', 'HeroFramed'];
    const selectors = layout.sections
      .filter(s => s.visible !== false && s.id && !heroTypes.includes(s.type))
      .map(s => `#${s.id} > section, #${s.id} > div`);
    if (selectors.length === 0) return '';
    // Support responsive: "2rem" or "2rem/3rem/3.5rem" (mobile/sm/md)
    const parts = padding.split('/').map((p: string) => p.trim());
    let css = `${selectors.join(',\n')} {\n  padding-top: ${parts[0]} !important;\n  padding-bottom: ${parts[0]} !important;\n}`;
    if (parts[1]) {
      css += `\n@media (min-width: 640px) {\n  ${selectors.join(',\n  ')} {\n    padding-top: ${parts[1]} !important;\n    padding-bottom: ${parts[1]} !important;\n  }\n}`;
    }
    if (parts[2]) {
      css += `\n@media (min-width: 768px) {\n  ${selectors.join(',\n  ')} {\n    padding-top: ${parts[2]} !important;\n    padding-bottom: ${parts[2]} !important;\n  }\n}`;
    }
    return css;
  }, [layout]);

  return (
    <div className={showChrome ? `min-h-screen ${layout.settings?.wrapperClass || ''}` : (layout.settings?.wrapperClass || '')}>
      {/* Load Google Fonts if specified */}
      {layout.settings?.googleFontsUrl && (
        // eslint-disable-next-line @next/next/no-page-custom-font
        <link href={layout.settings.googleFontsUrl} rel="stylesheet" />
      )}
      {/* Must use dangerouslySetInnerHTML — React escapes > to \u003e in JSX children, breaking CSS child combinators */}
      {sanitizedCss && (
        <style dangerouslySetInnerHTML={{ __html: sanitizedCss }} />
      )}
      {sectionPaddingCss && (
        <style dangerouslySetInnerHTML={{ __html: sectionPaddingCss }} />
      )}
      {sectionColorCss && (
        <style dangerouslySetInnerHTML={{ __html: sanitizeCss(sectionColorCss) || '' }} />
      )}
      {NavComponent && (
        <div style={buildColorOverrideStyle(layout.navigationConfig?.colorOverrides)}>
          <NavComponent {...sectionProps} sectionConfig={layout.navigationConfig || sectionProps.sectionConfig} />
        </div>
      )}
      {layout.sections
        .filter(s => s.visible !== false)
        .map((section, i, arr) => {
          const Component = getSectionComponent(section.type);
          if (!Component) return null;

          const animationType = sectionProps.tenant?.settings?.animationType || "none";
          const dividerStyle = sectionProps.tenant?.settings?.dividerStyle || "none";

          let initial = {};
          let whileInView = {};
          let viewport = { once: true, margin: "-100px" };
          let transition = { duration: 0.6, ease: "easeOut" };

          if (animationType === "fade-up") {
            initial = { opacity: 0, y: 40 };
            whileInView = { opacity: 1, y: 0 };
          } else if (animationType === "slide-right") {
            initial = { opacity: 0, x: -40 };
            whileInView = { opacity: 1, x: 0 };
          } else if (animationType === "zoom-in") {
            initial = { opacity: 0, scale: 0.95 };
            whileInView = { opacity: 1, scale: 1 };
          }

          const isAnimated = animationType !== "none";

          // Map sectionConfig.imageUrl → heroImageUrl prop for any section that uses it.
          // Heroes (HeroFullScreen, HeroSplit, etc.) and CTAs (CTAWithImage, CTASplit) all
          // accept heroImageUrl as a prop. Sections that don't use it simply ignore the prop.
          // Accept any non-empty string — signed URLs (http), raw S3 keys, or local paths.
          const configImage = section.config?.imageUrl;
          const heroImageOverride = configImage && typeof configImage === 'string' && configImage.trim()
            ? configImage
            : undefined;

          // Build inline CSS variable overrides for per-section colors
          const colorOverrideStyle: React.CSSProperties = {};
          if (section.colorOverrides) {
            for (const [k, v] of Object.entries(section.colorOverrides)) {
              if (v && typeof v === 'string' && v.trim()) {
                const hslValue = v.startsWith('#') ? hexToHsl(v) : v;
                (colorOverrideStyle as any)[`--tenant-color-${k}`] = hslValue;
              }
            }
          }

          const sectionElement = (
            <section
              key={section.id || `section-${i}`}
              id={section.id}
              className="relative"
              style={Object.keys(colorOverrideStyle).length > 0 ? colorOverrideStyle : undefined}
            >
              <Component
                {...sectionProps}
                sectionId={section.id}
                sectionConfig={section.config || {}}
                {...(heroImageOverride ? { heroImageUrl: heroImageOverride } : {})}
              />
            </section>
          );

          // Render divider BEFORE the section if it is not the first section
          let dividerElement = null;
          if (i > 0 && dividerStyle !== "none") {
            // Determine the background color of the PREVIOUS section to fill the top of the divider
            // Currently, this assumes the previous section's background matches the body background by default
            const prevSection = arr[i - 1];
            // If the section config has a specific bgColor, use that. Otherwise default to the body background.
            // Ideally this would be passed down, but for this PRD we use the base body color
            const prevColor = prevSection.config?.backgroundColor || "var(--tenant-bg, #ffffff)";

            if (dividerStyle === "wave") dividerElement = <WaveDivider fill={prevColor} />;
            if (dividerStyle === "slant") dividerElement = <SlantDivider fill={prevColor} />;
            if (dividerStyle === "curve") dividerElement = <CurveDivider fill={prevColor} />;
          }

          const wrapper = isAnimated ? (
            <motion.div
              key={section.id || `section-wrapper-${i}`}
              initial={initial}
              whileInView={whileInView}
              viewport={viewport}
              transition={transition}
            >
              {dividerElement}
              {sectionElement}
            </motion.div>
          ) : (
            <div key={section.id || `section-wrapper-${i}`}>
              {dividerElement}
              {sectionElement}
            </div>
          );

          return wrapper;
        })}
      {FooterComponent && (
        <div style={buildColorOverrideStyle(
          layout.footerConfig?.colorOverrides,
          (footerType === 'FooterBrand' || footerType === 'FooterFull') ? DARK_FOOTER_DEFAULTS : undefined,
        )}>
          <FooterComponent {...sectionProps} sectionConfig={layout.footerConfig || sectionProps.sectionConfig} />
        </div>
      )}
    </div>
  );
}
