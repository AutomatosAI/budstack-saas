import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

interface AboutProps {
  title?: string;
  description?: string;
}

export default function About({ title, description }: AboutProps) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.2 });

  const displayTitle = title || 'Bold. Professional. Trusted.';
  const displayDescription = description || 'We\'re redefining medical cannabis with a fresh, modern approach that combines street-smart style with pharmaceutical-grade quality.';

  return (
    <section id="about" className="py-24 bg-white relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10"
           style={{ background: 'radial-gradient(circle, #FF6B6B 0%, transparent 70%)' }} />
      <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full opacity-10"
           style={{ background: 'radial-gradient(circle, #4ECDC4 0%, transparent 70%)' }} />

      <div ref={ref} className="container mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Image */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="relative h-[500px] rounded-3xl overflow-hidden shadow-2xl gta-card"
          >
            <Image
              src="/templates/gta-cannabis/woman.jpg"
              alt="Our Team"
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <h2 className="text-5xl font-black mb-6" style={{ color: '#1A1A2E' }}>
              {displayTitle}
            </h2>
            
            <p className="text-lg mb-8 leading-relaxed" style={{ color: '#4A4A4A' }}>
              {displayDescription}
            </p>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-6 mt-12">
              <div className="text-center p-4 rounded-xl" style={{ backgroundColor: '#FFF3E0' }}>
                <div className="text-4xl font-black mb-2" style={{ color: '#FF6B6B' }}>5+</div>
                <div className="text-sm font-medium text-gray-600">Years Experience</div>
              </div>
              <div className="text-center p-4 rounded-xl" style={{ backgroundColor: '#E0F7FA' }}>
                <div className="text-4xl font-black mb-2" style={{ color: '#4ECDC4' }}>10K+</div>
                <div className="text-sm font-medium text-gray-600">Happy Patients</div>
              </div>
              <div className="text-center p-4 rounded-xl" style={{ backgroundColor: '#FFF9C4' }}>
                <div className="text-4xl font-black mb-2" style={{ color: '#FFE66D' }}>100%</div>
                <div className="text-sm font-medium text-gray-600">Compliant</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
