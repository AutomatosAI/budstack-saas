'use client';

import React from 'react';
import Image from 'next/image';
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

  // Text positioning — contained within the right panel
  const rightPct = 100 - split.leftPct;
  const textPositionStyles: Record<string, React.CSSProperties> = {
    'bottom-right': { position: 'absolute', bottom: '2rem', right: '1.5rem', textAlign: 'right', maxWidth: `${rightPct - 8}%` },
    'bottom-left': { position: 'absolute', bottom: '2rem', left: `${split.leftPct + 2}%`, textAlign: 'left', maxWidth: `${rightPct - 8}%` },
    'center-right': { position: 'absolute', top: '50%', right: '1.5rem', transform: 'translateY(-50%)', textAlign: 'right', maxWidth: `${rightPct - 8}%` },
    'center': { position: 'absolute', top: '50%', left: `${split.leftPct + rightPct / 2}%`, transform: 'translate(-50%, -50%)', textAlign: 'center', maxWidth: `${rightPct - 6}%` },
    'vertical-right': { position: 'absolute', top: '50%', right: '1.5rem', transform: 'translateY(-50%) rotate(180deg)', writingMode: 'vertical-rl' as const, textAlign: 'center' },
  };

  // Check if images are valid (non-empty, starts with http or /)
  const isValidSrc = (src: string) => src && (src.startsWith('http') || src.startsWith('/'));

  return (
    <section
      className={`${borderClass} relative overflow-hidden`}
      style={{ backgroundColor: 'hsl(var(--tenant-color-background, 0 0% 95%))' }}
    >
      {/* Inner container with the collage */}
      <div className={`relative ${heightClass} overflow-hidden flex`}>
        {/* Left panel — main image */}
        <div className={`${split.left} relative shrink-0`}>
          {isValidSrc(leftImage) ? (
            <Image
              src={leftImage}
              alt={heading}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
            />
          ) : (
            <div
              className="w-full h-full"
              style={{ backgroundColor: 'hsl(var(--tenant-color-primary) / 0.3)' }}
            />
          )}
        </div>

        {/* Right panel — gradient/color or second image */}
        <div className={`${split.right} relative shrink-0`}>
          {isValidSrc(rightImage) ? (
            <Image
              src={rightImage}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
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
              className="absolute top-0 right-0 bottom-0 w-12 sm:w-16 flex items-center justify-center pointer-events-none select-none overflow-hidden"
              style={{
                writingMode: 'vertical-rl',
                transform: 'rotate(180deg)',
              }}
            >
              <span
                className="text-lg sm:text-2xl md:text-3xl font-bold tracking-[0.2em] uppercase whitespace-nowrap"
                style={{
                  fontFamily: 'var(--tenant-font-heading, sans-serif)',
                  color: 'hsl(var(--tenant-color-heading, 0 0% 100%) / 0.2)',
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
            <div className="w-full h-full relative rounded-md overflow-hidden backdrop-blur-sm"
              style={{ backgroundColor: 'hsl(var(--tenant-color-background, 0 0% 50%) / 0.3)' }}
            >
              <Image
                src={watermarkImage}
                alt=""
                fill
                className="object-contain p-4"
                sizes="220px"
              />
            </div>
          </div>
        )}

        {/* Main text overlay — constrained to right panel */}
        <div
          className="z-20 px-4 overflow-hidden"
          style={textPositionStyles[textPosition] || textPositionStyles['bottom-right']}
        >
          <h1
            className={`font-bold mb-2 uppercase leading-[0.95] ${
              textPosition === 'vertical-right'
                ? 'text-xl sm:text-2xl tracking-[0.15em]'
                : 'text-xl sm:text-3xl md:text-4xl lg:text-5xl'
            }`}
            style={{
              fontFamily: 'var(--tenant-font-heading, sans-serif)',
              color: 'hsl(var(--tenant-color-heading, 0 0% 100%))',
            }}
          >
            {heading}
          </h1>
          {subtitle && textPosition !== 'vertical-right' && (
            <p
              className="text-sm sm:text-base mb-3"
              style={{ color: 'hsl(var(--tenant-color-text, 0 0% 90%))' }}
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
