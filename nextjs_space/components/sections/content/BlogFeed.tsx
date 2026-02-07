'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { ArrowRight, Clock } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';

interface BlogPost {
  title: string;
  excerpt: string;
  date: string;
  slug: string;
  imageUrl?: string;
}

const defaultPosts: BlogPost[] = [
  {
    title: 'Understanding Medical Cannabis: A Beginner\'s Guide',
    excerpt: 'Everything you need to know about starting your medical cannabis journey with confidence.',
    date: '2024-12-15',
    slug: 'beginners-guide',
  },
  {
    title: 'The Science Behind Cannabis and Pain Relief',
    excerpt: 'How cannabinoids interact with your body\'s endocannabinoid system for natural relief.',
    date: '2024-12-10',
    slug: 'cannabis-pain-relief',
  },
  {
    title: 'Choosing the Right Product for Your Needs',
    excerpt: 'A comprehensive guide to flowers, oils, edibles, and topicals — find your fit.',
    date: '2024-12-05',
    slug: 'choosing-products',
  },
];

export function BlogFeed(props: SectionProps) {
  const { sectionConfig, posts: propsPosts } = props;
  const heading = sectionConfig?.heading || 'Latest from The Wire';
  const subtitle = sectionConfig?.subtitle || 'Stay informed with the latest cannabis news and wellness tips';
  const posts: BlogPost[] = sectionConfig?.posts || propsPosts || defaultPosts;
  const basePath = `/store/${props.tenant.subdomain}`;
  const blogUrl = sectionConfig?.blogUrl || `${basePath}/the-wire`;

  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section
      ref={ref}
      className="py-20"
      style={{ backgroundColor: 'hsl(var(--tenant-color-surface))' }}
    >
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2
            className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6"
            style={{
              fontFamily: 'var(--tenant-font-heading, sans-serif)',
              color: 'hsl(var(--tenant-color-heading))',
            }}
          >
            {heading}
          </h2>
          <p className="text-lg" style={{ color: 'hsl(var(--tenant-color-text))' }}>
            {subtitle}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {posts.map((post, index) => (
            <motion.a
              key={index}
              href={`${blogUrl}/${post.slug}`}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              style={{
                backgroundColor: 'hsl(var(--tenant-color-background))',
                border: '1px solid hsl(var(--tenant-color-border))',
              }}
            >
              {/* Placeholder image area */}
              <div
                className="h-48 relative"
                style={{
                  background: `linear-gradient(135deg,
                    hsl(var(--tenant-color-primary) / 0.15) 0%,
                    hsl(var(--tenant-color-secondary) / 0.15) 100%)`,
                }}
              />

              <div className="p-6">
                <div className="flex items-center gap-2 mb-3 text-sm" style={{ color: 'hsl(var(--tenant-color-text))' }}>
                  <Clock size={14} />
                  <time>{new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</time>
                </div>
                <h3
                  className="text-lg font-bold mb-2 group-hover:underline"
                  style={{ color: 'hsl(var(--tenant-color-heading))' }}
                >
                  {post.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'hsl(var(--tenant-color-text))' }}>
                  {post.excerpt}
                </p>
              </div>
            </motion.a>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center mt-12"
        >
          <a
            href={blogUrl}
            className="inline-flex items-center gap-2 text-base font-semibold hover:gap-3 transition-all"
            style={{ color: 'hsl(var(--tenant-color-primary))' }}
          >
            View All Articles <ArrowRight size={16} />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
