import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import { Calendar, CheckCircle, Users } from 'lucide-react';

interface ConsultationCTAProps {
  businessName: string;
  consultationUrl: string;
}

const steps = [
  {
    icon: Calendar,
    title: 'Schedule',
    description: 'Book your free consultation online'
  },
  {
    icon: Users,
    title: 'Consult',
    description: 'Meet with our wellness experts'
  },
  {
    icon: CheckCircle,
    title: 'Begin',
    description: 'Start your natural healing journey'
  }
];

export default function ConsultationCTA({ businessName, consultationUrl }: ConsultationCTAProps) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.2 });

  return (
    <section ref={ref} className="py-20 relative overflow-hidden" style={{ backgroundColor: '#6B8E23' }}>
      {/* Decorative Background */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="max-w-5xl mx-auto"
        >
          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-6" style={{ color: '#ffffff' }}>
              Begin Your Wellness Journey
            </h2>
            <p className="text-xl" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
              Take the first step towards natural healing with a free consultation
            </p>
          </div>

          {/* Steps */}
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }}
                  className="text-center"
                >
                  <div 
                    className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', border: '2px solid rgba(255, 255, 255, 0.3)' }}
                  >
                    <Icon size={28} style={{ color: '#ffffff' }} />
                  </div>
                  <h3 className="text-xl font-bold mb-2" style={{ color: '#ffffff' }}>
                    {index + 1}. {step.title}
                  </h3>
                  <p style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                    {step.description}
                  </p>
                </motion.div>
              );
            })}
          </div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-center"
          >
            <Link href={consultationUrl}>
              <button
                className="px-10 py-5 rounded-full font-bold text-lg transition-all duration-300 hover:shadow-2xl"
                style={{
                  backgroundColor: '#ffffff',
                  color: '#6B8E23',
                  border: 'none'
                }}
              >
                Book Free Consultation
              </button>
            </Link>
            <p className="mt-4 text-sm" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
              No credit card required • 100% confidential • Certified practitioners
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
