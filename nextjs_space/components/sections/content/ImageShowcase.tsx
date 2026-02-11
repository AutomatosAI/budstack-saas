'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { ArrowRight } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';

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
 */
export function ImageShowcase(props: SectionProps) {
    const { sectionConfig, pageContent } = props;

    const heading = sectionConfig?.heading || 'Our Facility';
    const content =
        sectionConfig?.content ||
        pageContent?.imageShowcase?.content ||
        'State-of-the-art facilities dedicated to quality and excellence. Every stage of production is meticulously managed with unwavering attention to detail.';
    const ctaText = sectionConfig?.ctaText || 'Learn More';
    const ctaHref = sectionConfig?.ctaHref || '#';
    const imageUrl = sectionConfig?.imageUrl || null;
    const overlayStyle = sectionConfig?.overlayStyle || 'gradient-left';

    const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.15 });

    // Overlay gradients based on style
    const overlayGradients: Record<string, string[]> = {
        'gradient-left': [
            'linear-gradient(to right, hsl(var(--tenant-color-heading) / 0.92) 0%, hsl(var(--tenant-color-heading) / 0.7) 40%, transparent 100%)',
            'linear-gradient(to top, hsl(var(--tenant-color-heading) / 0.85) 0%, transparent 50%)',
        ],
        'gradient-center': [
            'linear-gradient(180deg, hsl(var(--tenant-color-heading) / 0.75) 0%, hsl(var(--tenant-color-heading) / 0.5) 50%, hsl(var(--tenant-color-heading) / 0.8) 100%)',
        ],
        dark: [
            'linear-gradient(180deg, hsl(var(--tenant-color-heading) / 0.8) 0%, hsl(var(--tenant-color-heading) / 0.85) 100%)',
        ],
    };

    const gradients = overlayGradients[overlayStyle] || overlayGradients['gradient-left'];
    const isLeft = overlayStyle === 'gradient-left';
    const isCenter = overlayStyle === 'gradient-center';

    return (
        <section ref={ref} className="py-2 px-2 sm:px-2">
            <div
                className="relative rounded-2xl sm:rounded-3xl overflow-hidden mx-auto"
                style={{ minHeight: '420px' }}
            >
                {/* Background image or gradient fallback */}
                {imageUrl ? (
                    <div className="absolute inset-0">
                        <Image
                            src={imageUrl}
                            alt={heading}
                            fill
                            className="object-cover"
                            sizes="100vw"
                        />
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

                {/* Overlay gradient(s) */}
                {gradients.map((g, i) => (
                    <div key={i} className="absolute inset-0" style={{ background: g }} />
                ))}

                {/* Subtle dark scrim for text safety */}
                <div className="absolute inset-0 bg-black/15" />

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
                        style={{
                            backgroundColor: 'hsl(var(--tenant-color-heading) / 0.6)',
                            border: '1px solid rgba(255,255,255,0.08)',
                        }}
                    >
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            animate={inView ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="text-2xl sm:text-4xl md:text-5xl font-semibold text-white mb-4 sm:mb-6 tracking-tight leading-tight"
                            style={{ fontFamily: 'var(--tenant-font-heading, sans-serif)' }}
                        >
                            {heading}
                        </motion.h2>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={inView ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: 0.6, delay: 0.3 }}
                            className="text-white/75 text-sm sm:text-base md:text-lg leading-relaxed mb-6 sm:mb-8"
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
                                className="inline-flex items-center gap-2 text-white font-semibold text-sm sm:text-base px-6 py-3 rounded-full transition-all duration-300 hover:scale-105 group"
                                style={{
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
