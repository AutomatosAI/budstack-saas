'use client';

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

// Botanical leaf motif SVG component
const BotanicalMotif = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Main leaf stem */}
    <path
      d="M60 100 Q 60 60, 60 20"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
      opacity="0.6"
    />
    {/* Left leaf curves */}
    <path
      d="M60 80 Q 30 70, 20 50"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
      opacity="0.5"
    />
    <path
      d="M60 60 Q 35 50, 25 35"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
      opacity="0.4"
    />
    <path
      d="M60 40 Q 40 32, 35 20"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
      opacity="0.3"
    />
    {/* Right leaf curves */}
    <path
      d="M60 80 Q 90 70, 100 50"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
      opacity="0.5"
    />
    <path
      d="M60 60 Q 85 50, 95 35"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
      opacity="0.4"
    />
    <path
      d="M60 40 Q 80 32, 85 20"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
      opacity="0.3"
    />
    {/* Small decorative circles */}
    <circle cx="20" cy="50" r="3" fill="currentColor" opacity="0.3" />
    <circle cx="100" cy="50" r="3" fill="currentColor" opacity="0.3" />
    <circle cx="60" cy="15" r="4" fill="currentColor" opacity="0.4" />
  </svg>
);

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

const textVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: [0.25, 0.4, 0.25, 1] as [number, number, number, number],
    },
  },
};

const imageVariants = {
  hidden: { opacity: 0, scale: 0.95, x: 30 },
  visible: {
    opacity: 1,
    scale: 1,
    x: 0,
    transition: {
      duration: 0.8,
      ease: [0.25, 0.4, 0.25, 1] as [number, number, number, number],
    },
  },
};

const AboutHero = () => {
  const imageRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: imageRef,
    offset: ["start end", "end start"]
  });

  const imageY = useTransform(scrollYProgress, [0, 1], ["-20%", "20%"]);

  return (
    <motion.section
      className="py-16 sm:py-20 md:py-24 bg-background relative"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={containerVariants}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
          <motion.div variants={textVariants}>
            <motion.h2
              className="text-3xl sm:text-4xl md:text-5xl font-semibold text-foreground mb-6 tracking-tight leading-tight"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Healing Buds: Advancing Global Cannabis Innovation
            </motion.h2>
            <motion.p
              className="text-base sm:text-lg text-muted-foreground leading-relaxed"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Committed to excellence in every product we create and championing worldwide cannabis acceptance through quality and integrity.
            </motion.p>
          </motion.div>

          <motion.div
            ref={imageRef}
            className="relative overflow-hidden rounded-2xl shadow-elegant"
            variants={imageVariants}
            style={{ position: 'relative' }}
          >
            <motion.img
              style={{ y: imageY }}
              src="/templates/healingbuds/greenhouse-exterior-hq.jpg"
              alt="Cannabis cultivation facility with rows of plants"
              className="rounded-2xl w-full h-auto scale-110"
            />
            {/* Botanical decorative elements */}
            <BotanicalMotif
              className="absolute -top-2 -right-2 w-20 h-20 sm:w-24 sm:h-24 text-primary opacity-60 rotate-45"
            />
            <BotanicalMotif
              className="absolute -bottom-2 -left-2 w-20 h-20 sm:w-24 sm:h-24 text-primary opacity-60 -rotate-45 scale-x-[-1]"
            />
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
};

export default AboutHero;
