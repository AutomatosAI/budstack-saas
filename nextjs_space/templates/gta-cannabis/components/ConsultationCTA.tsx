import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Calendar, MessageCircle, Video } from 'lucide-react';

interface ConsultationCTAProps {
  businessName: string;
  consultationUrl: string;
  title?: string;
  description?: string;
}

export default function ConsultationCTA({ businessName, consultationUrl, title, description }: ConsultationCTAProps) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.2 });

  return (
    <section className="py-24 relative overflow-hidden retro-gradient">
      {/* Animated Background Shapes */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-64 h-64 rounded-full"
          style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />
        <div className="absolute bottom-10 right-10 w-80 h-80 rounded-full"
          style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />
      </div>

      <div ref={ref} className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="max-w-4xl mx-auto text-center"
        >
          {/* Header */}
          <h2 className="text-5xl md:text-6xl font-black text-white mb-6 comic-text">
            {title || 'Ready to Get Started?'}
          </h2>
          <p className="text-xl md:text-2xl text-white/95 mb-12 max-w-2xl mx-auto">
            {description || 'Book your free consultation with our medical cannabis specialists today'}
          </p>

          {/* Consultation Steps */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {[
              {
                icon: Calendar,
                title: '1. Book Online',
                description: 'Schedule a convenient time'
              },
              {
                icon: Video,
                title: '2. Consultation',
                description: 'Meet with our experts'
              },
              {
                icon: MessageCircle,
                title: '3. Get Prescription',
                description: 'Receive your personalized plan'
              }
            ].map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.6, delay: index * 0.1 + 0.2 }}
                  className="p-6 rounded-2xl backdrop-blur-sm"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    border: '2px solid rgba(255, 255, 255, 0.3)'
                  }}
                >
                  <Icon size={48} className="mx-auto mb-4 text-white" />
                  <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-white/90 text-sm">{step.description}</p>
                </motion.div>
              );
            })}
          </div>

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <a
              href={consultationUrl}
              className="retro-button inline-block px-12 py-5 text-xl font-black bg-white text-purple-600 rounded-full hover:scale-105 transition-all pulse-glow-animation"
              style={{ boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)' }}
            >
              Book Free Consultation
            </a>
          </motion.div>

          {/* Trust Badge */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="mt-8 text-white/80 text-sm"
          >
            ✅ No credit card required • ✅ 100% confidential • ✅ Licensed professionals
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
