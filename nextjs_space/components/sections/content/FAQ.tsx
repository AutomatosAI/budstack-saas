'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { ChevronDown } from 'lucide-react';
import { SectionProps } from '@/lib/types/section-props';

interface FAQItem {
  question: string;
  answer: string;
}

const defaultItems: FAQItem[] = [
  {
    question: 'How do I get started with medical cannabis?',
    answer: 'Book a free consultation with one of our licensed professionals. They will assess your needs and guide you through the process of obtaining a prescription.',
  },
  {
    question: 'Is medical cannabis safe?',
    answer: 'When used under professional guidance, medical cannabis has been shown to be safe and effective for many conditions. All our products are lab-tested and quality-assured.',
  },
  {
    question: 'How is my order delivered?',
    answer: 'We offer discreet, tracked delivery to your door. All packages are plain and unmarked for your privacy.',
  },
  {
    question: 'What conditions can medical cannabis help with?',
    answer: 'Medical cannabis may help with chronic pain, anxiety, insomnia, inflammation, and many other conditions. Consult with our specialists to learn more.',
  },
  {
    question: 'Do you offer consultations online?',
    answer: 'Yes, we offer both in-person and telehealth consultations for your convenience. Book online and choose the option that works best for you.',
  },
];

function AccordionItem({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div
      className="border-b"
      style={{ borderColor: 'hsl(var(--tenant-color-border))' }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-5 text-left"
      >
        <span
          className="text-lg font-semibold pr-4"
          style={{ color: 'hsl(var(--tenant-color-heading))' }}
        >
          {item.question}
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <ChevronDown size={20} style={{ color: 'hsl(var(--tenant-color-primary))' }} />
        </motion.span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <p
              className="pb-5 leading-relaxed"
              style={{ color: 'hsl(var(--tenant-color-text))' }}
            >
              {item.answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FAQ(props: SectionProps) {
  const { sectionConfig } = props;
  const heading = sectionConfig?.heading || 'Frequently Asked Questions';
  const subtitle = sectionConfig?.subtitle || 'Find answers to common questions about our services';
  const items: FAQItem[] = sectionConfig?.items || defaultItems;

  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section
      ref={ref}
      className="py-20"
      style={{ backgroundColor: 'hsl(var(--tenant-color-background))' }}
    >
      <div className="container mx-auto px-6 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {items.map((item, index) => (
            <AccordionItem
              key={index}
              item={item}
              isOpen={openIndex === index}
              onToggle={() => setOpenIndex(openIndex === index ? null : index)}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
