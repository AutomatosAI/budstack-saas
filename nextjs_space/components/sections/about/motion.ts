/**
 * Shared framer-motion variants for the About page sections.
 * Extracted verbatim from the legacy monolithic about-content.tsx so the
 * decomposed sections animate identically to the page they replaced.
 */

export const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

export const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12 } },
};
