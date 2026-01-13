"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useState } from "react";
import { toast } from "@/components/ui/sonner";
import {
  BookOpen,
  Calendar,
  ArrowRight,
  User,
  Clock,
  TrendingUp,
  FileText,
  Video,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function EducationalContent() {
  const [newsletterEmail, setNewsletterEmail] = useState("");

  const handleNewsletterSubscribe = () => {
    if (!newsletterEmail || !newsletterEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    toast.success("Successfully subscribed to newsletter!");
    setNewsletterEmail("");
  };

  const blogPosts = [
    {
      id: "1",
      title: "Understanding Medical Cannabis in Portugal: A Complete Guide",
      excerpt:
        "Everything you need to know about Portuguese medical cannabis laws, INFARMED regulations, and how to access treatment legally.",
      category: "Legal Guide",
      readTime: "8 min read",
      publishedAt: "2025-01-15",
      author: "Dr. Silva",
      featured: true,
    },
    {
      id: "2",
      title: "CBD vs THC: Understanding Cannabis Compounds for Medical Use",
      excerpt:
        "Learn the differences between CBD and THC, their medical benefits, and how they work together in cannabis treatment.",
      category: "Medical Education",
      readTime: "6 min read",
      publishedAt: "2025-01-12",
      author: "Dr. Santos",
    },
    {
      id: "3",
      title: "Managing Chronic Pain with Medical Cannabis: Patient Stories",
      excerpt:
        "Real experiences from Portuguese patients who found relief from chronic pain through medical cannabis treatment.",
      category: "Patient Stories",
      readTime: "5 min read",
      publishedAt: "2025-01-10",
      author: "Patient Care Team",
    },
  ];

  const resources = [
    {
      icon: FileText,
      title: "Patient Guide to Medical Cannabis",
      description:
        "Comprehensive PDF guide covering everything from consultation to treatment",
      type: "PDF Download",
      color: "blue",
    },
    {
      icon: Video,
      title: "Consultation Process Video",
      description: "Step-by-step video walkthrough of our consultation process",
      type: "Video Guide",
      color: "green",
    },
    {
      icon: BookOpen,
      title: "Condition-Specific Information",
      description:
        "Detailed information about medical cannabis for specific conditions",
      type: "Educational Series",
      color: "purple",
    },
  ];

  const getResourceColor = (color: string) => {
    const colorMap = {
      blue: "bg-blue-50 text-blue-700 border-blue-200",
      green: "bg-green-50 text-green-700 border-green-200",
      purple: "bg-purple-50 text-purple-700 border-purple-200",
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.blue;
  };

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <Badge className="mb-4 bg-blue-100 text-blue-800 border-blue-200">
            <BookOpen className="w-3 h-3 mr-1" />
            Education & Resources
          </Badge>
          <h2 className="text-4xl font-bold text-gray-900 mb-6 font-serif">
            Learn About Medical Cannabis
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Stay informed with our comprehensive educational content, latest
            research, and practical guides for medical cannabis patients in
            Portugal.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Latest blog posts */}
          <div className="lg:col-span-2 space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold text-gray-900 font-serif">
                Latest Articles
              </h3>
              <Link href="/blog">
                <Button
                  variant="outline"
                  className="hover:bg-green-50 hover:border-green-300"
                >
                  View All Articles
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>

            <div className="space-y-8">
              {blogPosts.map((post, index) => (
                <motion.article
                  key={post.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className={`bg-white rounded-xl p-8 shadow-sm border border-gray-200 hover:shadow-lg transition-all duration-300 ${
                    post.featured ? "ring-2 ring-green-200" : ""
                  }`}
                >
                  <Link href="/blog" className="group">
                    <div className="flex items-start space-x-6">
                      {/* Thumbnail placeholder */}
                      <div className="w-24 h-24 bg-gradient-to-br from-green-100 to-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-8 h-8 text-green-600" />
                      </div>

                      <div className="flex-1 space-y-3">
                        <div className="flex items-center space-x-4">
                          <Badge variant="outline" className="text-xs">
                            {post.category}
                          </Badge>
                          {post.featured && (
                            <Badge className="text-xs bg-green-100 text-green-800">
                              <TrendingUp className="w-3 h-3 mr-1" />
                              Featured
                            </Badge>
                          )}
                        </div>

                        <h4 className="text-lg font-semibold text-gray-900 group-hover:text-green-700 transition-colors">
                          {post.title}
                        </h4>

                        <p className="text-gray-600 text-sm leading-relaxed line-clamp-2">
                          {post.excerpt}
                        </p>

                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-1">
                              <User className="w-3 h-3" />
                              <span>{post.author}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-3 h-3" />
                              <span>
                                {new Date(
                                  post.publishedAt,
                                ).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{post.readTime}</span>
                          </div>
                        </div>
                      </div>

                      <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-green-600 group-hover:translate-x-1 transition-all" />
                    </div>
                  </Link>
                </motion.article>
              ))}
            </div>
          </div>

          {/* Resources sidebar */}
          <div className="space-y-8">
            <h3 className="text-2xl font-bold text-gray-900 font-serif">
              Resources
            </h3>

            <div className="space-y-6">
              {resources.map((resource, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className={`p-6 rounded-xl border-2 ${getResourceColor(resource.color)} hover:shadow-lg transition-all duration-300 cursor-pointer group`}
                >
                  <div className="flex items-start space-x-4">
                    <resource.icon className="w-6 h-6 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-semibold mb-2 group-hover:underline">
                        {resource.title}
                      </h4>
                      <p className="text-sm opacity-80 mb-3">
                        {resource.description}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {resource.type}
                      </Badge>
                    </div>
                    <Download className="w-4 h-4 opacity-60 group-hover:opacity-100 transition-opacity" />
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Newsletter signup */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="bg-green-600 rounded-xl p-6 text-white"
            >
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <BookOpen className="w-5 h-5 text-green-200" />
                  <h4 className="font-semibold">Stay Updated</h4>
                </div>
                <p className="text-green-100 text-sm">
                  Get the latest medical cannabis research, legal updates, and
                  patient stories delivered to your inbox.
                </p>
                <div className="space-y-3">
                  <input
                    type="email"
                    placeholder="Your email address"
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    className="w-full px-4 py-2 text-gray-900 rounded-lg border border-green-400 focus:outline-none focus:ring-2 focus:ring-green-300"
                  />
                  <Button
                    onClick={handleNewsletterSubscribe}
                    className="w-full bg-white text-green-700 hover:bg-green-50 shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    Subscribe to Newsletter
                  </Button>
                </div>
                <p className="text-xs text-green-200">
                  Unsubscribe at any time. We respect your privacy.
                </p>
              </div>
            </motion.div>

            {/* Quick links */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm"
            >
              <h4 className="font-semibold text-gray-900 mb-4">Quick Links</h4>
              <nav className="space-y-3">
                <Link
                  href="/faq"
                  className="block text-sm text-gray-600 hover:text-green-700 hover:translate-x-1 transition-all"
                >
                  → Frequently Asked Questions
                </Link>
                <Link
                  href="/how-it-works"
                  className="block text-sm text-gray-600 hover:text-green-700 hover:translate-x-1 transition-all"
                >
                  → How Our Process Works
                </Link>
                <Link
                  href="/conditions"
                  className="block text-sm text-gray-600 hover:text-green-700 hover:translate-x-1 transition-all"
                >
                  → Treatable Conditions
                </Link>
                <Link
                  href="/contact"
                  className="block text-sm text-gray-600 hover:text-green-700 hover:translate-x-1 transition-all"
                >
                  → Contact Support
                </Link>
              </nav>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
