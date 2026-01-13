'use client';

import { useEffect, useState } from 'react';
import { notFound, useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Tenant } from '@/types/client';

// Condition interface matching the seeded data structure
interface ConditionDetail {
  id: string;
  name: string; // The title
  description: string; // The subtitle/intro
  image: string;
  causes: { title: string; desc: string }[] | any;
  symptoms: {
    physical: string[];
    psychological?: string[];
  } | any;
  types?: { type: string; desc: string }[] | any;
  treatments: { title: string; desc: string }[] | any;
  medicalCannabis: {
    content1: string;
    content2: string;
  } | any;
  faqs: { question: string; answer: string }[] | any;
}

export default function ConditionPage() {
  const params = useParams();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [condition, setCondition] = useState<ConditionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview"); // For mobile tabs if needed, or just sections

  // Reuse existing state for accordions
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    // 1. Fetch Tenant
    fetch('/api/tenant/current?slug=' + params.slug)
      .then(res => res.json())
      .then(data => {
        setTenant(data);
      })
      .catch(console.error);

    // 2. Fetch Condition Detail
    // params.id is the condition slug (e.g. 'anxiety')
    // params.slug is the store/tenant slug (e.g. 'healingbuds')
    if (params.id) {
      fetch(`/api/tenant/conditions/${params.id}?tenantSlug=${params.slug}`)
        .then(async (res) => {
          if (res.status === 404) return null;
          if (!res.ok) throw new Error('Failed to fetch condition');
          return res.json();
        })
        .then(data => {
          setCondition(data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [params.slug, params.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--tenant-color-background)' }}>
        <p className="text-lg" style={{ color: 'var(--tenant-color-text)' }}>Loading condition details...</p>
      </div>
    );
  }

  if (!tenant || !condition) {
    // If not found, show 404
    if (!loading) notFound();
    return null;
  }

  // Helper to ensure JSON fields are arrays/objects even if DB has them as generic Json
  const causes = Array.isArray(condition.causes) ? condition.causes : [];
  const symptoms = (typeof condition.symptoms === 'object' && condition.symptoms) ? condition.symptoms : { physical: [] };
  const types = Array.isArray(condition.types) ? condition.types : [];
  const treatments = Array.isArray(condition.treatments) ? condition.treatments : [];
  const faqs = Array.isArray(condition.faqs) ? condition.faqs : [];
  const medicalCannabis = (typeof condition.medicalCannabis === 'object' && condition.medicalCannabis) ? condition.medicalCannabis : { content1: '', content2: '' };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--tenant-color-background)' }}>
      {/* Hero Section */}
      <section className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" style={{ '--tw-gradient-from': 'rgba(var(--tenant-color-primary-rgb), 0.05)' } as any} />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1
              className="text-5xl md:text-6xl font-bold mb-6 tracking-tight"
              style={{ color: 'var(--tenant-color-heading)', fontFamily: 'var(--tenant-font-heading)' }}
            >
              {condition.name}
            </h1>
            <p
              className="text-xl max-w-3xl opacity-80"
              style={{ color: 'var(--tenant-color-text)', fontFamily: 'var(--tenant-font-base)' }}
            >
              {condition.description}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Breadcrumbs */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center gap-2 text-sm opacity-60 font-medium" style={{ color: 'var(--tenant-color-text)' }}>
          <Link href={`/store/${params.slug}`} className="hover:opacity-100 transition-opacity">Home</Link>
          <ChevronRight className="w-4 h-4" />
          <Link href={`/store/${params.slug}/conditions`} className="hover:opacity-100 transition-opacity">Conditions</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="opacity-100" style={{ color: 'var(--tenant-color-heading)' }}>{condition.name}</span>
        </div>
      </div>

      {/* Main Content */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-[300px,1fr] gap-12">

            {/* Table of Contents (Left Sidebar) */}
            <div className="hidden lg:block">
              <div className="sticky top-32 space-y-2">
                <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--tenant-color-heading)' }}>ON THIS PAGE</h3>
                {[
                  { id: "causes", title: "Causes" },
                  { id: "symptoms", title: "Symptoms" },
                  { id: "treatments", title: "Treatments" },
                  { id: "cannabis", title: "Medical Cannabis" },
                  { id: "faq", title: "FAQ" }
                ].map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="block w-full text-left px-4 py-2 text-sm rounded-lg transition-all hover:bg-opacity-5 hover:pl-6"
                    style={{ color: 'var(--tenant-color-text)', backgroundColor: 'transparent', '--hover-bg': 'var(--tenant-color-primary)' } as any}
                  >
                    {item.title}
                  </a>
                ))}
              </div>
            </div>

            {/* Content Column */}
            <div className="space-y-16">

              {/* Causes */}
              {causes.length > 0 && (
                <div id="causes" className="scroll-mt-32">
                  <h2 className="text-3xl font-bold mb-6" style={{ color: 'var(--tenant-color-heading)' }}>Causes & Risk Factors</h2>
                  <div className="grid md:grid-cols-2 gap-6 mt-6">
                    {causes.map((cause: any, idx: number) => (
                      <div key={idx} className="p-6 rounded-xl border bg-opacity-50" style={{ backgroundColor: 'var(--tenant-color-surface)', borderColor: 'var(--tenant-color-border)' }}>
                        <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--tenant-color-heading)' }}>{cause.title}</h3>
                        <p className="opacity-80" style={{ color: 'var(--tenant-color-text)' }}>{cause.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Symptoms */}
              <div id="symptoms" className="scroll-mt-32">
                <h2 className="text-3xl font-bold mb-6" style={{ color: 'var(--tenant-color-heading)' }}>Common Symptoms</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  {symptoms.physical && symptoms.physical.length > 0 && (
                    <div className="p-6 rounded-xl border bg-opacity-50" style={{ backgroundColor: 'var(--tenant-color-surface)', borderColor: 'var(--tenant-color-border)' }}>
                      <h3 className="text-xl font-semibold mb-4" style={{ color: 'var(--tenant-color-heading)' }}>Physical Symptoms</h3>
                      <ul className="space-y-3">
                        {symptoms.physical.map((symptom: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-3">
                            <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: 'var(--tenant-color-primary)' }} />
                            <span className="opacity-80" style={{ color: 'var(--tenant-color-text)' }}>{symptom}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {symptoms.psychological && symptoms.psychological.length > 0 && (
                    <div className="p-6 rounded-xl border bg-opacity-50" style={{ backgroundColor: 'var(--tenant-color-surface)', borderColor: 'var(--tenant-color-border)' }}>
                      <h3 className="text-xl font-semibold mb-4" style={{ color: 'var(--tenant-color-heading)' }}>Psychological Symptoms</h3>
                      <ul className="space-y-3">
                        {symptoms.psychological.map((symptom: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-3">
                            <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: 'var(--tenant-color-secondary, var(--tenant-color-primary))' }} />
                            <span className="opacity-80" style={{ color: 'var(--tenant-color-text)' }}>{symptom}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Treatments */}
              {treatments.length > 0 && (
                <div id="treatments" className="scroll-mt-32">
                  <h2 className="text-3xl font-bold mb-6" style={{ color: 'var(--tenant-color-heading)' }}>Standard Treatments</h2>
                  <div className="grid md:grid-cols-2 gap-6">
                    {treatments.map((treatment: any, idx: number) => (
                      <div key={idx} className="p-6 rounded-xl border bg-opacity-50" style={{ backgroundColor: 'var(--tenant-color-surface)', borderColor: 'var(--tenant-color-border)' }}>
                        <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--tenant-color-heading)' }}>{treatment.title}</h3>
                        <p className="opacity-80" style={{ color: 'var(--tenant-color-text)' }}>{treatment.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Medical Cannabis */}
              <div id="cannabis" className="scroll-mt-32">
                <div className="p-8 rounded-2xl bg-opacity-5 border border-opacity-20" style={{ backgroundColor: 'rgba(var(--tenant-color-primary-rgb), 0.05)', borderColor: 'var(--tenant-color-primary)' }}>
                  <h2 className="text-3xl font-bold mb-6" style={{ color: 'var(--tenant-color-heading)' }}>Medical Cannabis Approach</h2>
                  <p className="opacity-80 leading-relaxed mb-4" style={{ color: 'var(--tenant-color-text)' }}>{medicalCannabis.content1}</p>
                  <p className="opacity-80 leading-relaxed mb-6" style={{ color: 'var(--tenant-color-text)' }}>{medicalCannabis.content2}</p>
                  <Link href="/contact">
                    <button className="px-8 py-3 rounded-lg font-semibold text-white transition-opacity hover:opacity-90" style={{ backgroundColor: 'var(--tenant-color-primary)' }}>
                      Book Consultation
                    </button>
                  </Link>
                </div>
              </div>

              {/* FAQ */}
              {faqs.length > 0 && (
                <div id="faq" className="scroll-mt-32">
                  <h2 className="text-3xl font-bold mb-8" style={{ color: 'var(--tenant-color-heading)' }}>Frequently Asked Questions</h2>
                  <div className="space-y-4">
                    {faqs.map((faq: any, idx: number) => (
                      <div key={idx} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--tenant-color-border)' }}>
                        <button
                          onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                          className="w-full flex items-center justify-between p-6 text-left hover:bg-opacity-50 transition-colors"
                          style={{ backgroundColor: 'var(--tenant-color-surface)' }}
                        >
                          <h3 className="text-lg font-semibold pr-4" style={{ color: 'var(--tenant-color-heading)' }}>{faq.question}</h3>
                          <ChevronDown
                            className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 ${openFaq === idx ? 'rotate-180' : ''}`}
                            style={{ color: 'var(--tenant-color-text)' }}
                          />
                        </button>
                        <AnimatePresence>
                          {openFaq === idx && (
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: "auto" }}
                              exit={{ height: 0 }}
                              transition={{ duration: 0.3 }}
                              className="overflow-hidden"
                            >
                              <div className="px-6 pb-6">
                                <p className="opacity-80 leading-relaxed" style={{ color: 'var(--tenant-color-text)' }}>{faq.answer}</p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-20" style={{ backgroundColor: 'var(--tenant-color-secondary)' }}>
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-semibold text-white mb-6">Ready to find relief?</h2>
          <p className="text-lg text-white/80 mb-10 max-w-2xl mx-auto">
            Schedule a consultation with our specialists to discuss your condition and treatment options.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/contact"
              className="border border-white/30 hover:bg-white/10 text-white px-8 py-3 rounded-lg text-lg transition-colors"
            >
              Contact Us
            </Link>
            <Link
              href={`/store/${params.slug}/conditions`}
              className="border border-white/30 hover:bg-white/10 text-white px-8 py-3 rounded-lg text-lg transition-colors"
            >
              View All Conditions
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
