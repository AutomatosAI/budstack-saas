'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Image from 'next/image';
import { SectionProps } from '@/lib/types/section-props';

/**
 * FeaturesShowcase — center product image with feature cards on each side.
 *
 * sectionConfig:
 *   heading       — optional section heading
 *   subtitle      — optional subtitle
 *   image         — center image URL
 *   imageAlt      — alt text for center image
 *   leftFeatures  — array of { icon, title, description }
 *   rightFeatures — array of { icon, title, description }
 *   bgColor       — override background color
 *
 * Available icon keys (wellness/cannabis themed):
 *   leaf, cannabis, heart, shield, brain, sleep, pain, anxiety,
 *   appetite, muscle, blood-pressure, droplet, sun, flower, pill, dna
 */

// Hardcoded SVG icons — safe for dangerouslySetInnerHTML (no user input)
const WELLNESS_ICONS: Record<string, string> = {
  leaf: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 2c1 2 2 4.5 1 8-1.5 5.5-4 8-9 10z"/><path d="M10.7 20.7c1.5-4.5 0-8.5-3.7-11.7"/></svg>`,
  cannabis: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-4"/><path d="M7 12c-1.5 0-4.5 1.5-5 3.5 2.5 0 4.5-1 5.5-2 .5 1.5 1.5 2.5 2.5 3.5-2 1-4 2-6 2 3 0 5.5-1 7-3 1.5 2 4 3 7 3-2 0-4-1-6-2 1-1 2-2 2.5-3.5 1 1 3 2 5.5 2-.5-2-3.5-3.5-5-3.5 1.5-1 3-3.5 3-6.5-2 1-3.5 3-4 5-.5-2-1.5-4.5-3-6-.5 2.5-1 4-1.5 5-.5-2-2-4-4-5 0 3 1.5 5.5 3 6.5z"/></svg>`,
  heart: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`,
  shield: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>`,
  brain: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/></svg>`,
  sleep: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`,
  pain: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c1-3 6-6 6-12a6 6 0 0 0-12 0c0 6 5 9 6 12z"/><circle cx="12" cy="10" r="1"/></svg>`,
  anxiety: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
  appetite: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 11h.01"/><path d="M11 15h.01"/><path d="M16 16h.01"/><circle cx="12" cy="12" r="10"/><path d="m2 12 4.5 2"/><path d="m22 12-4.5 2"/><path d="m8 5.5 1.5 4"/><path d="m14.5 5.5-1.5 4"/></svg>`,
  muscle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18.5 8c-1.4 0-2.6-.8-3.2-2A6.87 6.87 0 0 0 2 10v4a2 2 0 0 0 4 0v-1a2 2 0 0 1 4 0v3a2 2 0 0 0 4 0v-3a2 2 0 0 1 4 0v1a2 2 0 0 0 4 0v-4c0-1.3-.4-2.5-1-3.5-.2.3-.5.5-.8.7-.4.2-.8.3-1.2.3h-.5z"/></svg>`,
  'blood-pressure': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M12 13V9"/><path d="M10 11h4"/></svg>`,
  droplet: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
  sun: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`,
  flower: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2a4 4 0 0 1 0 8 4 4 0 0 1 0 8"/><path d="M12 2a4 4 0 0 0 0 8 4 4 0 0 0 0 8"/><path d="M2 12a4 4 0 0 0 8 0 4 4 0 0 0 8 0"/><path d="M2 12a4 4 0 0 1 8 0 4 4 0 0 1 8 0"/></svg>`,
  pill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>`,
  dna: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 15c6.667-6 13.333 0 20-6"/><path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993"/><path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993"/><path d="m17 6-2.5-2.5"/><path d="m14 8-1-1"/><path d="m7 18 2.5 2.5"/><path d="m3.5 14.5.5.5"/><path d="m20 9 .5.5"/><path d="m6.5 12.5 1 1"/><path d="m16.5 10.5 1 1"/><path d="m10 16 1.5 1.5"/></svg>`,
};

/** Label map for admin/editor UIs building icon dropdowns */
const ICON_LABELS: Record<string, string> = {
  leaf: 'Leaf',
  cannabis: 'Cannabis',
  heart: 'Heart',
  shield: 'Shield / Protection',
  brain: 'Brain / Cognitive',
  sleep: 'Sleep / Moon',
  pain: 'Pain Relief',
  anxiety: 'Awareness / Eye',
  appetite: 'Appetite',
  muscle: 'Muscle',
  'blood-pressure': 'Blood Pressure',
  droplet: 'Droplet / Oil',
  sun: 'Sun / Energy',
  flower: 'Flower',
  pill: 'Pill / Medicine',
  dna: 'DNA / Science',
};

interface FeatureItem {
  icon: string;
  title: string;
  description: string;
}

const defaultLeft: FeatureItem[] = [
  { icon: 'sleep', title: 'Fights insomnia', description: 'Promotes deep, restorative sleep naturally without dependency.' },
  { icon: 'pain', title: 'Relieves pain', description: 'Targets chronic pain and inflammation for lasting comfort.' },
  { icon: 'anxiety', title: 'Helps anxiety', description: 'Calms the mind and reduces stress without sedation.' },
];

const defaultRight: FeatureItem[] = [
  { icon: 'muscle', title: 'Muscle spasm', description: 'Eases tension and involuntary muscle contractions.' },
  { icon: 'blood-pressure', title: 'Blood pressure', description: 'Supports healthy cardiovascular function and circulation.' },
  { icon: 'appetite', title: 'Poor appetite', description: 'Gently stimulates appetite for better nutrition and recovery.' },
];

function FeatureCard({
  feature,
  align,
  index,
  inView,
}: {
  feature: FeatureItem;
  align: 'left' | 'right';
  index: number;
  inView: boolean;
}) {
  // Only use hardcoded SVGs — icon key is validated against WELLNESS_ICONS map
  const iconSvg = WELLNESS_ICONS[feature.icon] || WELLNESS_ICONS.leaf;
  const isLeft = align === 'left';

  return (
    <motion.div
      initial={{ opacity: 0, x: isLeft ? -30 : 30 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.5, delay: 0.15 * index }}
      className="flex items-start gap-4"
    >
      {/* Icon circle */}
      <div
        className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center"
        style={{
          backgroundColor: 'hsl(var(--tenant-color-primary) / 0.1)',
          color: 'hsl(var(--tenant-color-primary))',
        }}
      >
        {/* Safe: iconSvg is from hardcoded WELLNESS_ICONS map, never user input */}
        <span
          className="w-5 h-5 sm:w-6 sm:h-6"
          dangerouslySetInnerHTML={{ __html: iconSvg }}
        />
      </div>

      {/* Text */}
      <div className="flex-1">
        <h3
          className="text-base sm:text-lg font-semibold mb-1"
          style={{
            color: 'hsl(var(--tenant-color-text))',
            fontFamily: 'var(--tenant-font-heading, sans-serif)',
          }}
        >
          {feature.title}
        </h3>
        <p
          className="text-sm leading-relaxed"
          style={{ color: 'hsl(var(--tenant-color-text) / 0.6)' }}
        >
          {feature.description}
        </p>
      </div>
    </motion.div>
  );
}

export function FeaturesShowcase(props: SectionProps) {
  const { sectionConfig } = props;

  const heading = sectionConfig?.heading || '';
  const subtitle = sectionConfig?.subtitle || '';
  const imageUrl = sectionConfig?.image || sectionConfig?.imageUrl || '';
  const imageAlt = sectionConfig?.imageAlt || 'Product showcase';
  const leftFeatures: FeatureItem[] = sectionConfig?.leftFeatures || defaultLeft;
  const rightFeatures: FeatureItem[] = sectionConfig?.rightFeatures || defaultRight;

  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section
      ref={ref}
      className="py-16 sm:py-20 lg:py-28 overflow-hidden"
      style={{
        backgroundColor: sectionConfig?.bgColor || 'hsl(var(--tenant-color-surface))',
      }}
    >
      <div className="container mx-auto px-6">
        {/* Optional heading */}
        {(heading || subtitle) && (
          <div className="text-center mb-12 sm:mb-16">
            {heading && (
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6 }}
                className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4"
                style={{
                  color: 'hsl(var(--tenant-color-text))',
                  fontFamily: 'var(--tenant-font-heading, sans-serif)',
                }}
              >
                {heading}
              </motion.h2>
            )}
            {subtitle && (
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-lg max-w-2xl mx-auto"
                style={{ color: 'hsl(var(--tenant-color-text) / 0.6)' }}
              >
                {subtitle}
              </motion.p>
            )}
          </div>
        )}

        {/* Main layout: features — image — features */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 items-center">
          {/* Left features */}
          <div className="flex flex-col gap-8 sm:gap-10 order-2 lg:order-1">
            {leftFeatures.map((feature, i) => (
              <FeatureCard
                key={i}
                feature={feature}
                align="left"
                index={i}
                inView={inView}
              />
            ))}
          </div>

          {/* Center image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative order-1 lg:order-2 flex justify-center"
          >
            {imageUrl ? (
              <div className="relative w-full max-w-sm aspect-[3/4]">
                <Image
                  src={imageUrl}
                  alt={imageAlt}
                  fill
                  className="object-contain drop-shadow-2xl"
                  sizes="(max-width: 1024px) 80vw, 33vw"
                />
              </div>
            ) : (
              /* Placeholder when no image configured */
              <div
                className="w-full max-w-sm aspect-[3/4] rounded-2xl flex items-center justify-center"
                style={{
                  backgroundColor: 'hsl(var(--tenant-color-primary) / 0.05)',
                  border: '2px dashed hsl(var(--tenant-color-primary) / 0.2)',
                }}
              >
                {/* Safe: hardcoded SVG constant */}
                <span
                  className="w-24 h-24 opacity-20"
                  style={{ color: 'hsl(var(--tenant-color-primary))' }}
                  dangerouslySetInnerHTML={{ __html: WELLNESS_ICONS.cannabis }}
                />
              </div>
            )}
          </motion.div>

          {/* Right features */}
          <div className="flex flex-col gap-8 sm:gap-10 order-3">
            {rightFeatures.map((feature, i) => (
              <FeatureCard
                key={i}
                feature={feature}
                align="right"
                index={i + 3}
                inView={inView}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Export icon maps for use in template editors / admin UIs */
export { WELLNESS_ICONS, ICON_LABELS };
