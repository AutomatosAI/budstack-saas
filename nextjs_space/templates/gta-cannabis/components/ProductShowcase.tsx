import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Sparkles, ArrowRight } from 'lucide-react';

interface ProductShowcaseProps {
  businessName: string;
  productsUrl: string;
}

const productCategories = [
  {
    name: 'Flowers',
    description: 'Premium dried cannabis buds',
    gradient: 'from-pink-500 to-orange-500',
    icon: '🌸'
  },
  {
    name: 'Oils',
    description: 'High-concentration extracts',
    gradient: 'from-teal-500 to-cyan-500',
    icon: '💧'
  },
  {
    name: 'Edibles',
    description: 'Delicious infused treats',
    gradient: 'from-yellow-500 to-amber-500',
    icon: '🍬'
  },
  {
    name: 'Vapes',
    description: 'Convenient vaporizer products',
    gradient: 'from-purple-500 to-pink-500',
    icon: '💨'
  }
];

export default function ProductShowcase({ businessName, productsUrl }: ProductShowcaseProps) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-20 bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-20 right-10 float-animation">
        <Sparkles size={60} style={{ color: '#FFE66D', opacity: 0.3 }} />
      </div>
      <div className="absolute bottom-20 left-10 float-animation" style={{ animationDelay: '1s' }}>
        <Sparkles size={80} style={{ color: '#4ECDC4', opacity: 0.3 }} />
      </div>

      <div ref={ref} className="container mx-auto px-6">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-5xl font-black mb-4" style={{ color: '#1A1A2E' }}>
            Our Product Range
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Explore our curated selection of premium medical cannabis products
          </p>
        </motion.div>

        {/* Product Categories Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {productCategories.map((category, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="gta-card p-8 rounded-2xl bg-white shadow-lg text-center"
            >
              <div className="text-6xl mb-4">{category.icon}</div>
              <h3 className="text-2xl font-bold mb-2" style={{ color: '#1A1A2E' }}>
                {category.name}
              </h3>
              <p className="text-gray-600 text-sm">
                {category.description}
              </p>
              <div className={`mt-4 h-2 rounded-full bg-gradient-to-r ${category.gradient}`} />
            </motion.div>
          ))}
        </div>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-center"
        >
          <a
            href={productsUrl}
            className="retro-button inline-flex items-center gap-2 px-8 py-3 text-base font-semibold text-white rounded-full transition-all neon-glow"
            style={{ backgroundColor: '#4ECDC4' }}
          >
            Browse All Products
            <ArrowRight size={20} />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
