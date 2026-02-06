import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Sparkles, Heart, Sun, Zap } from 'lucide-react';

interface LifestyleSectionProps {
  businessName: string;
  title?: string;
  content?: string;
}

export default function LifestyleSection({ businessName, title, content }: LifestyleSectionProps) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section ref={ref} className="py-20 bg-gradient-to-b from-white via-orange-50/30 to-white relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-orange-200/30 to-pink-200/30 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-cyan-200/30 to-yellow-200/30 rounded-full blur-3xl" />

      <div className="max-w-7xl mx-auto px-6 lg:px-12 relative z-10">
        <div className="grid lg:grid-cols-5 gap-12 items-center">
          {/* Image Column - Takes 2 columns */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="lg:col-span-2 relative"
          >
            <div className="relative rounded-3xl overflow-hidden shadow-2xl sunset-border max-w-md mx-auto">
              <Image
                src="/templates/gta-cannabis/woman.jpg"
                alt="Lifestyle"
                width={600}
                height={900}
                className="w-full h-auto object-cover"
                priority
              />
              {/* Decorative Overlay Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
            </div>

            {/* Floating Badge */}
            <motion.div
              initial={{ scale: 0 }}
              animate={inView ? { scale: 1 } : {}}
              transition={{ delay: 0.5, type: 'spring' }}
              className="absolute -bottom-4 -right-4 bg-white rounded-2xl shadow-2xl p-5 retro-button"
              style={{
                background: 'linear-gradient(135deg, #FFE66D 0%, #FF6B6B 100%)',
                border: '3px solid rgba(255, 255, 255, 0.9)'
              }}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="text-white" size={28} />
                <div>
                  <p className="text-white font-black text-lg" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
                    Premium
                  </p>
                  <p className="text-white/90 text-xs font-bold">Quality</p>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Content Column - Takes 3 columns */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="lg:col-span-3 space-y-6"
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full retro-button"
              style={{
                background: 'linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%)',
                border: '2px solid rgba(255, 255, 255, 0.8)'
              }}
            >
              <Sparkles className="text-white" size={16} />
              <span className="text-white font-bold text-sm">Your Wellness Journey</span>
            </div>

            {/* Heading */}
            <h2
              className="text-4xl md:text-5xl font-black leading-tight"
              style={{
                background: 'linear-gradient(135deg, #FF6B6B 0%, #FFE66D 50%, #4ECDC4 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                textShadow: '0 0 40px rgba(255, 230, 109, 0.3)'
              }}
            >
              {title || 'Live Your Best Life'}
            </h2>

            {/* Description */}
            <div className="space-y-3">
              {content ? (
                <p className="text-gray-700 text-base leading-relaxed whitespace-pre-line">{content}</p>
              ) : (
                <>
                  <p className="text-gray-700 text-base leading-relaxed">
                    At <span className="font-bold text-gray-900">{businessName}</span>, we believe in the power of nature
                    to enhance your well-being. Our carefully curated selection of premium medical cannabis products
                    is designed to help you live life to the fullest.
                  </p>
                  <p className="text-gray-700 text-base leading-relaxed">
                    Whether you're seeking relief, relaxation, or simply exploring natural wellness alternatives,
                    our expert team is here to guide you every step of the way.
                  </p>
                </>
              )}
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-3 gap-4 pt-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.4 }}
                className="text-center"
              >
                <div
                  className="w-14 h-14 mx-auto mb-2 rounded-xl flex items-center justify-center retro-button"
                  style={{
                    background: 'linear-gradient(135deg, #FFE66D 0%, #FF6B6B 100%)',
                    border: '2px solid rgba(255, 255, 255, 0.8)'
                  }}
                >
                  <Sun className="text-white" size={24} />
                </div>
                <p className="text-gray-900 font-bold text-sm">Natural</p>
                <p className="text-gray-600 text-xs">100% Organic</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.5 }}
                className="text-center"
              >
                <div
                  className="w-14 h-14 mx-auto mb-2 rounded-xl flex items-center justify-center retro-button"
                  style={{
                    background: 'linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%)',
                    border: '2px solid rgba(255, 255, 255, 0.8)'
                  }}
                >
                  <Heart className="text-white" size={24} />
                </div>
                <p className="text-gray-900 font-bold text-sm">Caring</p>
                <p className="text-gray-600 text-xs">Expert Guidance</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.6 }}
                className="text-center"
              >
                <div
                  className="w-14 h-14 mx-auto mb-2 rounded-xl flex items-center justify-center retro-button"
                  style={{
                    background: 'linear-gradient(135deg, #FF6B6B 0%, #C44569 100%)',
                    border: '2px solid rgba(255, 255, 255, 0.8)'
                  }}
                >
                  <Zap className="text-white" size={24} />
                </div>
                <p className="text-gray-900 font-bold text-sm">Effective</p>
                <p className="text-gray-600 text-xs">Proven Results</p>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
