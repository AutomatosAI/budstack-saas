'use client';

import { Sprout, Users, FlaskConical } from "lucide-react";
import { motion } from "framer-motion";

const values = [
  {
    icon: Sprout,
    title: "Superior Quality",
    description: "Every stage from cultivation through extraction to final production is meticulously managed with unwavering attention to detail. Our EU GMP-certified products meet the highest international standards, earning trust across borders.",
  },
  {
    icon: Users,
    title: "Expanding Access",
    description: "Our mission is to ensure medical cannabis reaches those who need it most. Through evidence-based advocacy and education, we are reducing barriers, challenging misconceptions, and creating pathways to safe, legal access.",
  },
  {
    icon: FlaskConical,
    title: "Research-Driven Innovation",
    description: "Collaborating with world-class research institutions including Imperial College London and University of Pennsylvania, we advance scientific knowledge of cannabis therapeutics. Research excellence is the foundation of everything we pursue.",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.2,
    },
  },
};

const headerVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: [0.25, 0.4, 0.25, 1] as [number, number, number, number],
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 50, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.4, 0.25, 1] as [number, number, number, number],
    },
  },
};

const ValueProps = () => {
  return (
    <div className="px-2">
      <motion.section
        className="py-16 sm:py-20 md:py-24 rounded-2xl sm:rounded-3xl relative overflow-hidden"
        style={{ backgroundColor: 'var(--tenant-color-primary, #1C4F4D)' }}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={containerVariants}
      >
        {/* Cannabis plant decoration - bottom right - thin line art style */}
        <motion.div
          className="absolute bottom-8 right-8 sm:right-16 opacity-[0.12] pointer-events-none"
          initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
          whileInView={{ opacity: 0.12, scale: 1, rotate: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.5 }}
        >
          <img src="/templates/healingbuds/plant-line-art.png" alt="" className="w-32 sm:w-44 h-auto" />
        </motion.div>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div className="text-center mb-14 sm:mb-18" variants={headerVariants}>
            <h2 className="font-jakarta text-3xl sm:text-4xl md:text-5xl font-semibold mb-4 px-4 text-white" style={{ letterSpacing: '-0.02em', lineHeight: '1.2' }}>
              Growing more than medicine
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-10 sm:gap-12 md:gap-16">
            {values.map((value, index) => (
              <motion.div
                key={index}
                className="text-center group"
                variants={cardVariants}
                whileHover={{ y: -8, transition: { duration: 0.3 } }}
              >
                <motion.div
                  className="flex justify-center mb-7"
                  whileHover={{ scale: 1.1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <div className="w-20 h-20 flex items-center justify-center rounded-2xl bg-white/10 group-hover:bg-white/20 transition-all duration-300 group-hover:shadow-lg">
                    <value.icon className="w-10 h-10 text-white" strokeWidth={1.5} />
                  </div>
                </motion.div>
                <h3 className="font-jakarta text-xl sm:text-2xl font-semibold mb-4 tracking-tight text-white">
                  {value.title}
                </h3>
                <p className="font-jakarta leading-relaxed text-sm sm:text-base text-white/70">
                  {value.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>
    </div>
  );
};

export default ValueProps;
