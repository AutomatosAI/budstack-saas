
'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  Shield, 
  Award, 
  Users, 
  Lock, 
  CheckCircle, 
  Star,
  Building,
  Leaf,
  Globe
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

export function TrustBadges() {
  const { t } = useLanguage();
  
  const badges = [
    {
      icon: Shield,
      title: t('trust.badge.infarmed.title'),
      description: t('trust.badge.infarmed.description'),
      color: 'blue'
    },
    {
      icon: Award,
      title: t('trust.badge.euGmp.title'),
      description: t('trust.badge.euGmp.description'),
      color: 'yellow'
    },
    {
      icon: Lock,
      title: t('trust.badge.blockchain.title'),
      description: t('trust.badge.blockchain.description'),
      color: 'green'
    }
  ];

  const getColorClasses = (color: string) => {
    const colorMap = {
      blue: 'bg-blue-50 border-blue-200 text-blue-800',
      yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      green: 'bg-green-50 border-green-200 text-green-800',
      purple: 'bg-purple-50 border-purple-200 text-purple-800',
      orange: 'bg-orange-50 border-orange-200 text-orange-800'
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.green;
  };

  const getIconColorClasses = (color: string) => {
    const colorMap = {
      blue: 'text-blue-600',
      yellow: 'text-yellow-600',
      green: 'text-green-600',
      purple: 'text-purple-600',
      orange: 'text-orange-600'
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.green;
  };

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold text-gray-900 mb-4 font-serif">
            {t('trust.section.title')}
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            {t('trust.section.description')}
          </p>
        </motion.div>

        {/* Trust badges grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {badges.map((badge, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ y: -5, boxShadow: '0 20px 40px -12px rgba(0,0,0,0.25)' }}
              className={`trust-badge ${getColorClasses(badge.color)}`}
            >
              <div className="flex items-start space-x-4">
                <div className={`p-3 rounded-lg bg-white shadow-sm ${getIconColorClasses(badge.color)}`}>
                  <badge.icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2">{badge.title}</h3>
                  <p className="text-sm opacity-80 leading-relaxed">{badge.description}</p>
                </div>
              </div>
              
              {/* Verification checkmark */}
              <div className="mt-4 pt-4 border-t border-current border-opacity-20">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium opacity-80">{t('trust.badge.verified')}</span>
                  <CheckCircle className="w-4 h-4 opacity-60" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Additional certifications */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-16 bg-white rounded-2xl shadow-lg p-8"
        >
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4 font-serif">
              {t('trust.regulatory.title')}
            </h3>
            <p className="text-gray-600 max-w-2xl mx-auto">
              {t('trust.regulatory.description')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building className="w-8 h-8 text-blue-600" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">{t('trust.law33.title')}</h4>
              <p className="text-sm text-gray-600">
                {t('trust.law33.description')}
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Leaf className="w-8 h-8 text-green-600" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">{t('trust.decree8.title')}</h4>
              <p className="text-sm text-gray-600">
                {t('trust.decree8.description')}
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Globe className="w-8 h-8 text-purple-600" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">{t('trust.euStandards.title')}</h4>
              <p className="text-sm text-gray-600">
                {t('trust.euStandards.description')}
              </p>
            </div>
          </div>

          {/* Verification footer */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <div className="flex flex-col md:flex-row items-center justify-between">
              <div className="flex items-center space-x-4 mb-4 md:mb-0">
                <Shield className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-gray-700">
                  {t('trust.certificationsVerified')} {new Date().toLocaleDateString()}
                </span>
              </div>
              <Link href="/about" className="text-sm text-blue-600 hover:text-blue-800 transition-colors">
                {t('trust.viewCertifications')}
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
