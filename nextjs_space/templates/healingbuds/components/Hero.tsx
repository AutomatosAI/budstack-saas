'use client';

import React from "react";
import { ChevronDown } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import ParticleField from "./ParticleField";
import MagneticButton from "./MagneticButton";
import Image from "next/image";

interface HeroProps {
  businessName?: string;
  heroImageUrl?: string | null;
  tenant?: any;
}

const Hero = ({ businessName = "Healing Buds", heroImageUrl, tenant }: HeroProps) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const containerRef = React.useRef<HTMLElement>(null);
  const [videoEnded, setVideoEnded] = React.useState(false);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  const videoY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const logoY = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
  const logoScale = useTransform(scrollYProgress, [0, 0.5], [1, 1.1]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  React.useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(error => {
        console.log("Video autoplay failed:", error);
        setVideoEnded(true);
      });
    }
  }, []);

  const handleVideoEnded = () => {
    setVideoEnded(true);
  };

  const scrollToContent = () => {
    window.scrollTo({
      top: window.innerHeight,
      behavior: 'smooth'
    });
  };

  // Text reveal animation variants
  const textRevealVariants = {
    hidden: { opacity: 0, y: 60, skewY: 2 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      skewY: 0,
      transition: {
        duration: 0.8,
        delay: i * 0.15,
        ease: [0.25, 0.4, 0.25, 1] as [number, number, number, number],
      },
    }),
  };

  // Letter by letter animation for main title
  const welcomeText = "Welcome to";
  const brandText = "Healing Buds";
  const defaultHeroImage = "/templates/healingbuds/hero-video-bg.jpg";
  const heroImage = heroImageUrl || defaultHeroImage;

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen flex items-center overflow-hidden pt-28 sm:pt-36 md:pt-44 bg-background"
    >
      {/* Video Background with Parallax */}
      <motion.div
        style={{ y: videoY }}
        className="absolute left-0 right-0 top-20 sm:left-2 sm:right-2 sm:top-28 md:top-32 bottom-4 rounded-b-2xl sm:rounded-2xl md:rounded-3xl overflow-hidden z-0 shadow-2xl"
      >
        {/* Particle overlay */}
        <ParticleField particleCount={40} className="z-10" />

        {/* Static image that shows after video ends or as fallback */}
        <motion.img
          src={heroImage}
          alt=""
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: videoEnded ? 1 : 0, scale: videoEnded ? 1 : 1.1 }}
          transition={{ duration: 2, ease: "easeOut" }}
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Video that plays first then fades out */}
        <motion.video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          onEnded={handleVideoEnded}
          initial={{ opacity: 1 }}
          animate={{ opacity: videoEnded ? 0 : 1 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/templates/healingbuds/hero-video.mp4" type="video/mp4" />
        </motion.video>

        {/* Enhanced gradient overlay with animated glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1F2A25]/70 via-[#13303D]/60 to-[#1F2A25]/50" />

        {/* Animated glow spots */}
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full"
          style={{
            background: 'radial-gradient(circle at center, hsla(164, 48%, 53%, 0.2) 0%, transparent 60%)',
          }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </motion.div>

      <motion.div
        style={{ y: contentY, opacity }}
        className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 py-16 sm:py-24 md:py-32"
      >
        <div className="max-w-5xl text-left relative">
          {/* Welcome text with reveal animation */}
          <div className="pb-2">
            <motion.h1
              className="font-pharma text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-semibold text-white mb-2 leading-[1.15] tracking-tight drop-shadow-lg"
            >
              <motion.span
                initial="hidden"
                animate="visible"
                custom={0}
                variants={textRevealVariants}
                className="inline-block"
              >
                {welcomeText}
              </motion.span>
            </motion.h1>
          </div>

          {/* Brand name with staggered letter animation */}
          <div className="pb-4 mb-6 sm:mb-8">
            <motion.h1
              className="font-pharma text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-semibold text-white leading-[1.15] tracking-tight drop-shadow-lg"
            >
              <motion.span
                initial="hidden"
                animate="visible"
                custom={1}
                variants={textRevealVariants}
                className="inline-block"
              >
                {brandText.split('').map((letter, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.5,
                      delay: 0.3 + i * 0.03,
                      ease: [0.25, 0.4, 0.25, 1],
                    }}
                    className="inline-block"
                    style={{ display: letter === ' ' ? 'inline' : 'inline-block' }}
                  >
                    {letter === ' ' ? '\u00A0' : letter}
                  </motion.span>
                ))}
              </motion.span>
            </motion.h1>
          </div>

          {/* Transparent logo overlay with parallax and mosaic fade effect */}
          <div className="hidden md:block absolute right-0 md:right-8 lg:right-20 top-1/4 w-[280px] md:w-[340px] lg:w-[420px] h-[280px] md:h-[340px] lg:h-[420px] pointer-events-none">
            {/* Mosaic grid animation overlay */}
            <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 gap-0">
              {[...Array(16)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 1 }}
                  animate={{ opacity: [1, 0.4, 0.8, 1] }}
                  transition={{
                    duration: 4,
                    delay: i * 0.15,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="relative overflow-hidden"
                  style={{
                    clipPath: 'inset(0)',
                  }}
                >
                  <motion.img
                    src="/templates/healingbuds/hb-logo-square.png"
                    alt=""
                    className="absolute w-[280px] md:w-[340px] lg:w-[420px] h-[280px] md:h-[340px] lg:h-[420px] object-contain opacity-[0.06]"
                    style={{
                      top: `-${Math.floor(i / 4) * 25}%`,
                      left: `-${(i % 4) * 25}%`,
                    }}
                  />
                </motion.div>
              ))}
            </div>
            {/* Main logo with subtle glow */}
            <motion.img
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.08, scale: 1 }}
              style={{ y: logoY, scale: logoScale }}
              transition={{ duration: 1.5, delay: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
              src="/templates/healingbuds/hb-logo-square.png"
              alt=""
              className="absolute inset-0 w-full h-full object-contain origin-center mix-blend-soft-light"
            />
          </div>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8, ease: [0.25, 0.4, 0.25, 1] }}
            className="font-body text-lg sm:text-xl md:text-2xl text-white/90 mb-8 max-w-2xl font-light leading-relaxed drop-shadow-md"
          >
            Pioneering tomorrow's medical cannabis solutions
          </motion.p>
        </div>
      </motion.div>

      {/* Scroll Indicator with magnetic effect */}
      <MagneticButton
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20"
        magneticStrength={0.4}
        onClick={scrollToContent}
      >
        <motion.button
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.2, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-white/80 hover:text-white transition-all duration-300 cursor-pointer p-4"
          aria-label="Scroll to content"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <ChevronDown className="w-8 h-8" />
          </motion.div>
        </motion.button>
      </MagneticButton>
    </section>
  );
};

export default Hero;
