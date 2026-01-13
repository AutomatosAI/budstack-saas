"use client";

import { useEffect, useState, useRef } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { Target, Heart, Globe, Shield } from "lucide-react";

type Tenant = {
  id: string;
  businessName: string;
  [key: string]: any;
};

export default function AboutPage({ params }: { params: { slug: string } }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  // Parallax effect for hero image
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start end", "end start"],
  });

  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "15%"]);
  const imageScale = useTransform(scrollYProgress, [0, 0.5, 1], [1.1, 1.05, 1]);
  const overlayOpacity = useTransform(scrollYProgress, [0, 0.5], [0, 0.3]);

  useEffect(() => {
    if (!params.slug) return;

    fetch(`/api/tenant/${params.slug}`)
      .then((res) => res.json())
      .then((data) => {
        setTenant(data.tenant || data); // Handle both wrapped and unwrapped just in case
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [params.slug]);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--tenant-color-background)" }}
      >
        <p className="text-lg" style={{ color: "var(--tenant-color-text)" }}>
          Loading...
        </p>
      </div>
    );
  }

  if (!tenant) {
    notFound();
  }

  // Animation variants
  const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8 },
    },
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.2 },
    },
  };

  const valueCardVariants = {
    hidden: { opacity: 0, y: 40, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.6 },
    },
  };

  return (
    <div
      className="min-h-screen pb-24 lg:pb-0"
      style={{ backgroundColor: "var(--tenant-color-background)" }}
    >
      <main className="pt-28 md:pt-32 relative z-0">
        {/* Hero Section with animated text */}
        <section
          style={{ backgroundColor: "var(--tenant-color-background)" }}
          className="py-16 md:py-20 relative z-10"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              className="max-w-5xl"
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
            >
              <motion.h1
                className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 tracking-tight leading-[1.1]"
                style={{
                  color: "var(--tenant-color-heading)",
                  fontFamily: "var(--tenant-font-heading)",
                }}
                variants={fadeInUp}
              >
                About {tenant.businessName}
              </motion.h1>
              <motion.p
                className="text-xl md:text-2xl max-w-3xl font-light"
                style={{
                  color: "var(--tenant-color-text)",
                  fontFamily: "var(--tenant-font-base)",
                }}
                variants={fadeInUp}
              >
                Setting new standards in medical cannabis excellence
              </motion.p>
            </motion.div>
          </div>
        </section>

        {/* Hero Image with edge fade vignette and parallax */}
        <section
          ref={heroRef}
          className="container mx-auto px-4 sm:px-6 lg:px-8 pb-16 md:pb-20 relative z-10"
        >
          <motion.div
            ref={imageRef}
            className="relative h-[350px] md:h-[450px] lg:h-[550px] overflow-hidden rounded-2xl shadow-2xl"
            initial={{ opacity: 0, scale: 0.95, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          >
            {/* Animated image with parallax */}
            <motion.div
              className="absolute inset-0"
              style={{ y: imageY, scale: imageScale }}
            >
              <img
                src="/templates/healingbuds/research-lab-hq.jpg"
                alt="Research laboratory"
                className="w-full h-full object-cover"
                loading="eager"
              />
            </motion.div>

            {/* Animated vignette edge fade effect */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Top edge fade */}
              <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-background via-background/50 to-transparent" />
              {/* Bottom edge fade */}
              <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background via-background/60 to-transparent" />
              {/* Left edge fade */}
              <div className="absolute top-0 bottom-0 left-0 w-16 md:w-24 bg-gradient-to-r from-background/80 to-transparent" />
              {/* Right edge fade */}
              <div className="absolute top-0 bottom-0 right-0 w-16 md:w-24 bg-gradient-to-l from-background/80 to-transparent" />
              {/* Corner gradients for smooth blend */}
              <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-background/60 to-transparent" />
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-background/60 to-transparent" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-background/60 to-transparent" />
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-background/60 to-transparent" />
            </div>

            {/* Scroll-based overlay */}
            <motion.div
              className="absolute inset-0"
              style={{
                opacity: overlayOpacity,
                backgroundColor: "var(--tenant-color-primary, rgba(0,0,0,0.2))",
              }}
            />

            {/* Glassmorphism ethos card */}
            <motion.div
              className="absolute bottom-6 left-6 right-6 md:bottom-8 md:left-8 md:right-auto md:max-w-md"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.8,
                delay: 0.8,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <div className="backdrop-blur-xl bg-white/10 dark:bg-black/20 rounded-xl p-4 md:p-5 border border-white/20 dark:border-white/10 shadow-lg">
                <p className="text-white text-sm md:text-base font-medium tracking-wide">
                  Excellence in cultivation • Patient-centered care • Global
                  standards
                </p>
              </div>
            </motion.div>

            {/* Animated corner accent */}
            <motion.div
              className="absolute top-4 right-4 w-12 h-12 md:w-16 md:h-16"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 1, ease: "backOut" }}
            >
              <div
                className="w-full h-full rounded-full backdrop-blur-sm border border-white/20 flex items-center justify-center"
                style={{
                  background:
                    "linear-gradient(to bottom right, rgba(var(--tenant-color-primary-rgb, 28, 79, 77), 0.3), rgba(var(--tenant-color-secondary-rgb, 44, 125, 122), 0.3))",
                }}
              >
                <div className="w-2 h-2 rounded-full bg-white/80 animate-pulse" />
              </div>
            </motion.div>
          </motion.div>
        </section>

        {/* Our Story with reveal animation */}
        <section
          className="py-20 md:py-32 overflow-hidden"
          style={{ backgroundColor: "var(--tenant-color-background)" }}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              className="max-w-4xl mx-auto"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
            >
              <motion.h2
                className="text-3xl md:text-4xl lg:text-5xl font-semibold mb-8 tracking-tight"
                style={{
                  color: "var(--tenant-color-heading)",
                  fontFamily: "var(--tenant-font-heading)",
                }}
                variants={fadeInUp}
              >
                Our Story
              </motion.h2>
              <motion.p
                className="text-base md:text-lg leading-relaxed mb-6"
                style={{
                  color: "var(--tenant-color-text)",
                  fontFamily: "var(--tenant-font-base)",
                }}
                variants={fadeInUp}
              >
                Founded with a vision to revolutionize medical cannabis access,
                we have grown from a small operation into a leading
                international distributor. Our journey began with a simple
                belief: patients deserve the highest quality medical cannabis
                products, backed by rigorous research and unwavering standards.
              </motion.p>
              <motion.p
                className="text-base md:text-lg leading-relaxed mb-6"
                style={{
                  color: "var(--tenant-color-text)",
                  fontFamily: "var(--tenant-font-base)",
                }}
                variants={fadeInUp}
              >
                Today, we operate state-of-the-art facilities across multiple
                continents, serving thousands of patients and partnering with
                leading healthcare professionals. Our EU GMP-certified products
                meet the most stringent international standards, ensuring
                safety, consistency, and efficacy.
              </motion.p>
              <motion.p
                className="text-base md:text-lg leading-relaxed"
                style={{
                  color: "var(--tenant-color-text)",
                  fontFamily: "var(--tenant-font-base)",
                }}
                variants={fadeInUp}
              >
                Through continuous innovation and dedication to excellence, we
                are proud to be at the forefront of the medical cannabis
                industry, helping to shape a future where safe, effective
                cannabis medicine is accessible to all who need it.
              </motion.p>
            </motion.div>
          </div>
        </section>

        {/* Statistics Section */}
        <section
          className="py-20 md:py-32"
          style={{ backgroundColor: "var(--tenant-color-surface, #f9fafb)" }}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              className="grid md:grid-cols-4 gap-8 max-w-6xl mx-auto"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
            >
              {[
                { value: "18,000+", label: "Square Metres" },
                { value: "60", label: "Tonnes Annually" },
                { value: "4", label: "Global Markets" },
                { value: "100%", label: "EU GMP Certified" },
              ].map((stat, index) => (
                <motion.div
                  key={index}
                  className="text-center"
                  variants={valueCardVariants}
                >
                  <h3
                    className="text-4xl md:text-5xl font-bold mb-2"
                    style={{
                      color: "var(--tenant-color-primary)",
                      fontFamily: "var(--tenant-font-heading)",
                    }}
                  >
                    {stat.value}
                  </h3>
                  <p
                    className="text-sm md:text-base"
                    style={{
                      color: "var(--tenant-color-text)",
                      fontFamily: "var(--tenant-font-base)",
                    }}
                  >
                    {stat.label}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Our Values with staggered cards */}
        <section
          className="py-20 md:py-32 overflow-hidden"
          style={{ backgroundColor: "var(--tenant-color-background)" }}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <motion.h2
              className="text-3xl md:text-4xl lg:text-5xl font-semibold text-center mb-16 md:mb-20 tracking-tight"
              style={{
                color: "var(--tenant-color-heading)",
                fontFamily: "var(--tenant-font-heading)",
              }}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              Our Values
            </motion.h2>
            <motion.div
              className="grid md:grid-cols-2 lg:grid-cols-4 gap-10 max-w-6xl mx-auto"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={staggerContainer}
            >
              {[
                {
                  icon: Target,
                  title: "Excellence",
                  desc: "Uncompromising quality in every product and process",
                },
                {
                  icon: Heart,
                  title: "Patient-Focused",
                  desc: "Putting patient needs and wellbeing at the heart of everything we do",
                },
                {
                  icon: Globe,
                  title: "Global Reach",
                  desc: "Serving patients across continents with consistent standards",
                },
                {
                  icon: Shield,
                  title: "Integrity",
                  desc: "Operating with transparency, compliance, and ethical responsibility",
                },
              ].map((item, index) => (
                <motion.div
                  key={index}
                  className="text-center group cursor-default"
                  variants={valueCardVariants}
                  whileHover={{ y: -8, transition: { duration: 0.3 } }}
                >
                  <motion.div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg"
                    style={{
                      background:
                        "linear-gradient(to bottom right, var(--tenant-color-primary), var(--tenant-color-secondary))",
                    }}
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  >
                    <item.icon className="w-8 h-8 text-white" strokeWidth={2} />
                  </motion.div>
                  <h3
                    className="text-lg font-semibold mb-3 tracking-tight"
                    style={{
                      color: "var(--tenant-color-heading)",
                      fontFamily: "var(--tenant-font-heading)",
                    }}
                  >
                    {item.title}
                  </h3>
                  <p
                    className="text-sm leading-relaxed"
                    style={{
                      color: "var(--tenant-color-text)",
                      fontFamily: "var(--tenant-font-base)",
                    }}
                  >
                    {item.desc}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Our Facilities with hover effects */}
        <section
          className="py-20 md:py-32 relative overflow-hidden"
          style={{ backgroundColor: "var(--tenant-color-primary)" }}
        >
          {/* Subtle animated background pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2)_0%,transparent_50%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.2)_0%,transparent_50%)]" />
          </div>

          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <motion.div
              className="max-w-4xl mx-auto text-center"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
            >
              <motion.h2
                className="text-3xl md:text-4xl lg:text-5xl font-semibold text-white mb-8 tracking-tight"
                variants={fadeInUp}
              >
                Our Global Facilities
              </motion.h2>
              <motion.p
                className="text-base md:text-lg text-white/80 leading-relaxed mb-16"
                variants={fadeInUp}
              >
                Operating world-class cultivation and processing facilities
                across four continents, meeting the highest international
                standards.
              </motion.p>
              <motion.div
                className="grid md:grid-cols-2 gap-6 text-left"
                variants={staggerContainer}
              >
                {[
                  {
                    title: "South Africa",
                    desc: "Primary cultivation and processing facility with 15,000+ square metres of GMP-certified production space",
                  },
                  {
                    title: "United Kingdom",
                    desc: "European distribution hub serving the UK market with direct access to licensed prescribers and pharmacies",
                  },
                  {
                    title: "Thailand",
                    desc: "Asia-Pacific operations center supporting regional market expansion and research initiatives",
                  },
                  {
                    title: "Portugal",
                    desc: "European cultivation facility with advanced indoor growing systems and quality control laboratories",
                  },
                ].map((facility, index) => (
                  <motion.div
                    key={index}
                    className="bg-white/[0.03] backdrop-blur-sm rounded-xl p-7 border border-white/10 transition-all duration-300 hover:bg-white/[0.08] hover:border-white/25 hover:shadow-xl group"
                    variants={valueCardVariants}
                    whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                  >
                    <h3 className="text-xl md:text-2xl font-medium text-white mb-4 tracking-tight group-hover:text-white/90 transition-colors">
                      {facility.title}
                    </h3>
                    <p className="text-white/70 leading-relaxed text-sm md:text-base group-hover:text-white/80 transition-colors">
                      {facility.desc}
                    </p>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* CTA with animated button */}
        <section
          className="py-20 md:py-32"
          style={{ backgroundColor: "var(--tenant-color-background)" }}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
            >
              <motion.h2
                className="text-3xl md:text-4xl lg:text-5xl font-semibold mb-6 tracking-tight"
                style={{
                  color: "var(--tenant-color-heading)",
                  fontFamily: "var(--tenant-font-heading)",
                }}
                variants={fadeInUp}
              >
                Ready to Learn More?
              </motion.h2>
              <motion.p
                className="text-base md:text-lg max-w-3xl mx-auto mb-10"
                style={{
                  color: "var(--tenant-color-text)",
                  fontFamily: "var(--tenant-font-base)",
                }}
                variants={fadeInUp}
              >
                Get in touch with our team to discuss how we can support your
                medical cannabis needs.
              </motion.p>
              <motion.div variants={fadeInUp}>
                <Link href="contact">
                  <motion.button
                    className="px-7 py-3 rounded-full font-semibold relative overflow-hidden group"
                    style={{
                      backgroundColor: "var(--tenant-color-primary)",
                      color: "white",
                      fontFamily: "var(--tenant-font-base)",
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  >
                    <span className="relative z-10">Contact Us →</span>
                    <motion.div
                      className="absolute inset-0 bg-white/20"
                      initial={{ x: "-100%" }}
                      whileHover={{ x: "100%" }}
                      transition={{ duration: 0.5 }}
                    />
                  </motion.button>
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>
      </main>
    </div>
  );
}
