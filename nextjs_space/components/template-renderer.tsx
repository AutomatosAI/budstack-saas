'use client';

import { useMemo } from 'react';
import { getSectionComponent } from '@/lib/section-registry';
import type { SectionProps } from '@/lib/types/section-props';
import type { TemplateLayout } from '@/lib/types/template-layout';

interface Props {
  layout: TemplateLayout;
  sectionProps: SectionProps;
  customCss?: string | null;
  renderChrome?: boolean; // When false, skip nav/footer (layout handles them)
}

function sanitizeCss(css?: string | null): string {
  if (!css) return '';
  return css
    .replace(/@import[^;]+;/gi, '')
    .replace(/url\([^)]+\)/gi, '')
    .replace(/expression\([^)]+\)/gi, '');
}

export function TemplateRenderer({ layout, sectionProps, customCss, renderChrome = true }: Props) {
  const showChrome = renderChrome;
  const NavComponent = showChrome ? getSectionComponent(layout.navigation) : null;
  const FooterComponent = showChrome ? getSectionComponent(layout.footer) : null;
  const sanitizedCss = useMemo(() => sanitizeCss(customCss), [customCss]);

  // Generate section padding overrides from layout.settings.sectionPadding
  // This is rendered server-side so it doesn't depend on S3 CSS loading
  const sectionPaddingCss = useMemo(() => {
    const padding = layout.settings?.sectionPadding;
    if (!padding) return '';
    const heroTypes = ['HeroFullScreen', 'HeroSplit', 'HeroVideo', 'HeroMinimal'];
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
      {sanitizedCss && (
        <style>{sanitizedCss}</style>
      )}
      {sectionPaddingCss && (
        <style>{sectionPaddingCss}</style>
      )}
      {NavComponent && <NavComponent {...sectionProps} />}
      {layout.sections
        .filter(s => s.visible !== false)
        .map((section, i) => {
          const Component = getSectionComponent(section.type);
          if (!Component) return null;
          return (
            <section key={section.id || `section-${i}`} id={section.id}>
              <Component {...sectionProps} sectionConfig={section.config || {}} />
            </section>
          );
        })}
      {FooterComponent && <FooterComponent {...sectionProps} />}
    </div>
  );
}
