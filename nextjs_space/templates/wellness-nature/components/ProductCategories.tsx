import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface ProductCategoriesProps {
  productsUrl: string;
}

const categories = [
  {
    name: 'CBD Oils',
    description: 'Pure, organic CBD extracts for daily wellness',
    emoji: '🌿',
    gradient: 'from-green-100 to-emerald-100'
  },
  {
    name: 'Wellness Teas',
    description: 'Soothing herbal blends for relaxation',
    emoji: '🍵',
    gradient: 'from-amber-100 to-yellow-100'
  },
  {
    name: 'Topicals',
    description: 'Natural creams and balms for targeted relief',
    emoji: '🧴',
    gradient: 'from-blue-100 to-cyan-100'
  },
  {
    name: 'Capsules',
    description: 'Convenient, precisely-dosed supplements',
    emoji: '💊',
    gradient: 'from-purple-100 to-pink-100'
  }
];

export default function ProductCategories({ productsUrl }: ProductCategoriesProps) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section ref={ref} className="py-16" style={{ backgroundColor: '#F5F1E8' }}>
      <div className="container mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6" style={{ color: '#3C2F24' }}>
            Explore Our Natural Collection
          </h2>
          <p className="text-lg" style={{ color: '#7A6A5A' }}>
            Discover wellness products crafted from nature's finest ingredients
          </p>
        </motion.div>

        {/* Categories Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {categories.map((category, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className={`bg-gradient-to-br ${category.gradient} p-8 rounded-2xl text-center cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl`}
              style={{ border: '1px solid rgba(255, 255, 255, 0.8)' }}
            >
              <div className="text-5xl mb-4">{category.emoji}</div>
              <h3 className="text-xl font-bold mb-2" style={{ color: '#3C2F24' }}>
                {category.name}
              </h3>
              <p className="text-sm" style={{ color: '#7A6A5A' }}>
                {category.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center"
        >
          <Link href={productsUrl}>
            <button
              className="px-8 py-4 rounded-full font-semibold text-base transition-all duration-300 hover:shadow-lg inline-flex items-center gap-2"
              style={{
                backgroundColor: '#6B8E23',
                color: '#ffffff',
                border: 'none'
              }}
            >
              View All Products
              <ArrowRight size={20} />
            </button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
