'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { ArrowRight } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';
import { InteractiveImage } from '@/components/ui/interactive-image';

/**
 * ImageShowcase — full-width image-background section with dark overlay,
 * content card, and CTA. Extracted from the legacy HealingBuds Cultivation
 * component as a reusable shared section.
 *
 * sectionConfig flags:
 *   imageUrl       — background image URL (gradient fallback if omitted)
 *   heading        — section heading
 *   content        — body text
 *   ctaText        — CTA button text
 *   ctaHref        — CTA button link
 *   overlayStyle   — "gradient-left" | "gradient-center" | "dark"
 *   theme          — "dark" (default) | "light" (no overlay, dark text, for light bg use)
 */
export function ImageShowcase(props: SectionProps) {
    const { sectionConfig, pageContent, sectionId } = props;

    const heading = sectionConfig?.heading || 'Our Facility';
    const content =
        sectionConfig?.content ||
        pageContent?.imageShowcase?.content ||
        'State-of-the-art facilities dedicated to quality and excellence. Every stage of production is meticulously managed with unwavering attention to detail.';
    const ctaText = sectionConfig?.ctaText || 'Learn More';
    const ctaHref = sectionConfig?.ctaHref || '#';
    const imageUrl = sectionConfig?.imageUrl || null;
    const overlayStyle = sectionConfig?.overlayStyle || 'gradient-left';
    const theme = sectionConfig?.theme || 'dark'; // 'dark' (light text) | 'light' (dark text)
    const isLightTheme = theme === 'light';

    // Overlay strength 0–90 (percent). Drives the gradient alpha so users can dial
    // how dark the overlay sits on the image.
    const overlayPercentRaw = Number(sectionConfig?.overlayOpacity);
    const overlayPercent = Number.isFinite(overlayPercentRaw)
        ? Math.min(90, Math.max(0, overlayPercentRaw))
        : 70;
    const a = overlayPercent / 100;
    const aMid = Math.max(0, a - 0.25);

    // Overlay base colour: black for dark theme (legible white text),
    // white for light theme (legible dark text).
    const overlayRgb = isLightTheme ? '255,255,255' : '0,0,0';
    const rgba = (alpha: number) => `rgba(${overlayRgb},${alpha.toFixed(2)})`;

    // Extract interactive hotspots if configured
    const allHotspots = pageContent?.educationHotspots || [];
    const hotspots = allHotspots.filter((h: any) =>
        !h.targetSectionId || h.targetSectionId === 'all' || h.targetSectionId === sectionId
    );
    const hasHotspots = hotspots.length > 0;
    const glassEffect = props.tenant?.settings?.glassEffect || "none";

    const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.15 });

    // Overlay gradients keyed off the schema values. Neutral black/white so the
    // overlay never collides with the tenant heading colour (the prior bug that
    // rendered "dark text on dark overlay" once a brand heading hue was set).
    const overlayGradients: Record<string, string[]> = {
        'gradient-left': [
            `linear-gradient(to right, ${rgba(a)} 0%, ${rgba(aMid)} 45%, ${rgba(0)} 100%)`,
        ],
        'gradient-center': [
            `linear-gradient(180deg, ${rgba(a)} 0%, ${rgba(aMid)} 50%, ${rgba(a)} 100%)`,
        ],
        solid: [rgba(a)],
        none: [],
    };

    const gradients = overlayGradients[overlayStyle] ?? overlayGradients['gradient-left'];
    const isCenter = overlayStyle === 'gradient-center';
    const hasOverlay = overlayStyle !== 'none' && overlayPercent > 0;

    return (
        <section ref={ref} className="py-2 px-2 sm:px-2">
            <div
                className="relative rounded-2xl sm:rounded-3xl mx-auto"
                style={{ minHeight: '420px' }}
            >
                {/* Background image or gradient fallback */}
                {imageUrl ? (
                    <div className="absolute inset-0 rounded-2xl sm:rounded-3xl overflow-hidden">
                        {hasHotspots ? (
                            <InteractiveImage
                                src={imageUrl}
                                alt={heading}
                                hotspots={hotspots}
                                glassEffect={glassEffect as any}
                                className="w-full h-full object-cover min-h-[420px]"
                            />
                        ) : (
                            <Image
                                src={imageUrl}
                                alt={heading}
                                fill
                                className="object-cover"
                                sizes="100vw"
                            />
                        )}
                    </div>
                ) : (
                    <div
                        className="absolute inset-0"
                        style={{
                            background: `linear-gradient(135deg,
                hsl(var(--tenant-color-primary) / 0.3) 0%,
                hsl(var(--tenant-color-secondary) / 0.3) 100%)`,
                        }}
                    />
                )}

                {/* Overlay gradient(s) — only when there's actually one chosen.
                    Colour is black for dark theme, white for light theme. */}
                {hasOverlay && gradients.map((g, i) => (
                    <div key={i} className="absolute inset-0" style={{ background: g }} />
                ))}

                {/* Content */}
                <div
                    className={`relative z-10 flex flex-col ${isCenter ? 'items-center text-center' : 'items-start text-left'
                        } justify-center h-full px-6 sm:px-10 md:px-16 py-12 sm:py-16`}
                    style={{ minHeight: '420px' }}
                >
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={inView ? { opacity: 1, y: 0 } : {}}
                        transition={{ duration: 0.7, delay: 0.1 }}
                        className={`${isCenter ? 'max-w-2xl' : 'max-w-3xl'} backdrop-blur-sm rounded-2xl p-6 sm:p-8 md:p-10`}
                        style={isLightTheme ? {
                            backgroundColor: 'rgba(255,255,255,0.82)',
                            border: '1px solid rgba(0,0,0,0.08)',
                        } : {
                            backgroundColor: 'rgba(0,0,0,0.45)',
                            border: '1px solid rgba(255,255,255,0.1)',
                        }}
                    >
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            animate={inView ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="text-2xl sm:text-4xl md:text-5xl font-semibold mb-4 sm:mb-6 tracking-tight leading-tight"
                            style={{
                                fontFamily: 'var(--tenant-font-heading, sans-serif)',
                                color: isLightTheme ? 'hsl(0 0% 10%)' : '#ffffff',
                            }}
                        >
                            {heading}
                        </motion.h2>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={inView ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: 0.6, delay: 0.3 }}
                            className="text-sm sm:text-base md:text-lg leading-relaxed mb-6 sm:mb-8"
                            style={{
                                color: isLightTheme ? 'hsl(0 0% 25%)' : 'rgba(255,255,255,0.92)',
                            }}
                        >
                            {content}
                        </motion.p>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={inView ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: 0.6, delay: 0.4 }}
                        >
                            <a
                                href={ctaHref}
                                className={`inline-flex items-center gap-2 font-semibold text-sm sm:text-base px-6 py-3 rounded-full transition-all duration-300 hover:scale-105 group ${isLightTheme ? '' : 'text-white'}`}
                                style={isLightTheme ? {
                                    backgroundColor: 'hsl(var(--tenant-color-primary))',
                                    color: 'white',
                                } : {
                                    backgroundColor: 'hsl(var(--tenant-color-primary) / 0.4)',
                                    border: '1px solid rgba(255,255,255,0.25)',
                                }}
                            >
                                {ctaText}
                                <ArrowRight
                                    size={16}
                                    className="transition-transform group-hover:translate-x-1"
                                />
                            </a>
                        </motion.div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
