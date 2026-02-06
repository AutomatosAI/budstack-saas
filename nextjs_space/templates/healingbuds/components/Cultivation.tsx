'use client';

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const Cultivation = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: imageRef,
    offset: ["start end", "end start"]
  });

  const imageY = useTransform(scrollYProgress, [0, 1], ["-15%", "15%"]);

  // Section reveal animation variants
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

  const itemVariants = {
    hidden: { opacity: 0, y: 40, scale: 0.98 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.7,
        ease: [0.25, 0.4, 0.25, 1] as [number, number, number, number],
      },
    },
  };

  return (
    <motion.section
      ref={sectionRef}
      className="bg-background py-12 sm:py-16 md:py-20 px-2"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      variants={containerVariants}
    >
      <div className="max-w-[1920px] mx-auto px-2">
        <motion.div
          ref={imageRef}
          className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl group"
          variants={itemVariants}
        >
          <motion.img
            style={{ y: imageY }}
            src="/templates/healingbuds/indoor-grow-hq.jpg"
            alt="Indoor cannabis cultivation facility with advanced lighting"
            className="w-full h-[450px] sm:h-[400px] md:h-[500px] object-cover object-center transition-transform duration-700 group-hover:scale-105 scale-110"
          />
          {/* Dark brand friendly overlays */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0D2423]/95 via-[#0D2423]/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0D2423]/90 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-black/20" />

          <div className="absolute inset-0 flex flex-col justify-center px-4 sm:px-8 md:px-16">
            {/* Content card with backdrop - dark themed */}
            <motion.div
              className="bg-[#0D2423]/90 backdrop-blur-md rounded-2xl p-6 sm:p-8 md:p-10 max-w-3xl border border-white/5 shadow-2xl"
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
            >
              <motion.h2
                className="font-pharma text-2xl sm:text-4xl md:text-5xl font-semibold text-white mb-3 sm:mb-6 tracking-tight leading-tight"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                Production & Processing Excellence
              </motion.h2>
              <motion.p
                className="font-body text-white/70 text-xs sm:text-base md:text-lg leading-relaxed mb-4 sm:mb-8"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                Our state-of-the-art facilities across South Africa and Portugal span more than 18,000 square metres dedicated to pharmaceutical-grade cannabis production, supporting our annual output of 60 tonnes. With access to diverse strains and genetics from our licensed partner network, we maintain rigorous oversight from seed selection through harvesting and processing. Each batch undergoes comprehensive testing, precise trimming, controlled drying and curing, and careful packaging to ensure consistent quality that meets stringent third-party standards.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.6 }}
              >
                <Link
                  href="#"
                  className="font-body text-white hover:text-[#0D2423] font-semibold text-sm sm:text-lg transition-all inline-flex items-center gap-2 group/link bg-white/10 hover:bg-white px-6 py-3 rounded-full border border-white/20 hover:border-white shadow-lg hover:shadow-white/10"
                >
                  Discover our production standards
                  <span className="transition-transform group-hover/link:translate-x-1">→</span>
                </Link>
              </motion.div>
            </motion.div>
          </div>

          {/* Navigation arrows */}
          <div className="hidden sm:flex absolute bottom-8 right-8 gap-3 z-10">
            <button className="w-12 h-12 rounded-full border-2 border-white/40 hover:border-white hover:bg-white/20 flex items-center justify-center text-white transition-all backdrop-blur-sm hover:scale-110 shadow-lg">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button className="w-12 h-12 rounded-full border-2 border-white/40 hover:border-white hover:bg-white/20 flex items-center justify-center text-white transition-all backdrop-blur-sm hover:scale-110 shadow-lg">
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
};

export default Cultivation;
