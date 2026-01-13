
'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  Stethoscope, 
  ArrowRight, 
  Phone, 
  Shield, 
  Clock, 
  CheckCircle,
  Star,
  Users,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tenant } from '@/types/client';

interface CallToActionProps {
  tenant?: Tenant | null;
  consultationUrl?: string;
}

export function CallToAction({ tenant, consultationUrl = '/store/healingbuds/consultation' }: CallToActionProps = {}) {
  const brandName = tenant?.businessName || 'HealingBuds';
  const benefits = [
    {
      icon: Stethoscope,
      text: 'Free consultation with licensed doctors'
    },
    {
      icon: Clock,
      text: '24-48 hour response time'
    },
    {
      icon: Shield,
      text: 'INFARMED-regulated prescriptions'
    },
    {
      icon: CheckCircle,
      text: 'Personalized treatment plans'
    }
  ];

  const stats = [
    { number: '98%', label: 'Patient Satisfaction' },
    { number: '2,500+', label: 'Patients Helped' },
    { number: '24/7', label: 'Support Available' },
    { number: '85%', label: 'Success Rate' }
  ];

  return (
    <section className="py-20 bg-gradient-to-br from-green-800 via-green-700 to-blue-800 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-32 h-32 bg-blue-300/10 rounded-full blur-2xl" />
        <div className="absolute top-1/2 left-1/3 w-24 h-24 bg-green-300/10 rounded-full blur-xl" />
        
        {/* Medical pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="grid grid-cols-12 gap-8 h-full p-8">
            {Array.from({ length: 48 }).map((_, i) => (
              <div key={i} className="flex items-center justify-center">
                <Stethoscope className="w-6 h-6 text-white rotate-12" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left column - Main CTA */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="text-white space-y-8"
          >
            <div className="space-y-6">
              <h2 className="text-4xl sm:text-5xl font-bold font-serif leading-tight">
                Start Your Medical Cannabis 
                <span className="text-green-300 block">
                  Journey Today
                </span>
              </h2>
              <p className="text-xl text-green-100 leading-relaxed">
                Join thousands of Portuguese patients who have found relief through our 
                safe, legal, and INFARMED-regulated medical cannabis consultation service.
              </p>
            </div>

            {/* Benefits list */}
            <div className="space-y-4">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="flex items-center space-x-3"
                >
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <benefit.icon className="w-4 h-4 text-green-300" />
                  </div>
                  <span className="text-green-50">{benefit.text}</span>
                </motion.div>
              ))}
            </div>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex flex-col sm:flex-row gap-4 pt-4"
            >
              <Link href={consultationUrl}>
                <Button size="lg" className="bg-white text-green-800 hover:bg-green-50 shadow-2xl hover:shadow-3xl transition-all duration-300 group">
                  <Stethoscope className="w-5 h-5 mr-2" />
                  Start Free Consultation
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link href="/contact">
                <Button variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10 shadow-lg hover:shadow-xl transition-all duration-300">
                  <Phone className="w-4 h-4 mr-2" />
                  Talk to Support
                </Button>
              </Link>
            </motion.div>

            {/* Trust indicators */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="flex flex-wrap items-center gap-6 pt-4 text-sm text-green-200"
            >
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-300" />
                <span>GDPR Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-300" />
                <span>Licensed Doctors</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-300" />
                <span>INFARMED Regulated</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Right column - Stats and testimonial */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="space-y-8"
          >
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-6">
              {stats.map((stat, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.5 + index * 0.1 }}
                  className="bg-white/10 backdrop-blur-md rounded-xl p-6 text-center hover:bg-white/20 transition-all duration-300"
                >
                  <div className="text-3xl font-bold text-white mb-2">
                    {stat.number}
                  </div>
                  <div className="text-green-200 text-sm">
                    {stat.label}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Featured testimonial */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="bg-white/5 backdrop-blur-md rounded-xl p-8 border border-white/10"
            >
              <div className="flex items-start space-x-4 mb-6">
                <MessageSquare className="w-6 h-6 text-green-300 mt-1 flex-shrink-0" />
                <div>
                  <div className="flex items-center space-x-1 mb-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <blockquote className="text-white text-lg leading-relaxed mb-4">
                    "{brandName} completely transformed my quality of life. The consultation process 
                    was professional, and the treatment plan has been incredibly effective for my chronic pain."
                  </blockquote>
                  <div className="text-green-200 text-sm">
                    — Maria S., Chronic Pain Patient, Lisbon
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Emergency contact */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="bg-orange-500/20 border border-orange-400/30 rounded-xl p-6"
            >
              <div className="flex items-center space-x-3 mb-3">
                <Phone className="w-5 h-5 text-orange-300" />
                <span className="text-white font-semibold">24/7 Emergency Support</span>
              </div>
              <p className="text-orange-100 text-sm mb-4">
                Need immediate assistance? Our medical support team is available around the clock.
              </p>
              <div className="flex items-center space-x-4 text-sm">
                <span className="text-orange-200">📞 +351 21 234 5678</span>
                <span className="text-orange-200">✉️ emergency@healingbuds.pt</span>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Bottom section - Additional CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1 }}
          className="mt-16 text-center"
        >
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-8 border border-white/10">
            <h3 className="text-2xl font-bold text-white mb-4 font-serif">
              Not Sure Where to Start?
            </h3>
            <p className="text-green-100 mb-6 max-w-2xl mx-auto">
              Our patient care team is here to guide you through every step of the process, 
              from initial questions to ongoing treatment support.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/how-it-works">
                <Button variant="outline" className="border-white/30 text-white hover:bg-white/10">
                  Learn How It Works
                </Button>
              </Link>
              <Link href="/faq">
                <Button variant="outline" className="border-white/30 text-white hover:bg-white/10">
                  Read FAQ
                </Button>
              </Link>
              <Link href="/contact">
                <Button variant="outline" className="border-white/30 text-white hover:bg-white/10">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Live Chat
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
