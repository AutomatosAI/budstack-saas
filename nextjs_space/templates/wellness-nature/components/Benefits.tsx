import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Heart, Brain, Sparkles, Shield } from 'lucide-react';

interface BenefitsProps {
  businessName: string;
}

const benefits = [
  {
    icon: Heart,
    title: 'Holistic Healing',
    description: 'Natural solutions that address both body and mind for complete wellness.'
  },
  {
    icon: Brain,
    title: 'Mental Clarity',
    description: 'Enhance focus, reduce stress, and find your inner balance naturally.'
  },
  {
    icon: Sparkles,
    title: 'Pure & Natural',
    description: '100% organic ingredients, no synthetic additives or harmful chemicals.'
  },
  {
    icon: Shield,
    title: 'Trusted Quality',
    description: 'Lab-tested, certified products you can trust for your wellness journey.'
  }
];

export default function Benefits({ businessName }: BenefitsProps) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section ref={ref} className="py-16" style={{ backgroundColor: '#ffffff' }}>
      <div className="container mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6" style={{ color: '#3C2F24' }}>
            Why Choose Natural Wellness
          </h2>
          <p className="text-lg" style={{ color: '#7A6A5A' }}>
            Experience the transformative power of nature with our carefully curated wellness solutions
          </p>
        </motion.div>

        {/* Benefits Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="text-center p-8 rounded-2xl transition-all duration-300 hover:shadow-xl"
                style={{
                  backgroundColor: '#F5F1E8',
                  border: '1px solid #E8DCC8'
                }}
              >
                <div 
                  className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#ffffff' }}
                >
                  <Icon size={32} style={{ color: '#6B8E23' }} />
                </div>
                <h3 className="text-xl font-bold mb-3" style={{ color: '#3C2F24' }}>
                  {benefit.title}
                </h3>
                <p style={{ color: '#7A6A5A', lineHeight: '1.6' }}>
                  {benefit.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
