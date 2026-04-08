'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Image from 'next/image';
import { SectionProps } from '@/lib/types/section-props';

// Hardcoded SVG icons — safe for dangerouslySetInnerHTML (no user input)
const ICON_SVGS: Record<string, string> = {
  leaf: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 2c1 2 2 4.5 1 8-1.5 5.5-4 8-9 10z"/><path d="M10.7 20.7c1.5-4.5 0-8.5-3.7-11.7"/></svg>`,
  cannabis: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-4"/><path d="M7 12c-1.5 0-4.5 1.5-5 3.5 2.5 0 4.5-1 5.5-2 .5 1.5 1.5 2.5 2.5 3.5-2 1-4 2-6 2 3 0 5.5-1 7-3 1.5 2 4 3 7 3-2 0-4-1-6-2 1-1 2-2 2.5-3.5 1 1 3 2 5.5 2-.5-2-3.5-3.5-5-3.5 1.5-1 3-3.5 3-6.5-2 1-3.5 3-4 5-.5-2-1.5-4.5-3-6-.5 2.5-1 4-1.5 5-.5-2-2-4-4-5 0 3 1.5 5.5 3 6.5z"/></svg>`,
  droplet: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
  sparkle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/></svg>`,
};

const FONT_SIZE_MAP: Record<string, string> = {
  sm: 'text-xl sm:text-2xl',
  md: 'text-2xl sm:text-3xl md:text-4xl',
  lg: 'text-3xl sm:text-4xl md:text-5xl',
  xl: 'text-4xl sm:text-5xl md:text-6xl lg:text-7xl',
};

const HEIGHT_MAP: Record<string, string> = {
  sm: '2.5rem',
  md: '3.5rem',
  lg: '4.5rem',
  xl: '6rem',
};

const FONT_STYLE_MAP: Record<string, string> = {
  serif: 'font-serif',
  sans: 'font-sans',
  'italic-serif': 'font-serif italic',
  'italic-sans': 'font-sans italic',
  mono: 'font-mono',
  'uppercase-sans': 'font-sans uppercase tracking-widest',
  'uppercase-serif': 'font-serif uppercase tracking-wider',
  'light-serif': 'font-serif font-light',
  'light-sans': 'font-sans font-light',
  'bold-sans': 'font-sans font-bold',
};

export function TextMarquee(props: SectionProps) {
  const { sectionConfig, logoUrl: propLogoUrl } = props;

  const text = sectionConfig?.text || 'Premium wellness products crafted with care';
  const logoUrl = sectionConfig?.logoUrl || propLogoUrl || null;
  const icon = sectionConfig?.icon || 'leaf';
  const speed = sectionConfig?.speed || 40;
  const reverse = sectionConfig?.reverse || false;
  const fontSize = sectionConfig?.fontSize || 'lg';
  const fontStyle = sectionConfig?.fontStyle || 'italic-serif';
  const repeat = sectionConfig?.repeat || 4;
  const showBorder = sectionConfig?.showBorder === true || sectionConfig?.showBorder === 'true';

  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  const sizeClass = FONT_SIZE_MAP[fontSize] || FONT_SIZE_MAP.lg;
  const styleClass = FONT_STYLE_MAP[fontStyle] || FONT_STYLE_MAP['italic-serif'];
  const trackHeight = HEIGHT_MAP[fontSize] || HEIGHT_MAP.lg;
  const duration = Math.max(10, (100 - speed) * 0.6);

  // Only use hardcoded SVGs — no user-supplied HTML
  const iconSvg = ICON_SVGS[icon] || ICON_SVGS.leaf;

  const bgColor = sectionConfig?.bgColor || 'hsl(var(--tenant-color-surface))';
  const borderColor = 'hsl(var(--tenant-color-border))';

  const renderSeparator = () => {
    if (logoUrl) {
      return (
        <span className="inline-block mx-4 sm:mx-6 align-middle relative w-8 h-8 sm:w-10 sm:h-10">
          <Image src={logoUrl} alt="" fill className="object-contain" sizes="40px" />
        </span>
      );
    }
    return (
      <span
        className="inline-block mx-4 sm:mx-6 align-middle w-8 h-8 sm:w-10 sm:h-10 opacity-70"
        style={{ color: 'hsl(var(--tenant-color-text))' }}
        // Safe: iconSvg is from hardcoded ICON_SVGS map, never user input
        dangerouslySetInnerHTML={{ __html: iconSvg }}
      />
    );
  };

  const blocks = Array.from({ length: repeat }, (_, i) => (
    <span key={i} className="inline-flex items-center whitespace-nowrap">
      <span>{text}</span>
      {renderSeparator()}
    </span>
  ));

  return (
    <section
      ref={ref}
      className="py-3 sm:py-4"
      style={{
        contain: 'inline-size',
        overflow: 'clip',
        backgroundColor: bgColor,
        borderTop: showBorder ? `1px solid ${borderColor}` : undefined,
        borderBottom: showBorder ? `1px solid ${borderColor}` : undefined,
      }}
    >
      <div className="relative w-full" style={{ overflow: 'clip', height: trackHeight }}>
        <div
          className="absolute left-0 top-0 bottom-0 w-16 sm:w-32 z-10 pointer-events-none"
          style={{ background: `linear-gradient(to right, ${bgColor}, transparent)` }}
        />
        <div
          className="absolute right-0 top-0 bottom-0 w-16 sm:w-32 z-10 pointer-events-none"
          style={{ background: `linear-gradient(to left, ${bgColor}, transparent)` }}
        />

        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8 }}
          className={`items-center ${sizeClass} ${styleClass}`}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            display: 'flex',
            width: 'max-content',
            color: sectionConfig?.textColor || 'hsl(var(--tenant-color-text))',
            animation: `text-marquee-scroll ${duration}s linear infinite ${reverse ? 'reverse' : ''}`,
            fontFamily: fontStyle === 'sans' || fontStyle === 'italic-sans' || fontStyle === 'uppercase-sans' || fontStyle === 'light-sans' || fontStyle === 'bold-sans'
              ? 'var(--tenant-font-body, sans-serif)'
              : fontStyle === 'mono' ? 'ui-monospace, monospace'
              : 'var(--tenant-font-heading, serif)',
          }}
        >
          {/* Double for seamless loop */}
          <span className="inline-flex items-center">{blocks}</span>
          <span className="inline-flex items-center">{blocks}</span>
        </motion.div>
      </div>

      <style jsx>{`
        @keyframes text-marquee-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}
