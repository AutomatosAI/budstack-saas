'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { MeshGradient } from '@paper-design/shaders-react';
import { SectionProps } from '@/lib/types/section-props';
import { useResolvedColors } from '@/lib/hooks/use-resolved-colors';

/**
 * HeroMeshGradient — Dark cinematic hero with layered mesh gradient shaders.
 *
 * Two MeshGradient layers: a solid colour layer + a wireframe overlay for depth.
 * Perfect for premium/luxury brand vibes.
 *
 * sectionConfig extras:
 *   shaderSpeed    — number 0-2 (default 0.3)
 *   wireframe      — boolean (default true)
 *   darkMode       — boolean (default true) — controls overlay intensity
 */
export function HeroMeshGradient({
  tenant,
  pageContent,
  sectionConfig,
  consultationUrl,
  designSystem,
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
  const alignment = sectionConfig?.textAlign || pageContent?.home?.heroAlignment || 'left';

  const shaderSpeed = Number(sectionConfig?.shaderSpeed) || 0.3;
  const showWireframe = sectionConfig?.wireframe !== false;

  // Resolve actual color values for WebGL shader
  const { ref, colors } = useResolvedColors(designSystem);

  const meshColors = [
    '#000000',
    colors.primary,
    '#ffffff',
    colors.secondary,
    colors.accent,
  ];

  const overlayColors = [
    '#000000',
    '#ffffff',
    colors.primary,
    '#000000',
  ];

  const isCenter = alignment === 'center';

  return (
    <section ref={ref as React.RefObject<HTMLElement>} className="relative min-h-screen overflow-hidden bg-black">
      {/* SVG Filters */}
      <svg className="absolute inset-0 w-0 h-0" aria-hidden="true">
        <defs>
          <filter id="mesh-glass-effect" x="-50%" y="-50%" width="200%" height="200%">
            <feTurbulence baseFrequency="0.005" numOctaves="1" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.3" />
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0.02 0 1 0 0 0.02 0 0 1 0 0.05 0 0 0 0.9 0"
              result="tint"
            />
          </filter>
        </defs>
      </svg>

      {/* Mesh gradient layer */}
      <MeshGradient
        className="absolute inset-0 w-full h-full z-0"
        colors={meshColors}
        speed={shaderSpeed}
      />

      {/* Secondary overlay layer for depth */}
      <MeshGradient
        className="absolute inset-0 w-full h-full opacity-40 z-[1]"
        colors={overlayColors}
        speed={shaderSpeed * 0.7}
        distortion={0.6}
        swirl={0.4}
      />

      {/* Content */}
      <div
        className={`relative z-10 min-h-screen flex items-end sm:items-center px-6 sm:px-12 pb-16 sm:pb-0 ${
          isCenter ? 'justify-center text-center' : 'justify-start text-left'
        }`}
      >
        <div className={`${isCenter ? 'max-w-4xl' : 'max-w-lg'}`}>
          {/* Eyebrow badge */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center px-3 py-1 rounded-full bg-white/5 backdrop-blur-sm mb-6 relative"
            style={{ filter: 'url(#mesh-glass-effect)' }}
          >
            <div className="absolute top-0 left-1 right-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full" />
            <span className="text-white/90 text-xs font-light relative z-10">
              {subtitle}
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="text-4xl sm:text-5xl md:text-7xl font-bold text-white mb-4 leading-tight tracking-tight"
            style={{ fontFamily: 'var(--tenant-font-heading, sans-serif)' }}
          >
            {title}
          </motion.h1>

          {description && (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="text-sm sm:text-base text-white/70 mb-6 leading-relaxed max-w-2xl"
            >
              {description}
            </motion.p>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.45 }}
            className={`flex items-center gap-4 flex-wrap ${
              isCenter ? 'justify-center' : ''
            }`}
          >
            <a
              href={consultationUrl}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-full font-medium text-sm transition-all duration-200 hover:scale-105"
              style={{
                backgroundColor: 'hsl(var(--tenant-color-primary))',
                color: 'white',
              }}
            >
              {ctaText}
              <ArrowRight size={16} />
            </a>
            {secondaryCtaText && (
              <a
                href={secondaryCtaHref}
                className="px-8 py-3 rounded-full bg-transparent border border-white/30 text-white font-medium text-sm transition-all duration-200 hover:bg-white/10 hover:border-white/50"
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
