'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { MeshGradient } from '@paper-design/shaders-react';
import { SectionProps } from '@/lib/types/section-props';
import { useResolvedColors } from '@/lib/hooks/use-resolved-colors';

/**
 * HeroShaderGlass — Dark glassmorphic hero with MeshGradient + pulsing border accents.
 *
 * Layered MeshGradient with glass-panel content overlay and animated border glow.
 * Inspired by 21st.dev "Shaders Hero Section" design.
 *
 * sectionConfig extras:
 *   shaderSpeed    — number 0-2 (default 0.4)
 *   glowColor      — "primary" | "accent" | "white" (default "primary")
 */
export function HeroShaderGlass({
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
  const ctaHref = sectionConfig?.ctaHref || consultationUrl;
  const secondaryCtaText = sectionConfig?.secondaryCtaText;
  const secondaryCtaHref = sectionConfig?.secondaryCtaHref || '/products';

  const shaderSpeed = Number(sectionConfig?.shaderSpeed) || 0.4;
  const glowColor = (sectionConfig?.glowColor as string) || 'primary';

  const glowVarMap: Record<string, string> = {
    primary: '--tenant-color-primary',
    accent: '--tenant-color-accent',
    white: '--tenant-color-background',
  };
  const glowVar = glowVarMap[glowColor] || glowVarMap.primary;

  // Resolve actual color values for WebGL shader
  const { ref, colors } = useResolvedColors(designSystem);

  const meshColors = [
    '#0a0a0a',
    colors.primary,
    '#1a1a2e',
    colors.secondary,
    colors.accent,
  ];

  return (
    <section ref={ref as React.RefObject<HTMLElement>} className="relative min-h-screen overflow-hidden bg-black">
      {/* Shader background */}
      <MeshGradient
        className="absolute inset-0 w-full h-full z-0"
        colors={meshColors}
        speed={shaderSpeed}
      />

      {/* Dark overlay for depth */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black/60 via-black/30 to-black/70" />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-6 sm:px-12">
        {/* Glass panel */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="relative max-w-3xl w-full rounded-2xl overflow-hidden"
        >
          {/* Pulsing border glow */}
          <div
            className="absolute -inset-px rounded-2xl opacity-60 animate-pulse"
            style={{
              background: `linear-gradient(135deg, hsl(var(${glowVar}) / 0.4), transparent 40%, hsl(var(${glowVar}) / 0.3) 60%, transparent)`,
            }}
          />

          {/* Glass background */}
          <div className="relative bg-white/5 backdrop-blur-xl rounded-2xl p-8 sm:p-12 border border-white/10">
            {/* Top highlight line */}
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 mb-6"
            >
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: `hsl(var(${glowVar}))` }}
              />
              <span className="text-white/80 text-xs font-medium tracking-wide">
                {subtitle}
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-3xl sm:text-4xl md:text-6xl font-bold text-white mb-4 leading-tight tracking-tight"
              style={{ fontFamily: 'var(--tenant-font-heading, sans-serif)' }}
            >
              {title}
            </motion.h1>

            {description && (
              <motion.p
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.55 }}
                className="text-sm sm:text-base text-white/60 mb-8 leading-relaxed max-w-xl"
              >
                {description}
              </motion.p>
            )}

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.7 }}
              className="flex items-center gap-4 flex-wrap"
            >
              <a
                href={ctaHref || '#'}
                className="inline-flex items-center gap-2 px-7 py-3 rounded-full font-medium text-sm text-white transition-all duration-300 hover:scale-105 hover:shadow-lg"
                style={{
                  backgroundColor: `hsl(var(${glowVar}))`,
                }}
              >
                {ctaText}
                <ArrowRight size={16} />
              </a>
              {secondaryCtaText && (
                <a
                  href={secondaryCtaHref}
                  className="px-7 py-3 rounded-full bg-white/10 border border-white/20 text-white font-medium text-sm transition-all duration-200 hover:bg-white/20 hover:border-white/30"
                >
                  {secondaryCtaText}
                </a>
              )}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
