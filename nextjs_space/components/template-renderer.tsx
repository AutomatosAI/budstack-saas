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

  return (
    <div className={showChrome ? `min-h-screen ${layout.settings?.wrapperClass || ''}` : ''}>
      {/* Load Google Fonts if specified */}
      {layout.settings?.googleFontsUrl && (
        // eslint-disable-next-line @next/next/no-page-custom-font
        <link href={layout.settings.googleFontsUrl} rel="stylesheet" />
      )}
      {sanitizedCss && (
        <style>{sanitizedCss}</style>
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
