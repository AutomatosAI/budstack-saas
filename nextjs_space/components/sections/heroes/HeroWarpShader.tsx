'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Warp } from '@paper-design/shaders-react';
import { SectionProps } from '@/lib/types/section-props';

/**
 * HeroWarpShader — Full-screen hero with an animated warp shader background.
 *
 * Uses @paper-design/shaders-react Warp component. Colors are derived from the
 * tenant's design system so the shader feels integrated with the brand.
 *
 * sectionConfig extras:
 *   shaderShape   — "checks" | "grid" | "stripes" (default "checks")
 *   shaderSpeed   — number 0-3 (default 0.8)
 *   shaderSwirl   — number 0-2 (default 0.8)
 */
export function HeroWarpShader({
  tenant,
  pageContent,
  sectionConfig,
  consultationUrl,
}: SectionProps) {
  const title =
    sectionConfig?.title ||
    pageContent?.home?.heroTitle ||
    `Welcome to ${tenant.businessName}`;
  const subtitle =
    sectionConfig?.subtitle ||
    pageContent?.home?.heroSubtitle ||
    'Premium Cannabis, Delivered';
  const description =
    sectionConfig?.description || pageContent?.home?.heroDescription;
  const ctaText = sectionConfig?.ctaText || 'Get Started';
  const secondaryCtaText = sectionConfig?.secondaryCtaText;
  const secondaryCtaHref = sectionConfig?.secondaryCtaHref || '/products';

  const shaderShape = (sectionConfig?.shaderShape as string) || 'checks';
  const shaderSpeed = Number(sectionConfig?.shaderSpeed) || 0.8;
  const shaderSwirl = Number(sectionConfig?.shaderSwirl) || 0.8;

  // Derive shader colours from CSS custom properties with fallbacks
  const shaderColors: [string, string, string, string] = [
    'hsl(var(--tenant-color-primary, 160 84% 39%))',
    'hsl(var(--tenant-color-secondary, 160 64% 52%))',
    'hsl(var(--tenant-color-accent, 160 76% 46%))',
    'hsl(var(--tenant-color-background, 0 0% 100%) / 0.6)',
  ];

  return (
    <section className="relative min-h-screen overflow-hidden">
      {/* Shader background */}
      <div className="absolute inset-0 z-0">
        <Warp
          style={{ height: '100%', width: '100%' }}
          proportion={0.45}
          softness={1}
          distortion={0.25}
          swirl={shaderSwirl}
          swirlIterations={10}
          shape={shaderShape as any}
          shapeScale={0.1}
          scale={1}
          rotation={0}
          speed={shaderSpeed}
          colors={shaderColors}
        />
      </div>

      {/* Dark overlay for text legibility */}
      <div className="absolute inset-0 z-[1] bg-black/30" />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-6 sm:px-8">
        <div className="max-w-4xl w-full text-center space-y-6 sm:space-y-8">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-sm uppercase tracking-widest font-medium text-white/90"
          >
            {subtitle}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="text-4xl sm:text-5xl md:text-7xl font-bold text-white leading-tight"
            style={{ fontFamily: 'var(--tenant-font-heading, sans-serif)' }}
          >
            {title}
          </motion.h1>

          {description && (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="text-lg md:text-xl text-white/80 max-w-3xl mx-auto leading-relaxed"
            >
              {description}
            </motion.p>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.45 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-2"
          >
            <a
              href={consultationUrl}
              className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold rounded-full transition-all hover:scale-105 hover:gap-3"
              style={{
                backgroundColor: 'hsl(var(--tenant-color-primary))',
                color: 'white',
              }}
            >
              {ctaText}
              <ArrowRight size={18} />
            </a>
            {secondaryCtaText && (
              <a
                href={secondaryCtaHref}
                className="px-8 py-4 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white font-medium hover:bg-white/30 transition-all duration-300 hover:scale-105"
              >
                {secondaryCtaText}
              </a>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
