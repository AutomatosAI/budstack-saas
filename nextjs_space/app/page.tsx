import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Store, Palette, BarChart3, Shield, Zap, Layers, Globe2, Lock, Sparkles, TrendingUp, Users, Workflow, Rocket, Database, Code2, Boxes, Crown } from 'lucide-react';
import { prisma } from '@/lib/db';

export default async function PopcornMediaPlatformPage() {
  // Fetch platform settings
  let settingsData = await prisma.platform_settings.findUnique({
    where: { id: 'platform' },
  });

  // Create default settings if not exists
  if (!settingsData) {
    settingsData = await prisma.platform_settings.create({
      data: { id: 'platform' },
    });
  }

  // Ensure we have non-null settings
  const settings = settingsData!;
  const platformName = settings.businessName || 'Popcorn Media';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-amber-900/30 bg-slate-950/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-amber-500 via-yellow-500 to-orange-500 shadow-xl shadow-amber-500/40">
              <Store className="w-7 h-7 text-white drop-shadow-lg" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-500 bg-clip-text text-transparent">
                {platformName}
              </h1>
              <p className="text-xs text-amber-500/80 font-medium">Medical Dispensary Franchise Management</p>
            </div>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/auth/login" className="text-slate-300 hover:text-amber-400 transition-colors font-medium">Login</Link>
            <Link href="/onboarding">
              <Button className="bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 hover:from-red-400 hover:via-orange-400 hover:to-amber-400 text-white border-0 shadow-xl shadow-red-500/30 hover:shadow-red-500/50 font-bold">
                Start Your Store
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section with Ecosystem Background */}
      <section className="relative overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/budstack-hero-ecosystem.jpg"
            alt="Popcorn Media Ecosystem"
            fill
            className="object-cover opacity-40"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/80 to-slate-950" />
        </div>

        {/* Content */}
        <div className="relative z-10 container mx-auto px-4 py-32">
          <div className="max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-orange-500/20 border border-amber-500/40 backdrop-blur-sm mb-8 shadow-lg shadow-amber-500/20">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span className="text-sm font-bold text-amber-300">Franchise & Infrastructure Provider – Partnering with Dr. Green</span>
            </div>

            <h1 className="text-6xl md:text-7xl font-black mb-6 leading-tight drop-shadow-2xl">
              <span className="bg-gradient-to-r from-white via-amber-200 to-yellow-300 bg-clip-text text-transparent">
                Medical Dispensary Franchise
              </span>
              <br />
              <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-red-500 bg-clip-text text-transparent">
                Management Platform
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-200 mb-12 max-w-3xl mx-auto leading-relaxed">
              Popcorn Media provides <span className="text-amber-400 font-bold">proprietary infrastructure exclusively for franchisees</span> —
              professional storefronts, admin dashboards, and multi-tenant operations management.
              <br />
              <span className="text-amber-500/80 text-lg mt-2 inline-block font-medium">A closed franchise ecosystem. Not a public marketplace.</span>
            </p>

            <div className="flex gap-6 justify-center flex-wrap">
              <Link href="/onboarding">
                <Button size="lg" className="text-lg px-10 py-7 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-400 hover:via-orange-400 hover:to-red-400 text-white border-0 shadow-2xl shadow-amber-500/30 hover:shadow-amber-500/50 transition-all">
                  <Rocket className="w-5 h-5 mr-2" />
                  Apply for Franchise
                </Button>
              </Link>
              <Link href="#operational-models">
                <Button size="lg" variant="outline" className="text-lg px-10 py-7 border-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/50 backdrop-blur-sm">
                  Explore Management Options
                </Button>
              </Link>
            </div>

            <div className="mt-12 flex items-center justify-center gap-8 text-sm text-slate-400 flex-wrap">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-amber-500" />
                <span>Franchise Agreements</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-amber-500" />
                <span>Dr. Green Partnership</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-amber-500" />
                <span>5,400 Limited Franchises</span>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative gradient orbs */}
        <div className="absolute top-1/4 left-10 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-10 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl" />
      </section>

      {/* Value Proposition - Partnership Infrastructure */}
      <section id="features" className="relative py-24 bg-gradient-to-b from-slate-950 to-slate-900">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-500 bg-clip-text text-transparent">
                Proprietary Infrastructure
              </span>
              <br />
              <span className="text-white">For Franchise Operations</span>
            </h2>
            <p className="text-xl text-slate-400">
              Dr. Green manages product catalog and supply chain.
              <span className="text-amber-400 font-semibold"> Popcorn Media provides the complete franchise infrastructure</span> —
              technology, operations management, and compliance frameworks exclusively for franchisees.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {[
              {
                icon: <Store className="w-8 h-8" />,
                title: "White-Label Storefronts",
                description: "Beautiful, branded dispensary websites with product catalogs, consultation booking, and customer portals",
                badge: "What NFT holders need"
              },
              {
                icon: <BarChart3 className="w-8 h-8" />,
                title: "Admin Dashboards",
                description: "Complete business management: analytics, orders, customers, inventory, and revenue tracking",
                badge: "Business tools"
              },
              {
                icon: <Layers className="w-8 h-8" />,
                title: "Multi-Tenant Architecture",
                description: "Scalable infrastructure supporting unlimited tenants, each with isolated data and custom branding",
                badge: "Enterprise-grade"
              },
              {
                icon: <Palette className="w-8 h-8" />,
                title: "Template System",
                description: "Pre-designed professional templates with full customization: colors, fonts, logos, and layouts",
                badge: "Brand flexibility"
              },
              {
                icon: <Globe2 className="w-8 h-8" />,
                title: "Custom Domain Routing",
                description: "Path-based URLs and custom domain support for professional branded experiences",
                badge: "Professional presence"
              },
              {
                icon: <Shield className="w-8 h-8" />,
                title: "Blockchain Traceability",
                description: "Integrated blockchain tracking for supply chain transparency and regulatory compliance",
                badge: "Compliance ready"
              },
              {
                icon: <Workflow className="w-8 h-8" />,
                title: "Dr. Green API Integration",
                description: "Seamless connection to product catalog, inventory, and order fulfillment systems",
                badge: "Fully integrated"
              },
              {
                icon: <Users className="w-8 h-8" />,
                title: "Customer Management",
                description: "Complete CRM with consultation tracking, order history, and patient onboarding flows",
                badge: "Patient-focused"
              },
              {
                icon: <Database className="w-8 h-8" />,
                title: "Audit & Webhook Systems",
                description: "Enterprise-grade logging, webhooks, and integrations for compliance and automation",
                badge: "Enterprise features"
              }
            ].map((feature, index) => (
              <div key={index} className="group bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 hover:bg-slate-900/80 hover:border-amber-500/30 transition-all duration-300">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br from-amber-500/10 to-orange-500/10 group-hover:from-amber-500/20 group-hover:to-orange-500/20 transition-all">
                    <div className="text-amber-400">
                      {feature.icon}
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full">
                    {feature.badge}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-amber-400 transition-colors">{feature.title}</h3>
                <p className="text-slate-400 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Ecosystem */}
      <section className="relative py-24 bg-slate-900">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                <span className="text-white">The Popcorn Media</span>{' '}
                <span className="bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-500 bg-clip-text text-transparent">Ecosystem</span>
              </h2>
              <p className="text-xl text-slate-400 max-w-3xl mx-auto">
                A complete, integrated platform connecting NFT licenses to operational dispensaries
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* NFT Integration */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-8">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center mb-6">
                  <Lock className="w-8 h-8 text-purple-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">NFT Licensing Layer</h3>
                <ul className="space-y-3 text-slate-300">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>Blockchain-verified ownership via Dr. Green NFT</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>Secure, transferable business credentials</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>Automatic tenant provisioning on license verification</span>
                  </li>
                </ul>
              </div>

              {/* SaaS Infrastructure */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-8">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center mb-6">
                  <Boxes className="w-8 h-8 text-amber-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">SaaS Platform Layer</h3>
                <ul className="space-y-3 text-slate-300">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>Multi-tenant infrastructure with data isolation</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>Template-based storefront customization</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>Comprehensive admin dashboards and analytics</span>
                  </li>
                </ul>
              </div>

              {/* Dr. Green Integration */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-8">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500/20 to-red-500/20 flex items-center justify-center mb-6">
                  <Code2 className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Dr. Green API Layer</h3>
                <ul className="space-y-3 text-slate-300">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>Real-time product catalog synchronization</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>Automated order fulfillment integration</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>Inventory and stock management sync</span>
                  </li>
                </ul>
              </div>

              {/* Business Layer */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-8">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center mb-6">
                  <TrendingUp className="w-8 h-8 text-amber-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Business Operations</h3>
                <ul className="space-y-3 text-slate-300">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>Complete customer and order management</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>Revenue analytics and business intelligence</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>Compliance tracking and audit logging</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Operational Models Section */}
      <section id="operational-models" className="relative py-24 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="text-white">Choose Your</span>
              <br />
              <span className="bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-500 bg-clip-text text-transparent">
                Management Model
              </span>
            </h2>
            <p className="text-xl text-slate-400">
              Popcorn Media offers three operational approaches to suit different franchise owner preferences and capabilities.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Fully Managed */}
            <div className="bg-gradient-to-br from-amber-900/20 to-slate-900 border-2 border-amber-500/50 rounded-2xl p-8 relative overflow-hidden group hover:border-amber-400 transition-all">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl" />
              <div className="relative z-10">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/30 flex items-center justify-center mb-6">
                  <Shield className="w-8 h-8 text-amber-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Fully Managed</h3>
                <p className="text-slate-300 mb-6 leading-relaxed">
                  Popcorn Media operates the entire franchise on your behalf. Perfect for hands-off ownership.
                </p>
                <ul className="space-y-3 text-slate-300">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>Complete operational management</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>Popcorn Media handles all decisions</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>Passive income model</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>Full compliance oversight</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Semi-Managed */}
            <div className="bg-gradient-to-br from-orange-900/20 to-slate-900 border-2 border-orange-500/50 rounded-2xl p-8 relative overflow-hidden group hover:border-orange-400 transition-all">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl" />
              <div className="relative z-10">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-orange-500/30 to-red-500/30 flex items-center justify-center mb-6">
                  <Users className="w-8 h-8 text-orange-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Semi-Managed</h3>
                <p className="text-slate-300 mb-6 leading-relaxed">
                  You run day-to-day operations with limited Popcorn Media support. Balanced approach.
                </p>
                <ul className="space-y-3 text-slate-300">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>You manage daily operations</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>Popcorn Media provides technical support</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>Shared decision-making</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>Infrastructure access</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Independent Operator */}
            <div className="bg-gradient-to-br from-red-900/20 to-slate-900 border-2 border-red-500/50 rounded-2xl p-8 relative overflow-hidden group hover:border-red-400 transition-all">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl" />
              <div className="relative z-10">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-red-500/30 to-pink-500/30 flex items-center justify-center mb-6">
                  <Crown className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Independent Operator</h3>
                <p className="text-slate-300 mb-6 leading-relaxed">
                  Full operational responsibility within Popcorn Media infrastructure constraints.
                </p>
                <ul className="space-y-3 text-slate-300">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>Complete operational control</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>You make all decisions</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>Maximum flexibility</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>Must follow franchise guidelines</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-16 max-w-3xl mx-auto text-center">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <p className="text-slate-300 text-lg">
                <span className="text-amber-400 font-semibold">All models</span> include access to Popcorn Media.s proprietary infrastructure
                and Dr. Green partnership benefits. Choose based on your desired level of involvement.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative py-24 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
              Franchise Application in{' '}
              <span className="bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-500 bg-clip-text text-transparent">3 Steps</span>
            </h2>
            <p className="text-xl text-slate-400">
              Apply for your medical cannabis franchise and get infrastructure access quickly
            </p>
          </div>

          <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Franchise Application",
                description: "Submit your franchise application with business details and ownership verification for Popcorn Media review",
                icon: <Lock className="w-6 h-6" />
              },
              {
                step: "02",
                title: "Customize Branding",
                description: "Choose a template, upload your logo, set brand colors, configure your domain, and customize content",
                icon: <Palette className="w-6 h-6" />
              },
              {
                step: "03",
                title: "Launch & Scale",
                description: "Your storefront goes live instantly. Start accepting consultations, processing orders, and growing your business",
                icon: <Rocket className="w-6 h-6" />
              }
            ].map((step) => (
              <div key={step.step} className="relative">
                {/* Connector line */}
                {step.step !== "03" && (
                  <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-amber-500/50 to-transparent" />
                )}

                <div className="relative bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-8 hover:border-amber-500/30 transition-all">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-amber-500/20">
                      {step.step}
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                      {step.icon}
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">{step.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-32 bg-gradient-to-br from-amber-900 via-orange-900 to-slate-900 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 container mx-auto px-4 text-center">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-5xl md:text-6xl font-black text-white mb-6">
              Franchise Opportunity
              <br />
              <span className="bg-gradient-to-r from-amber-300 via-yellow-300 to-orange-400 bg-clip-text text-transparent">
                Starting €10,000
              </span>
            </h2>
            <p className="text-xl md:text-2xl text-slate-300 mb-8 max-w-2xl mx-auto">
              Own a real medical dispensary franchise with access to proprietary infrastructure and Dr. Green partnership benefits.
            </p>
            <div className="bg-slate-900/50 border border-amber-500/30 rounded-xl p-6 max-w-2xl mx-auto mb-12">
              <div className="grid md:grid-cols-2 gap-6 text-left">
                <div>
                  <h3 className="text-amber-400 font-semibold mb-2">What You Own</h3>
                  <ul className="text-slate-300 text-sm space-y-1">
                    <li>• Real medical dispensary franchise</li>
                    <li>• Proprietary infrastructure access</li>
                    <li>• Closed ecosystem participation</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-amber-400 font-semibold mb-2">Entry Details</h3>
                  <ul className="text-slate-300 text-sm space-y-1">
                    <li>• From €10,000 initial investment</li>
                    <li>• Limited to 5,400 total franchises</li>
                    <li>• Legal agreements off-chain</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="flex gap-6 justify-center flex-wrap">
              <Link href="/onboarding">
                <Button size="lg" className="text-xl px-12 py-8 bg-white text-amber-950 hover:bg-slate-100 border-0 shadow-2xl shadow-amber-500/30 hover:shadow-amber-500/50 transition-all font-bold">
                  <Sparkles className="w-6 h-6 mr-2" />
                  Apply for Franchise
                </Button>
              </Link>
              <Link href="#operational-models">
                <Button size="lg" variant="outline" className="text-xl px-12 py-8 border-2 border-white/30 text-white hover:bg-white/10 hover:border-white/50 backdrop-blur-sm">
                  View Management Models
                </Button>
              </Link>
            </div>
            <p className="text-sm text-slate-400 mt-8">
              <Lock className="w-4 h-4 inline mr-2" />
              Franchise agreement required • Closed ecosystem • Compliance responsibility local
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-b from-slate-950 to-slate-900 border-t border-amber-900/20 py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-amber-500 to-orange-500">
                  <Store className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-500 bg-clip-text text-transparent">{platformName}</span>
              </div>
              <p className="text-sm text-slate-400">
                Franchise and infrastructure provider for medical cannabis dispensaries
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Platform</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link href="/onboarding" className="hover:text-amber-400 transition-colors">Get Started</Link></li>
                <li><Link href="#features" className="hover:text-amber-400 transition-colors">Features</Link></li>
                <li><Link href="/super-admin" className="hover:text-amber-400 transition-colors">Admin Portal</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" className="hover:text-amber-400 transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-amber-400 transition-colors">API Reference</a></li>
                <li><a href="#" className="hover:text-amber-400 transition-colors">Support</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" className="hover:text-amber-400 transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-amber-400 transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>

          {/* Regulatory Disclaimer */}
          <div className="border-t border-slate-800 pt-8 pb-6">
            <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-6 max-w-4xl mx-auto">
              <h4 className="text-white font-semibold mb-3 text-center">Important Regulatory Information</h4>
              <div className="space-y-2 text-xs text-slate-400 text-center">
                <p>
                  <strong className="text-amber-300">Popcorn Media is a franchise and infrastructure provider.</strong> We do not sell cannabis or process retail sales directly.
                </p>
                <p>
                  NFTs are used only to represent franchise ownership rights. All financial activity is tied to real-world entities and contracts.
                </p>
                <p>
                  <strong className="text-amber-300">Closed franchise system:</strong> No public marketplace. NFTs are not marketed as investments.
                  No token speculation. Compliance responsibility remains local.
                </p>
                <p className="text-slate-500 text-[10px] mt-3">
                  Popcorn Media acts as franchisor and infrastructure operator. This platform provides technology and operational frameworks exclusively for franchisees.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-8 text-center text-sm text-slate-400">
            <p>© 2025 {platformName}. All rights reserved. Franchise & Infrastructure Provider.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
