"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Tenant } from "@/types/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

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

  return (
    <div
      className="p-8 rounded-xl border"
      style={{
        borderColor: "hsl(var(--tenant-color-primary) / 0.12)",
        backgroundColor: "hsl(var(--tenant-color-background))",
      }}
    >
      {/* Success Message */}
      {submitStatus === "success" && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-lg flex items-start gap-3"
          style={{
            backgroundColor: "hsl(152 60% 94%)",
            border: "1px solid hsl(152 60% 80%)",
          }}
        >
          <CheckCircle2
            className="w-5 h-5 flex-shrink-0 mt-0.5"
            style={{ color: "hsl(152 60% 35%)" }}
          />
          <div>
            <h4
              className="font-medium mb-1"
              style={{ color: "hsl(152 60% 25%)" }}
            >
              Message Sent!
            </h4>
            <p
              className="text-sm"
              style={{ color: "hsl(152 40% 35%)" }}
            >
              Thank you for contacting us. We'll get back to you shortly.
            </p>
          </div>
        </motion.div>
      )}

      {/* Error Message */}
      {submitStatus === "error" && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-lg flex items-start gap-3"
          style={{
            backgroundColor: "hsl(350 70% 95%)",
            border: "1px solid hsl(350 70% 80%)",
          }}
        >
          <AlertCircle
            className="w-5 h-5 flex-shrink-0 mt-0.5"
            style={{ color: "hsl(350 70% 40%)" }}
          />
          <div>
            <h4
              className="font-medium mb-1"
              style={{ color: "hsl(350 70% 30%)" }}
            >
              Failed to send
            </h4>
            <p
              className="text-sm"
              style={{ color: "hsl(350 50% 40%)" }}
            >
              Something went wrong. Please try again later or email us
              directly.
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
              style={{
                color: "hsl(var(--tenant-color-heading))",
                fontFamily: "var(--tenant-font-base, sans-serif)",
              }}
            >
              Name
            </label>
            <input
              {...register("name")}
              id="name"
              type="text"
              className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 transition-all"
              style={{
                borderColor: errors.name
                  ? "hsl(350 70% 50%)"
                  : "hsl(var(--tenant-color-primary) / 0.2)",
                color: "hsl(var(--tenant-color-text))",
                backgroundColor: "hsl(var(--tenant-color-background))",
                fontFamily: "var(--tenant-font-base, sans-serif)",
              }}
              placeholder="Your name"
            />
            {errors.name && (
              <p className="text-sm" style={{ color: "hsl(350 70% 50%)" }}>
                {errors.name.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="text-sm font-medium"
              style={{
                color: "hsl(var(--tenant-color-heading))",
                fontFamily: "var(--tenant-font-base, sans-serif)",
              }}
            >
              Email
            </label>
            <input
              {...register("email")}
              id="email"
              type="email"
              className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 transition-all"
              style={{
                borderColor: errors.email
                  ? "hsl(350 70% 50%)"
                  : "hsl(var(--tenant-color-primary) / 0.2)",
                color: "hsl(var(--tenant-color-text))",
                backgroundColor: "hsl(var(--tenant-color-background))",
                fontFamily: "var(--tenant-font-base, sans-serif)",
              }}
              placeholder="your@email.com"
            />
            {errors.email && (
              <p className="text-sm" style={{ color: "hsl(350 70% 50%)" }}>
                {errors.email.message}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="subject"
            className="text-sm font-medium"
            style={{
              color: "hsl(var(--tenant-color-heading))",
              fontFamily: "var(--tenant-font-base, sans-serif)",
            }}
          >
            Subject
          </label>
          <input
            {...register("subject")}
            id="subject"
            type="text"
            className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 transition-all"
            style={{
              borderColor: errors.subject
                ? "hsl(350 70% 50%)"
                : "hsl(var(--tenant-color-primary) / 0.2)",
              color: "hsl(var(--tenant-color-text))",
              backgroundColor: "hsl(var(--tenant-color-background))",
              fontFamily: "var(--tenant-font-base, sans-serif)",
            }}
            placeholder="How can we help?"
          />
          {errors.subject && (
            <p className="text-sm" style={{ color: "hsl(350 70% 50%)" }}>
              {errors.subject.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="message"
            className="text-sm font-medium"
            style={{
              color: "hsl(var(--tenant-color-heading))",
              fontFamily: "var(--tenant-font-base, sans-serif)",
            }}
          >
            Message
          </label>
          <textarea
            {...register("message")}
            id="message"
            rows={6}
            className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 transition-all resize-none"
            style={{
              borderColor: errors.message
                ? "hsl(350 70% 50%)"
                : "hsl(var(--tenant-color-primary) / 0.2)",
              color: "hsl(var(--tenant-color-text))",
              backgroundColor: "hsl(var(--tenant-color-background))",
              fontFamily: "var(--tenant-font-base, sans-serif)",
            }}
            placeholder="Tell us more about your inquiry..."
          />
          {errors.message && (
            <p className="text-sm" style={{ color: "hsl(350 70% 50%)" }}>
              {errors.message.message}
            </p>
          )}
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 px-6 rounded-lg font-semibold text-white transition-all flex items-center justify-center gap-2 hover:shadow-lg"
          style={{
            backgroundColor: "hsl(var(--tenant-color-primary))",
            fontFamily: "var(--tenant-font-base, sans-serif)",
          }}
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
  );
}
