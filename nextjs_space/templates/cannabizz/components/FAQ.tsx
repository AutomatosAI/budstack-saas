'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { ChevronDown } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQProps {
  heading?: string;
  subtitle?: string;
  items?: FAQItem[];
}

const defaultItems: FAQItem[] = [
  {
    question: 'How do I place my first order?',
    answer: 'It\'s super easy — book a free consultation, chat with one of our specialists, get your script sorted, and you\'re good to go. Your first order can be placed right after.',
  },
  {
    question: 'Is everything lab-tested?',
    answer: 'Absolutely. Every single product on our shelves goes through rigorous third-party testing. We don\'t play when it comes to quality and safety.',
  },
  {
    question: 'How fast is delivery?',
    answer: 'We move quick. Orders placed before noon get same-day processing, and you can track your package in real-time. Discreet packaging, always.',
  },
  {
    question: 'Can I get help choosing the right product?',
    answer: 'That\'s literally what we\'re here for. Our team knows their stuff and will match you with the perfect product based on what you\'re looking for.',
  },
  {
    question: 'Do you offer online consultations?',
    answer: 'Yep! We do both in-person and telehealth consults. Book online and pick whatever works best for your schedule. Easy.',
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
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
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
            transition={{ type: 'spring', stiffness: 150, damping: 20 }}
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

export default function FAQ({
  heading = 'Got Questions?',
  subtitle = 'We\'ve got answers. Here\'s the lowdown on how we roll.',
  items = defaultItems,
}: FAQProps) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section
      ref={ref}
      className="py-20"
      style={{ backgroundColor: 'hsl(var(--tenant-color-surface))' }}
    >
      <div className="container mx-auto px-6 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ type: 'spring', stiffness: 100, damping: 12 }}
          className="text-center mb-16"
        >
          <h2
            className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-6"
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
          transition={{ type: 'spring', stiffness: 100, damping: 12, delay: 0.1 }}
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
