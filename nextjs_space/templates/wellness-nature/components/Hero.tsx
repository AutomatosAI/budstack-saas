import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Leaf, ChevronDown } from 'lucide-react';
import Link from 'next/link';

interface HeroProps {
  businessName: string;
  title?: string;
  subtitle?: string;
  heroImagePath?: string | null;
  logoPath?: string | null;
  consultationUrl: string;
}

export default function Hero({
  businessName,
  title,
  subtitle,
  heroImagePath,
  logoPath,
  consultationUrl
}: HeroProps) {
  const displayTitle = title || `Welcome to ${businessName}`;
  const displaySubtitle = subtitle || 'Natural Wellness, Naturally Delivered';
  const heroImage = heroImagePath || '/templates/wellness-nature/wellness-hero.jpg';

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden -mt-20">
      {/* Background Image */}
      <div className="absolute inset-0">
        <Image
          src={heroImage}
          alt="Wellness Background"
          fill
          className="object-cover"
          priority
        />
      </div>
      {/* Overlay for text contrast */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-transparent" />

      {/* Content */}
      <div className="container mx-auto px-6 py-20 relative z-20">
        <div className="max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{
              backgroundColor: '#E8DCC8',
              border: '1px solid #C4B5A0'
            }}>
              <Leaf size={16} style={{ color: '#6B8E23' }} />
              <span style={{ color: '#5C4A3A', fontSize: '14px', fontWeight: '600' }}>100% Natural & Organic</span>
            </div>

            {/* Heading */}
            <h1 
              className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight drop-shadow-lg"
              style={{ color: '#ffffff' }}
            >
              {displayTitle}
            </h1>

            {/* Subtitle */}
            <p 
              className="text-xl md:text-2xl leading-relaxed drop-shadow-md"
              style={{ color: '#ffffff' }}
            >
              {displaySubtitle}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href={consultationUrl}>
                <button
                  className="px-8 py-4 rounded-full font-semibold text-base transition-all duration-300 hover:shadow-lg"
                  style={{
                    backgroundColor: '#6B8E23',
                    color: '#ffffff',
                    border: 'none'
                  }}
                >
                  Start Your Journey
                </button>
              </Link>
              <button
                className="px-8 py-4 rounded-full font-semibold text-base transition-all duration-300 hover:shadow-lg"
                style={{
                  backgroundColor: 'transparent',
                  color: '#6B8E23',
                  border: '2px solid #6B8E23'
                }}
              >
                Learn More
              </button>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap gap-6 pt-4">
              {[
                { label: 'Certified Organic', icon: '🌿' },
                { label: 'Lab Tested', icon: '🔬' },
                { label: 'Eco-Friendly', icon: '♻️' }
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span style={{ fontSize: '20px' }}>{item.icon}</span>
                  <span style={{ color: '#7A6A5A', fontSize: '14px', fontWeight: '500' }}>{item.label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Floating Element */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1, y: [0, -10, 0] }}
            transition={{ 
              opacity: { duration: 0.8, delay: 0.4 },
              scale: { duration: 0.8, delay: 0.4 },
              y: { duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1 }
            }}
            className="mt-12 inline-block px-6 py-4 rounded-2xl shadow-xl"
            style={{
              backgroundColor: '#ffffff',
              border: '2px solid #E8DCC8'
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#F5F1E8' }}>
                <Leaf size={24} style={{ color: '#6B8E23' }} />
              </div>
              <div>
                <p style={{ color: '#3C2F24', fontWeight: '700', fontSize: '18px' }}>100%</p>
                <p style={{ color: '#7A6A5A', fontSize: '12px' }}>Natural</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="absolute bottom-10 left-1/2 transform -translate-x-1/2 cursor-pointer z-20"
      >
        <ChevronDown size={32} style={{ color: '#6B8E23' }} />
      </motion.div>
    </section>
  );
}
