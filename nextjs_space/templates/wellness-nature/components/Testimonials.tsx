import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Quote, Star } from 'lucide-react';

const testimonials = [
  {
    name: 'Sarah Johnson',
    role: 'Wellness Enthusiast',
    content: 'The natural products have transformed my daily routine. I feel more balanced and energized.',
    rating: 5
  },
  {
    name: 'Michael Chen',
    role: 'Chronic Pain Patient',
    content: 'After years of trying different solutions, these organic products finally provided the relief I needed.',
    rating: 5
  },
  {
    name: 'Emma Rodriguez',
    role: 'Yoga Instructor',
    content: 'I recommend these products to all my students. The quality and effectiveness are unmatched.',
    rating: 5
  }
];

export default function Testimonials() {
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
            What Our Community Says
          </h2>
          <p className="text-lg" style={{ color: '#7A6A5A' }}>
            Real stories from real people who've experienced natural wellness
          </p>
        </motion.div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="p-8 rounded-2xl relative"
              style={{
                backgroundColor: '#F5F1E8',
                border: '1px solid #E8DCC8'
              }}
            >
              {/* Quote Icon */}
              <div 
                className="absolute -top-4 left-8 w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#6B8E23' }}
              >
                <Quote size={20} style={{ color: '#ffffff' }} />
              </div>

              {/* Rating */}
              <div className="flex gap-1 mb-4 mt-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star key={i} size={16} fill="#FFB800" style={{ color: '#FFB800' }} />
                ))}
              </div>

              {/* Content */}
              <p className="mb-6 text-base" style={{ color: '#3C2F24', lineHeight: '1.7' }}>
                "{testimonial.content}"
              </p>

              {/* Author */}
              <div>
                <p className="font-bold" style={{ color: '#3C2F24' }}>
                  {testimonial.name}
                </p>
                <p className="text-sm" style={{ color: '#7A6A5A' }}>
                  {testimonial.role}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
