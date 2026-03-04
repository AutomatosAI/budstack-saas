'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Mail, ArrowRight } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';

export function Newsletter(props: SectionProps) {
  const { sectionConfig } = props;
  const heading = sectionConfig?.heading || 'Stay in the Loop';
  const subtitle = sectionConfig?.subtitle || 'Get the latest news, offers, and wellness tips delivered to your inbox.';
  const placeholder = sectionConfig?.placeholder || 'you@example.com';
  const buttonText = sectionConfig?.buttonText || 'Subscribe';

  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.2 });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) setSubmitted(true);
  };

  return (
    <section
      ref={ref}
      className="py-8 sm:py-10"
      style={{
        background: `linear-gradient(135deg,
          hsl(var(--tenant-color-primary)) 0%,
          hsl(var(--tenant-color-secondary)) 100%)`,
      }}
    >
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mx-auto text-center"
        >
          <div className="w-14 h-14 mx-auto mb-6 rounded-full bg-white/10 flex items-center justify-center">
            <Mail size={28} className="text-white" />
          </div>

          <h2
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4"
            style={{ fontFamily: 'var(--tenant-font-heading, sans-serif)' }}
          >
            {heading}
          </h2>

          <p className="text-white/80 text-base sm:text-lg mb-8 max-w-xl mx-auto">
            {subtitle}
          </p>

          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-white text-lg font-medium"
            >
              Thanks for subscribing! Check your inbox soon.
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={placeholder}
                required
                className="flex-1 px-5 py-3.5 rounded-full bg-white/10 text-white placeholder-white/50 border border-white/20 focus:outline-none focus:border-white/50 transition-colors text-base"
              />
              <button
                type="submit"
                className="px-8 py-3.5 rounded-full font-semibold transition-all hover:scale-105 flex items-center justify-center gap-2 shrink-0"
                style={{
                  backgroundColor: 'white',
                  color: 'hsl(var(--tenant-color-primary))',
                }}
              >
                {buttonText}
                <ArrowRight size={18} />
              </button>
            </form>
          )}

          <p className="mt-6 text-white/50 text-sm">
            No spam, ever. Unsubscribe anytime.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
