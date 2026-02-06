import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface HeroProps {
  businessName: string;
  title?: string;
  subtitle?: string;
  heroImagePath?: string | null;
  logoPath?: string | null;
  consultationUrl: string;
  ctaText?: string;
}

export default function Hero({
  businessName,
  title,
  subtitle,
  heroImagePath,
  logoPath,
  consultationUrl,
  ctaText
}: HeroProps) {
  const displayTitle = title || `Welcome to ${businessName}`;
  const displaySubtitle = subtitle || 'Premium Medical Cannabis';

  // Ensure we have a valid path, handling empty strings or whitespace
  const cleanPath = heroImagePath && heroImagePath.trim().length > 0 ? heroImagePath : null;
  const heroImage = cleanPath || '/templates/gta-cannabis/gta-hero.jpg';

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gray-900">
      {/* 1. Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src={heroImage}
          alt="Hero Background"
          fill
          className="object-cover opacity-90"
          priority
        />
      </div>

      {/* 2. Retro Color Overlay (Mulitply Effect) */}
      <div
        className="absolute inset-0 z-0 opacity-60"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 107, 107, 0.9) 0%, rgba(78, 205, 196, 0.7) 50%, rgba(255, 230, 109, 0.9) 100%)',
          mixBlendMode: 'multiply'
        }}
      />

      {/* 3. Dark Gradient Overlay for Text Readability */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/40 via-black/20 to-black/70" />

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 text-center">
        {/* Logo */}
        {logoPath && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="mb-8 flex justify-center"
          >
            <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-2xl">
              <Image
                src={logoPath}
                alt={`${businessName} Logo`}
                fill
                className="object-cover"
              />
            </div>
          </motion.div>
        )}

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="gta-hero-title font-black text-white mb-6 comic-text"
          style={{ fontSize: 'clamp(2.5rem, 8vw, 5rem)' }}
        >
          {displayTitle}
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-xl md:text-2xl text-white/95 mb-12 max-w-2xl mx-auto font-medium"
          style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}
        >
          {displaySubtitle}
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <a
            href={consultationUrl}
            className="retro-button px-8 py-3 text-base font-semibold text-white rounded-full transition-all neon-glow"
            style={{ backgroundColor: '#FF6B6B' }}
          >
            {ctaText || 'Book Consultation'}
          </a>
          <a
            href="#about"
            className="retro-button px-8 py-3 text-base font-semibold border-2 border-white text-white rounded-full hover:bg-white hover:text-gray-900 transition-all"
          >
            Learn More
          </a>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white cursor-pointer"
        onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })}
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <ChevronDown size={40} />
        </motion.div>
      </motion.div>
    </section>
  );
}
