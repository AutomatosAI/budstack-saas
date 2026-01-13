"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Star, Quote, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Testimonial {
  id: string;
  patientName: string;
  condition: string;
  rating: number;
  testimonial: string;
  location: string;
}

export function TestimonialsSlider() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Sample testimonials data
  const testimonials: Testimonial[] = [
    {
      id: "1",
      patientName: "Maria S.",
      condition: "Chronic Pain",
      rating: 5,
      testimonial:
        "HealingBuds completely changed my life. After years of chronic pain and ineffective treatments, the medical cannabis prescription I received through their consultation has given me my quality of life back. The doctors were professional, caring, and truly listened to my concerns.",
      location: "Lisbon",
    },
    {
      id: "2",
      patientName: "João P.",
      condition: "Anxiety & Insomnia",
      rating: 5,
      testimonial:
        "I was skeptical at first, but the consultation process was thorough and professional. My doctor explained everything clearly and the treatment plan has helped me sleep better and manage my anxiety without harsh side effects. Highly recommend HealingBuds.",
      location: "Porto",
    },
    {
      id: "3",
      patientName: "Ana R.",
      condition: "Fibromyalgia",
      rating: 5,
      testimonial:
        "Living with fibromyalgia was exhausting until I found HealingBuds. The online consultation was convenient and the doctor was incredibly knowledgeable about medical cannabis treatments. My pain levels have decreased significantly.",
      location: "Coimbra",
    },
    {
      id: "4",
      patientName: "Carlos M.",
      condition: "Post-Surgery Recovery",
      rating: 5,
      testimonial:
        "After my surgery, traditional pain medications weren't working well and had terrible side effects. The medical cannabis treatment recommended by HealingBuds doctors has been a game-changer for my recovery process.",
      location: "Braga",
    },
    {
      id: "5",
      patientName: "Sofia L.",
      condition: "Multiple Sclerosis",
      rating: 5,
      testimonial:
        "Managing MS symptoms was overwhelming until I started my treatment plan through HealingBuds. The muscle spasms and pain have improved dramatically. The whole team is compassionate and professional.",
      location: "Faro",
    },
  ];

  // Auto-advance testimonials
  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, testimonials.length]);

  const goToPrevious = () => {
    setCurrentIndex((prev) =>
      prev === 0 ? testimonials.length - 1 : prev - 1,
    );
    setIsAutoPlaying(false);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    setIsAutoPlaying(false);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    setIsAutoPlaying(false);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < rating ? "text-yellow-400 fill-current" : "text-gray-300"
        }`}
      />
    ));
  };

  return (
    <section className="py-20 bg-gradient-to-br from-green-50 to-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold text-gray-900 mb-6 font-serif">
            Patient Success Stories
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Real experiences from Portuguese patients who found relief through
            our medical cannabis consultation service.
          </p>
        </motion.div>

        {/* Testimonials slider */}
        <div className="relative max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.5 }}
              className="testimonial-card relative"
            >
              <div className="absolute top-4 left-4 text-green-600 opacity-20">
                <Quote className="w-12 h-12" />
              </div>

              <div className="pt-8 space-y-6">
                {/* Rating */}
                <div className="flex items-center justify-center space-x-1">
                  {renderStars(testimonials[currentIndex]?.rating || 5)}
                </div>

                {/* Testimonial text */}
                <blockquote className="text-lg text-gray-700 leading-relaxed text-center max-w-3xl mx-auto">
                  "{testimonials[currentIndex]?.testimonial}"
                </blockquote>

                {/* Patient info */}
                <div className="text-center border-t pt-6">
                  <div className="flex items-center justify-center space-x-4 text-sm text-gray-600">
                    <span className="font-semibold text-gray-900">
                      {testimonials[currentIndex]?.patientName}
                    </span>
                    <span>•</span>
                    <span>{testimonials[currentIndex]?.condition}</span>
                    <span>•</span>
                    <div className="flex items-center space-x-1">
                      <MapPin className="w-3 h-3" />
                      <span>{testimonials[currentIndex]?.location}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation arrows */}
          <div className="flex items-center justify-between mt-8">
            <Button
              variant="outline"
              size="icon"
              onClick={goToPrevious}
              className="bg-white shadow-lg hover:shadow-xl border-gray-200 hover:border-green-300"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            {/* Dots indicator */}
            <div className="flex space-x-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === currentIndex
                      ? "bg-green-600 w-8"
                      : "bg-gray-300 hover:bg-gray-400"
                  }`}
                />
              ))}
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={goToNext}
              className="bg-white shadow-lg hover:shadow-xl border-gray-200 hover:border-green-300"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Autoplay indicator */}
          <div className="text-center mt-6">
            <button
              onClick={() => setIsAutoPlaying(!isAutoPlaying)}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              {isAutoPlaying ? "Pause" : "Play"} auto-advance
            </button>
          </div>
        </div>

        {/* Statistics */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16"
        >
          <div className="text-center">
            <div className="text-4xl font-bold text-green-600 mb-2">98%</div>
            <div className="text-gray-600">Patient Satisfaction</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-green-600 mb-2">2,500+</div>
            <div className="text-gray-600">Patients Helped</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-green-600 mb-2">85%</div>
            <div className="text-gray-600">Report Symptom Improvement</div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
