'use client';

import React from 'react';
import { SectionProps } from '@/lib/types/section-props';

const SPLIT_MAP: Record<string, { left: string; right: string; leftPct: number }> = {
  '30/70': { left: 'w-[30%]', right: 'w-[70%]', leftPct: 30 },
  '40/60': { left: 'w-[40%]', right: 'w-[60%]', leftPct: 40 },
  '50/50': { left: 'w-[50%]', right: 'w-[50%]', leftPct: 50 },
  '60/40': { left: 'w-[60%]', right: 'w-[40%]', leftPct: 60 },
  '70/30': { left: 'w-[70%]', right: 'w-[30%]', leftPct: 70 },
};

export function HeroCollage(props: SectionProps) {
  const { sectionConfig, tenant } = props;

  const heading = sectionConfig?.heading || tenant?.businessName || 'Your Brand';
  const subtitle = sectionConfig?.subtitle || '';
  const leftImage = sectionConfig?.imageUrl || props.heroImageUrl || '';
  const rightImage = sectionConfig?.rightImageUrl || '';
  const watermarkImage = sectionConfig?.watermarkUrl || props.logoUrl || '';
  const splitRatio = sectionConfig?.splitRatio || '40/60';
  const textPosition = sectionConfig?.textPosition || 'bottom-right';
  const watermarkOpacity = parseFloat(sectionConfig?.watermarkOpacity ?? '0.4');
  const borderWidth = sectionConfig?.borderWidth || 'medium';
  const height = sectionConfig?.height || 'large';
  const ctaText = sectionConfig?.ctaText || '';
  const ctaHref = sectionConfig?.ctaHref || '/products';
  const showVerticalText = sectionConfig?.showVerticalText !== 'no';

  const split = SPLIT_MAP[splitRatio] || SPLIT_MAP['40/60'];

  const borderMap: Record<string, string> = {
    none: 'p-0',
    thin: 'p-2',
    medium: 'p-3 sm:p-4',
    thick: 'p-4 sm:p-6',
  };

  const heightMap: Record<string, string> = {
    medium: 'min-h-[50vh]',
    large: 'min-h-[70vh]',
    full: 'min-h-[calc(100dvh-4rem)]',
  };

  const borderClass = borderMap[borderWidth] || borderMap.medium;
  const heightClass = heightMap[height] || heightMap.large;

  // Text positioning — constrained within the right panel
  const rightPct = 100 - split.leftPct;
  const textPositionStyles: Record<string, React.CSSProperties> = {
    'bottom-right': { position: 'absolute', bottom: '2rem', right: '1.5rem', textAlign: 'right', maxWidth: `calc(${rightPct}% - 3rem)` },
    'bottom-left': { position: 'absolute', bottom: '2rem', left: `calc(${split.leftPct}% + 1.5rem)`, textAlign: 'left', maxWidth: `calc(${rightPct}% - 3rem)` },
    'center-right': { position: 'absolute', top: '50%', right: '1.5rem', transform: 'translateY(-50%)', textAlign: 'right', maxWidth: `calc(${rightPct}% - 3rem)` },
    'center': { position: 'absolute', top: '50%', left: `calc(${split.leftPct}% + ${rightPct / 2}%)`, transform: 'translate(-50%, -50%)', textAlign: 'center', maxWidth: `calc(${rightPct}% - 2rem)` },
    'vertical-right': { position: 'absolute', top: '50%', right: '1rem', transform: 'translateY(-50%) rotate(180deg)', writingMode: 'vertical-rl' as const, textAlign: 'center' },
  };

  const isValidSrc = (src: string) => !!src && (src.startsWith('http') || src.startsWith('/') || src.startsWith('data:'));

  return (
    <section
      className={`${borderClass} relative overflow-hidden`}
      style={{ backgroundColor: 'hsl(var(--tenant-color-background, 0 0% 95%))' }}
    >
      <div className={`relative ${heightClass} overflow-hidden flex`}>
        {/* Left panel — main image */}
        <div className={`${split.left} relative shrink-0 overflow-hidden`}>
          {isValidSrc(leftImage) ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={leftImage}
              alt={heading}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full"
              style={{ backgroundColor: 'hsl(var(--tenant-color-primary) / 0.3)' }}
            />
          )}
        </div>

        {/* Right panel — second image or gradient */}
        <div className={`${split.right} relative shrink-0 overflow-hidden`}>
          {isValidSrc(rightImage) ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={rightImage}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full"
              style={{
                background: `linear-gradient(135deg, hsl(var(--tenant-color-primary) / 0.3), hsl(var(--tenant-color-secondary, var(--tenant-color-primary)) / 0.15))`,
              }}
            />
          )}

          {/* Vertical text on right edge */}
          {showVerticalText && (
            <div
              className="absolute top-0 right-0 bottom-0 w-10 sm:w-14 flex items-center justify-center pointer-events-none select-none overflow-hidden"
              style={{
                writingMode: 'vertical-rl',
                transform: 'rotate(180deg)',
              }}
            >
              <span
                className="text-base sm:text-xl md:text-2xl font-bold tracking-[0.25em] uppercase whitespace-nowrap"
                style={{
                  fontFamily: 'var(--tenant-font-heading, sans-serif)',
                  color: 'hsl(var(--tenant-color-heading, 0 0% 100%) / 0.18)',
                }}
              >
                {heading}
              </span>
            </div>
          )}
        </div>

        {/* Center watermark — overlapping both panels */}
        {isValidSrc(watermarkImage) && (
          <div
            className="absolute z-10 pointer-events-none"
            style={{
              left: `calc(${split.leftPct}% - 4rem)`,
              top: '20%',
              width: 'clamp(100px, 18vw, 220px)',
              height: 'clamp(140px, 25vw, 300px)',
              opacity: watermarkOpacity,
            }}
          >
            <div
              className="w-full h-full relative rounded-md overflow-hidden backdrop-blur-sm flex items-center justify-center"
              style={{ backgroundColor: 'hsl(var(--tenant-color-background, 0 0% 50%) / 0.3)' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={watermarkImage}
                alt=""
                className="max-w-[80%] max-h-[80%] object-contain"
              />
            </div>
          </div>
        )}

        {/* Main text overlay — constrained to right panel */}
        <div
          className="z-20 overflow-hidden"
          style={textPositionStyles[textPosition] || textPositionStyles['bottom-right']}
        >
          <h1
            className={`font-bold mb-2 uppercase leading-[0.95] break-words ${
              textPosition === 'vertical-right'
                ? 'text-xl sm:text-2xl tracking-[0.15em]'
                : 'text-2xl sm:text-3xl md:text-4xl lg:text-5xl'
            }`}
            style={{
              fontFamily: 'var(--tenant-font-heading, sans-serif)',
              color: 'hsl(var(--tenant-color-heading, 0 0% 20%))',
            }}
          >
            {heading}
          </h1>
          {subtitle && textPosition !== 'vertical-right' && (
            <p
              className="text-sm sm:text-base mb-3"
              style={{ color: 'hsl(var(--tenant-color-text, 0 0% 30%))' }}
            >
              {subtitle}
            </p>
          )}
          {ctaText && textPosition !== 'vertical-right' && (
            <a
              href={ctaHref}
              className="inline-block px-5 py-2.5 text-xs sm:text-sm font-semibold uppercase tracking-wider rounded transition-opacity hover:opacity-90"
              style={{
                backgroundColor: 'hsl(var(--tenant-color-primary))',
                color: 'hsl(var(--tenant-color-background, 0 0% 100%))',
              }}
            >
              {ctaText}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
