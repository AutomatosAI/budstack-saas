'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Image from 'next/image';
import { SectionProps } from '@/lib/types/section-props';
import { headerAlignClasses } from '@/lib/templates/section-align';

interface TeamMember {
  name: string;
  role: string;
  avatar: string;
  bio: string;
}

const defaultMembers: TeamMember[] = [
  { name: 'Dr. Sarah Chen', role: 'Medical Director', avatar: '', bio: 'Board-certified physician with 15 years of experience in integrative medicine.' },
  { name: 'James Ndlovu', role: 'Head Pharmacist', avatar: '', bio: 'Specialising in medicinal cannabis formulations and patient care.' },
  { name: 'Thandi Molefe', role: 'Wellness Consultant', avatar: '', bio: 'Certified wellness expert guiding patients through their journey.' },
  { name: 'David Park', role: 'Operations Lead', avatar: '', bio: 'Ensuring seamless service from order to delivery.' },
];

export function TeamGrid(props: SectionProps) {
  const { sectionConfig } = props;
  const heading = sectionConfig?.heading || 'Meet Our Team';
  const subtitle = sectionConfig?.subtitle || 'The experts behind your wellness journey';
  const members: TeamMember[] = sectionConfig?.members || defaultMembers;
  const avatarShape = sectionConfig?.avatarShape || 'circle';
  const avatarSize = sectionConfig?.avatarSize || 'md';
  const backgroundImage = sectionConfig?.imageUrl || '';
  const overlayOpacity = sectionConfig?.overlayOpacity ?? 0.6;

  const avatarSizeMap: Record<string, { container: string; sizes: string }> = {
    sm: { container: 'w-24 h-24', sizes: '96px' },
    md: { container: 'w-32 h-32', sizes: '128px' },
    lg: { container: 'w-40 h-48', sizes: '160px' },
    xl: { container: 'w-52 h-64', sizes: '208px' },
  };
  const avatarShapeMap: Record<string, string> = {
    circle: 'rounded-full',
    rounded: 'rounded-xl',
    square: 'rounded-none',
  };
  const sizeClasses = avatarSizeMap[avatarSize] || avatarSizeMap.md;
  const shapeClass = avatarShapeMap[avatarShape] || avatarShapeMap.circle;

  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  const sectionStyle: React.CSSProperties = {
    backgroundColor: 'hsl(var(--tenant-color-background, var(--tenant-color-surface)))',
  };
  if (backgroundImage) {
    sectionStyle.backgroundImage = `url(${backgroundImage})`;
    sectionStyle.backgroundSize = 'cover';
    sectionStyle.backgroundPosition = 'center';
  }

  return (
    <section
      ref={ref}
      className="py-16 sm:py-20 lg:py-24 relative overflow-hidden"
      style={sectionStyle}
    >
      {/* Dark overlay when background image is set */}
      {backgroundImage && (
        <div
          className="absolute inset-0"
          style={{ backgroundColor: `hsl(var(--tenant-color-background, 0 0% 0%) / ${overlayOpacity})` }}
        />
      )}
      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className={`${headerAlignClasses(sectionConfig?.textAlign)} max-w-3xl mb-12`}
        >
          <h2
            className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4"
            style={{
              fontFamily: 'var(--tenant-font-heading, sans-serif)',
              color: 'hsl(var(--tenant-color-heading))',
            }}
          >
            {heading}
          </h2>
          {subtitle && (
            <p className="text-lg" style={{ color: 'hsl(var(--tenant-color-text))' }}>
              {subtitle}
            </p>
          )}
        </motion.div>

        <div className={`grid grid-cols-1 sm:grid-cols-2 ${members.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-8 max-w-6xl mx-auto`}>
          {members.map((member, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className={`text-center group ${backgroundImage ? 'backdrop-blur-sm rounded-xl p-4' : ''}`}
              style={backgroundImage ? { backgroundColor: 'hsl(var(--tenant-color-surface, 0 0% 100%) / 0.15)' } : undefined}
            >
              <div
                className={`${sizeClasses.container} mx-auto mb-4 ${shapeClass} overflow-hidden relative`}
                style={{ backgroundColor: 'hsl(var(--tenant-color-primary) / 0.1)' }}
              >
                {member.avatar ? (
                  <Image
                    src={member.avatar}
                    alt={member.name}
                    fill
                    className="object-cover"
                    sizes={sizeClasses.sizes}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span
                      className="text-3xl font-bold"
                      style={{ color: 'hsl(var(--tenant-color-primary))' }}
                    >
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                )}
              </div>
              <h3
                className="text-lg font-bold mb-1"
                style={{ color: 'hsl(var(--tenant-color-heading))' }}
              >
                {member.name}
              </h3>
              <p
                className="text-sm font-medium mb-2"
                style={{ color: 'hsl(var(--tenant-color-primary))' }}
              >
                {member.role}
              </p>
              {member.bio && (
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: 'hsl(var(--tenant-color-text))' }}
                >
                  {member.bio}
                </p>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
