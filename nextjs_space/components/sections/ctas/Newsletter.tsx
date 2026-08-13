'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Mail, ArrowRight, Loader2 } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';
import { headerAlignClasses } from '@/lib/templates/section-align';
import { subscribeToNewsletter } from '@/lib/email/newsletter-signup';

export function Newsletter(props: SectionProps) {
  const { sectionConfig, tenant } = props;
  const heading = sectionConfig?.heading || 'Stay in the Loop';
  const subtitle = sectionConfig?.subtitle || 'Get the latest news, offers, and wellness tips delivered to your inbox.';
  const placeholder = sectionConfig?.placeholder || 'you@example.com';
  const buttonText = sectionConfig?.buttonText || 'Subscribe';
  const successText = sectionConfig?.successText || 'Thanks for subscribing!';
  const backgroundImageUrl = sectionConfig?.backgroundImageUrl || null;
  const overlayOpacity = parseFloat(sectionConfig?.overlayOpacity ?? '0.5');

  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.2 });

  // The success state is only entered once the server has actually recorded
  // the signup — the old stub set it unconditionally and the copy lied.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || submitting) return;

    setSubmitting(true);
    setError(null);
    const result = await subscribeToNewsletter({
      email,
      source: 'storefront-cta',
      tenantSlug: tenant?.subdomain,
    });
    setSubmitting(false);

    if (result.ok) {
      setSubmitted(true);
      setEmail('');
      return;
    }
    setError(result.message ?? null);
  };

  return (
    <section
      ref={ref}
      className="relative py-16 sm:py-20 lg:py-24"
      style={{
        background: `linear-gradient(135deg,
          hsl(var(--tenant-color-primary)) 0%,
          hsl(var(--tenant-color-secondary)) 100%)`,
      }}
    >
      {backgroundImageUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={backgroundImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover z-0" />
          <div
            className="absolute inset-0 z-[1]"
            style={{ backgroundColor: `hsl(var(--tenant-color-background) / ${overlayOpacity})` }}
          />
        </>
      )}
      <div className="relative z-10 container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className={`max-w-2xl ${headerAlignClasses(sectionConfig?.textAlign)}`}
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
              {successText}
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={placeholder}
                required
                disabled={submitting}
                aria-invalid={error ? true : undefined}
                className="flex-1 px-5 py-3.5 rounded-full bg-white/10 text-white placeholder-white/50 border border-white/20 focus:outline-none focus:border-white/50 transition-colors text-base disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={submitting}
                className="px-8 py-3.5 rounded-full font-semibold transition-all hover:scale-105 flex items-center justify-center gap-2 shrink-0 disabled:opacity-60 disabled:hover:scale-100"
                style={{
                  backgroundColor: 'white',
                  color: 'hsl(var(--tenant-color-primary))',
                }}
              >
                {buttonText}
                {submitting ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <ArrowRight size={18} />
                )}
              </button>
            </form>
          )}

          {error && !submitted && (
            <p role="alert" className="mt-4 text-white text-sm font-medium">
              {error}
            </p>
          )}

          <p className="mt-6 text-white/50 text-sm">
            No spam, ever. Unsubscribe anytime.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
