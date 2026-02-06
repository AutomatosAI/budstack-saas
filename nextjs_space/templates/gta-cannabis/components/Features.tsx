import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Shield, Leaf, Award, Clock, Users, CheckCircle } from 'lucide-react';

const features = [
  {
    icon: Shield,
    title: 'Certified & Compliant',
    description: 'Fully licensed and regulated for your peace of mind',
    color: '#FF6B6B'
  },
  {
    icon: Leaf,
    title: 'Premium Quality',
    description: 'Lab-tested products with verified potency and purity',
    color: '#4ECDC4'
  },
  {
    icon: Award,
    title: 'Expert Guidance',
    description: 'Professional consultations with licensed specialists',
    color: '#FFE66D'
  },
  {
    icon: Clock,
    title: 'Fast Delivery',
    description: 'Quick and discreet shipping to your door',
    color: '#A463F2'
  },
  {
    icon: Users,
    title: 'Patient Support',
    description: '24/7 customer care for all your questions',
    color: '#FF6B6B'
  },
  {
    icon: CheckCircle,
    title: 'Verified Products',
    description: 'Every batch tested and certified for safety',
    color: '#4ECDC4'
  }
];

export default function Features() {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-24 relative overflow-hidden" style={{ backgroundColor: '#1A1A2E' }}>
      {/* Animated Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 10px,
            rgba(255, 107, 107, 0.1) 10px,
            rgba(255, 107, 107, 0.1) 20px
          )`
        }} />
      </div>

      <div ref={ref} className="container mx-auto px-6 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-5xl font-black text-white mb-4">
            Why Choose Us?
          </h2>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            We combine street-smart innovation with medical-grade excellence
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="gta-card p-8 rounded-2xl backdrop-blur-sm"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
              >
                <div
                  className="w-16 h-16 rounded-xl flex items-center justify-center mb-6"
                  style={{
                    backgroundColor: `${feature.color}20`,
                    border: `2px solid ${feature.color}`
                  }}
                >
                  <Icon size={32} style={{ color: feature.color }} />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-300 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
