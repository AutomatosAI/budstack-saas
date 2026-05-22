'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Zap } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';

/**
 * HeroFuturistic — Dark futuristic hero with animated grid lines,
 * scanning effects, and cyberpunk-inspired glow. Inspired by "Hero Odyssey"
 * from 21st.dev.
 *
 * Pure CSS animations — no WebGL or canvas. Lightweight.
 *
 * sectionConfig extras:
 *   gridDensity    — "sparse" | "medium" | "dense" (default "medium")
 *   glowColor      — "primary" | "accent" | "cyan" (default "primary")
 *   scanLine       — boolean (default true)
 */
export function HeroFuturistic({
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
  const ctaHref = sectionConfig?.ctaHref || consultationUrl;
  const secondaryCtaText = sectionConfig?.secondaryCtaText;
  const secondaryCtaHref = sectionConfig?.secondaryCtaHref || '/products';

  const glowColor = (sectionConfig?.glowColor as string) || 'primary';
  const showScanLine = sectionConfig?.scanLine !== false;

  const gridDensity = (sectionConfig?.gridDensity as string) || 'medium';
  const gridSizeMap: Record<string, string> = {
    sparse: '80px 80px',
    medium: '50px 50px',
    dense: '30px 30px',
  };
  const gridSize = gridSizeMap[gridDensity] || gridSizeMap.medium;

  const colorVarMap: Record<string, string> = {
    primary: '--tenant-color-primary',
    accent: '--tenant-color-accent',
    cyan: '--tenant-color-secondary',
  };
  const colorVar = colorVarMap[glowColor] || colorVarMap.primary;

  // Color overrides
  const primaryOverride = sectionConfig?.primaryColor as string | undefined;
  const accentOverride = sectionConfig?.accentColor as string | undefined;
  const cssOverrides: Record<string, string> = {};
  if (primaryOverride) cssOverrides['--tenant-color-primary'] = primaryOverride;
  if (accentOverride) cssOverrides['--tenant-color-accent'] = accentOverride;

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#050510]" style={cssOverrides as React.CSSProperties}>
      {/* Animated grid background */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(hsl(var(${colorVar}) / 0.3) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(${colorVar}) / 0.3) 1px, transparent 1px)
          `,
          backgroundSize: gridSize,
        }}
        aria-hidden="true"
      />

      {/* Perspective grid floor */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1/2 opacity-30"
        style={{
          background: `
            linear-gradient(to top, hsl(var(${colorVar}) / 0.1), transparent),
            repeating-linear-gradient(
              90deg,
              hsl(var(${colorVar}) / 0.15) 0px,
              transparent 1px,
              transparent 49px,
              hsl(var(${colorVar}) / 0.15) 50px
            )
          `,
          transform: 'perspective(500px) rotateX(60deg)',
          transformOrigin: 'bottom center',
        }}
        aria-hidden="true"
      />

      {/* Radial glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[150px] opacity-30 pointer-events-none"
        style={{
          backgroundColor: `hsl(var(${colorVar}))`,
        }}
        aria-hidden="true"
      />

      {/* Scanning line */}
      {showScanLine && (
        <motion.div
          className="absolute left-0 right-0 h-px z-[2] pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent, hsl(var(${colorVar}) / 0.6), transparent)`,
            boxShadow: `0 0 20px hsl(var(${colorVar}) / 0.3), 0 0 60px hsl(var(${colorVar}) / 0.1)`,
          }}
          animate={{ top: ['-5%', '105%'] }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      )}

      {/* Floating particles */}
      <div className="absolute inset-0 z-[1] pointer-events-none" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{
              backgroundColor: `hsl(var(${colorVar}))`,
              left: `${15 + i * 14}%`,
              top: `${20 + (i % 3) * 25}%`,
              opacity: 0.4 + (i % 3) * 0.2,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.3, 0.8, 0.3],
            }}
            transition={{
              duration: 3 + i * 0.5,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.4,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-6 sm:px-12">
        <div className="max-w-4xl w-full text-center space-y-8">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border"
            style={{
              borderColor: `hsl(var(${colorVar}) / 0.3)`,
              backgroundColor: `hsl(var(${colorVar}) / 0.05)`,
            }}
          >
            <Zap
              size={14}
              style={{ color: `hsl(var(${colorVar}))` }}
            />
            <span
              className="text-xs font-medium tracking-wide"
              style={{ color: `hsl(var(${colorVar}))` }}
            >
              {subtitle}
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="text-4xl sm:text-5xl md:text-7xl font-bold text-white leading-tight tracking-tight"
            style={{ fontFamily: 'var(--tenant-font-heading, sans-serif)' }}
          >
            {title}
          </motion.h1>

          {description && (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="text-base md:text-lg text-white/60 max-w-2xl mx-auto leading-relaxed"
            >
              {description}
            </motion.p>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.45 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4"
          >
            <a
              href={ctaHref || '#'}
              className="group inline-flex items-center gap-2 px-8 py-4 text-base font-semibold rounded-full transition-all hover:scale-105"
              style={{
                backgroundColor: `hsl(var(${colorVar}))`,
                color: '#050510',
                boxShadow: `0 0 30px hsl(var(${colorVar}) / 0.4), 0 0 60px hsl(var(${colorVar}) / 0.15)`,
              }}
            >
              {ctaText}
              <ArrowRight
                size={18}
                className="transition-transform group-hover:translate-x-1"
              />
            </a>
            {secondaryCtaText && (
              <a
                href={secondaryCtaHref}
                className="px-8 py-4 rounded-full border font-medium transition-all duration-300 hover:scale-105"
                style={{
                  borderColor: `hsl(var(${colorVar}) / 0.3)`,
                  color: `hsl(var(${colorVar}))`,
                }}
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
