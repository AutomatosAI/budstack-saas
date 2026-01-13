"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Tenant } from "@/types/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Contact form validation schema
const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters"),
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .max(255, "Email must be less than 255 characters"),
  subject: z
    .string()
    .trim()
    .min(3, "Subject must be at least 3 characters")
    .max(200, "Subject must be less than 200 characters"),
  message: z
    .string()
    .trim()
    .min(10, "Message must be at least 10 characters")
    .max(2000, "Message must be less than 2000 characters"),
});

type ContactFormData = z.infer<typeof contactSchema>;

// Separate Client Component for interactivity
export default function ContactClient({ tenant }: { tenant: Tenant }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "success" | "error"
  >("idle");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  });

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    setSubmitStatus("idle");

    try {
      // Simulate form submission
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setSubmitStatus("success");
      reset();
    } catch (error: any) {
      console.error("Contact form error:", error);
      setSubmitStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Animation variants
  const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8 },
    },
  };

  // Extract page content
  const settings = (tenant.settings as any) || {};
  const pageContent = (settings?.pageContent as any) || {};
  const contactContent = pageContent.contact || {};

  return (
    <div
      className="min-h-screen pb-24 lg:pb-0"
      style={{ backgroundColor: "var(--tenant-color-background)" }}
    >
      <main className="pt-28 md:pt-32">
        {/* Hero Section */}
        <section
          style={{ backgroundColor: "var(--tenant-color-background)" }}
          className="py-16 md:py-20"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div initial="hidden" animate="visible" variants={fadeInUp}>
              <div className="max-w-5xl">
                <h1
                  className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 tracking-tight leading-[1.1]"
                  style={{
                    color: "var(--tenant-color-heading)",
                    fontFamily: "var(--tenant-font-heading)",
                  }}
                >
                  {contactContent.title || "Get in Touch"}
                </h1>
                <p
                  className="text-xl md:text-2xl max-w-3xl font-light"
                  style={{
                    color: "var(--tenant-color-text)",
                    fontFamily: "var(--tenant-font-base)",
                  }}
                >
                  {contactContent.description ||
                    "Have questions? We're here to help. Send us a message and we'll respond as soon as possible."}
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Hero Image */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 pb-16 md:pb-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
          >
            <div className="relative h-[300px] md:h-[400px] overflow-hidden rounded-xl border border-border/30">
              <img
                src={
                  contactContent.image ||
                  "/templates/healingbuds/hero-greenhouse-hq.jpg"
                }
                alt="Contact us"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div
                className="absolute inset-0 bg-gradient-to-t from-background/10 to-transparent"
                style={
                  {
                    "--tw-gradient-from": "var(--tenant-color-background)",
                  } as any
                }
              />
            </div>
          </motion.div>
        </section>

        {/* Contact Information */}
        <section
          className="py-20 md:py-32"
          style={{ backgroundColor: "var(--tenant-color-background)" }}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16">
              {/* Contact Details */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
              >
                <div>
                  <h2
                    className="text-3xl md:text-4xl lg:text-5xl font-semibold mb-8 tracking-tight"
                    style={{
                      color: "var(--tenant-color-heading)",
                      fontFamily: "var(--tenant-font-heading)",
                    }}
                  >
                    Let's Connect
                  </h2>
                  <p
                    className="text-base md:text-lg mb-12 leading-relaxed"
                    style={{
                      color: "var(--tenant-color-text)",
                      fontFamily: "var(--tenant-font-base)",
                    }}
                  >
                    Whether you have a question about our products, need
                    support, or want to learn more about medical cannabis, we're
                    ready to answer all your questions.
                  </p>

                  <div className="space-y-8">
                    {/* Email */}
                    <div className="flex items-start gap-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{
                          backgroundColor: "var(--tenant-color-primary)",
                        }}
                      >
                        <Mail className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3
                          className="text-lg font-semibold mb-2 tracking-tight"
                          style={{
                            color: "var(--tenant-color-heading)",
                            fontFamily: "var(--tenant-font-heading)",
                          }}
                        >
                          Email
                        </h3>
                        <p
                          className="text-sm"
                          style={{
                            color: "var(--tenant-color-text)",
                            fontFamily: "var(--tenant-font-base)",
                          }}
                        >
                          {contactContent.email ||
                            `info@${tenant.subdomain}.com`}
                        </p>
                      </div>
                    </div>

                    {/* Phone - Only show if exists */}
                    {contactContent.phone && (
                      <div className="flex items-start gap-4">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: "var(--tenant-color-primary)",
                          }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-6 h-6 text-white"
                          >
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                        </div>
                        <div>
                          <h3
                            className="text-lg font-semibold mb-2 tracking-tight"
                            style={{
                              color: "var(--tenant-color-heading)",
                              fontFamily: "var(--tenant-font-heading)",
                            }}
                          >
                            Phone
                          </h3>
                          <p
                            className="text-sm"
                            style={{
                              color: "var(--tenant-color-text)",
                              fontFamily: "var(--tenant-font-base)",
                            }}
                          >
                            {contactContent.phone}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Address - Only show if exists */}
                    {contactContent.address && (
                      <div className="flex items-start gap-4">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: "var(--tenant-color-primary)",
                          }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-6 h-6 text-white"
                          >
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                        </div>
                        <div>
                          <h3
                            className="text-lg font-semibold mb-2 tracking-tight"
                            style={{
                              color: "var(--tenant-color-heading)",
                              fontFamily: "var(--tenant-font-heading)",
                            }}
                          >
                            Address
                          </h3>
                          <p
                            className="text-sm whitespace-pre-line" // whitespace-pre-line needed for multiline addresses
                            style={{
                              color: "var(--tenant-color-text)",
                              fontFamily: "var(--tenant-font-base)",
                            }}
                          >
                            {contactContent.address}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Contact Form */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                <div
                  className="p-8 rounded-xl border"
                  style={{
                    backgroundColor:
                      "var(--tenant-color-surface, var(--tenant-color-background))",
                    borderColor: "var(--tenant-color-border, rgba(0,0,0,0.1))",
                  }}
                >
                  <h3
                    className="text-2xl font-semibold mb-6 tracking-tight"
                    style={{
                      color: "var(--tenant-color-heading)",
                      fontFamily: "var(--tenant-font-heading)",
                    }}
                  >
                    Send us a message
                  </h3>

                  {/* Success Message */}
                  {submitStatus === "success" && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500/20 flex items-start gap-3"
                    >
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-green-500 font-medium mb-1">
                          Message Sent!
                        </h4>
                        <p className="text-green-500/80 text-sm">
                          Thank you for contacting us. We'll get back to you
                          shortly.
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {/* Error Message */}
                  {submitStatus === "error" && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3"
                    >
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-red-500 font-medium mb-1">
                          Failed to send
                        </h4>
                        <p className="text-red-500/80 text-sm">
                          Something went wrong. Please try again later or email
                          us directly.
                        </p>
                      </div>
                    </motion.div>
                  )}

                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label
                          htmlFor="name"
                          className="text-sm font-medium"
                          style={{ color: "var(--tenant-color-text)" }}
                        >
                          Name
                        </label>
                        <input
                          {...register("name")}
                          id="name"
                          type="text"
                          className="w-full px-4 py-3 rounded-lg border bg-background/50 focus:ring-2 transition-all outline-none"
                          style={
                            {
                              borderColor: errors.name
                                ? "#ef4444"
                                : "var(--tenant-color-border, rgba(0,0,0,0.1))",
                              "--tw-ring-color": "var(--tenant-color-primary)",
                            } as any
                          }
                          placeholder="Your name"
                        />
                        {errors.name && (
                          <p className="text-sm text-red-500">
                            {errors.name.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="email"
                          className="text-sm font-medium"
                          style={{ color: "var(--tenant-color-text)" }}
                        >
                          Email
                        </label>
                        <input
                          {...register("email")}
                          id="email"
                          type="email"
                          className="w-full px-4 py-3 rounded-lg border bg-background/50 focus:ring-2 transition-all outline-none"
                          style={
                            {
                              borderColor: errors.email
                                ? "#ef4444"
                                : "var(--tenant-color-border, rgba(0,0,0,0.1))",
                              "--tw-ring-color": "var(--tenant-color-primary)",
                            } as any
                          }
                          placeholder="your@email.com"
                        />
                        {errors.email && (
                          <p className="text-sm text-red-500">
                            {errors.email.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="subject"
                        className="text-sm font-medium"
                        style={{ color: "var(--tenant-color-text)" }}
                      >
                        Subject
                      </label>
                      <input
                        {...register("subject")}
                        id="subject"
                        type="text"
                        className="w-full px-4 py-3 rounded-lg border bg-background/50 focus:ring-2 transition-all outline-none"
                        style={
                          {
                            borderColor: errors.subject
                              ? "#ef4444"
                              : "var(--tenant-color-border, rgba(0,0,0,0.1))",
                            "--tw-ring-color": "var(--tenant-color-primary)",
                          } as any
                        }
                        placeholder="How can we help?"
                      />
                      {errors.subject && (
                        <p className="text-sm text-red-500">
                          {errors.subject.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="message"
                        className="text-sm font-medium"
                        style={{ color: "var(--tenant-color-text)" }}
                      >
                        Message
                      </label>
                      <textarea
                        {...register("message")}
                        id="message"
                        rows={6}
                        className="w-full px-4 py-3 rounded-lg border bg-background/50 focus:ring-2 transition-all outline-none resize-none"
                        style={
                          {
                            borderColor: errors.message
                              ? "#ef4444"
                              : "var(--tenant-color-border, rgba(0,0,0,0.1))",
                            "--tw-ring-color": "var(--tenant-color-primary)",
                          } as any
                        }
                        placeholder="Tell us more about your inquiry..."
                      />
                      {errors.message && (
                        <p className="text-sm text-red-500">
                          {errors.message.message}
                        </p>
                      )}
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-4 px-6 rounded-lg font-semibold text-white transition-all flex items-center justify-center gap-2"
                      style={{ backgroundColor: "var(--tenant-color-primary)" }}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          Send Message
                          <Mail className="w-5 h-5" />
                        </>
                      )}
                    </motion.button>
                  </form>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
