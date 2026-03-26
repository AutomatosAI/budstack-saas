'use client';

import React from 'react';
import Image from 'next/image';
import { SectionProps } from '@/lib/types/section-props';

const SPLIT_MAP: Record<string, { left: string; right: string }> = {
  '30/70': { left: 'w-[30%]', right: 'w-[70%]' },
  '40/60': { left: 'w-[40%]', right: 'w-[60%]' },
  '50/50': { left: 'w-[50%]', right: 'w-[50%]' },
  '60/40': { left: 'w-[60%]', right: 'w-[40%]' },
  '70/30': { left: 'w-[70%]', right: 'w-[30%]' },
};

const TEXT_POSITION_STYLES: Record<string, React.CSSProperties> = {
  'bottom-right': { position: 'absolute', bottom: '2rem', right: '2rem', textAlign: 'right' },
  'bottom-left': { position: 'absolute', bottom: '2rem', left: '2rem', textAlign: 'left' },
  'center-right': { position: 'absolute', top: '50%', right: '2rem', transform: 'translateY(-50%)', textAlign: 'right' },
  'center': { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' },
  'vertical-right': { position: 'absolute', top: '50%', right: '1.5rem', transform: 'translateY(-50%) rotate(180deg)', writingMode: 'vertical-rl', textAlign: 'center' },
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

  return (
    <section
      className={`${borderClass} relative`}
      style={{ backgroundColor: 'hsl(var(--tenant-color-background, 0 0% 95%))' }}
    >
      {/* Inner container with the collage */}
      <div className={`relative ${heightClass} overflow-hidden flex`}>
        {/* Left panel — main image */}
        <div className={`${split.left} relative shrink-0`}>
          {leftImage ? (
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
          {rightImage ? (
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
              className="absolute top-0 right-0 bottom-0 w-16 sm:w-20 flex items-center justify-center pointer-events-none select-none"
              style={{
                writingMode: 'vertical-rl',
                transform: 'rotate(180deg)',
              }}
            >
              <span
                className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-[0.2em] uppercase whitespace-nowrap"
                style={{
                  fontFamily: 'var(--tenant-font-heading, sans-serif)',
                  color: 'hsl(var(--tenant-color-heading, 0 0% 100%) / 0.25)',
                }}
              >
                {heading}
              </span>
            </div>
          )}
        </div>

        {/* Center watermark — overlapping both panels */}
        {watermarkImage && (
          <div
            className="absolute z-10 pointer-events-none"
            style={{
              left: `calc(${parseInt(splitRatio) || 40}% - 4rem)`,
              top: '25%',
              width: 'clamp(120px, 20vw, 240px)',
              height: 'clamp(160px, 28vw, 320px)',
              opacity: watermarkOpacity,
            }}
          >
            <div className="w-full h-full relative rounded-md overflow-hidden backdrop-blur-sm"
              style={{ backgroundColor: 'hsl(var(--tenant-color-background, 0 0% 50%) / 0.3)' }}
            >
              <Image
                src={watermarkImage}
                alt="Watermark"
                fill
                className="object-contain p-4"
                sizes="240px"
              />
            </div>
          </div>
        )}

        {/* Main text overlay */}
        <div
          className="z-20 max-w-lg px-4"
          style={TEXT_POSITION_STYLES[textPosition] || TEXT_POSITION_STYLES['bottom-right']}
        >
          <h1
            className={`font-bold mb-2 ${
              textPosition === 'vertical-right'
                ? 'text-3xl sm:text-5xl tracking-[0.15em]'
                : 'text-3xl sm:text-5xl md:text-6xl lg:text-7xl'
            } uppercase`}
            style={{
              fontFamily: 'var(--tenant-font-heading, sans-serif)',
              color: 'hsl(var(--tenant-color-heading, 0 0% 100%))',
            }}
          >
            {heading}
          </h1>
          {subtitle && textPosition !== 'vertical-right' && (
            <p
              className="text-base sm:text-lg mb-4"
              style={{ color: 'hsl(var(--tenant-color-text, 0 0% 90%))' }}
            >
              {subtitle}
            </p>
          )}
          {ctaText && textPosition !== 'vertical-right' && (
            <a
              href={ctaHref}
              className="inline-block px-6 py-3 text-sm font-semibold uppercase tracking-wider rounded transition-opacity hover:opacity-90"
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
