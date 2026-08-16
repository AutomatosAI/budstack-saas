import Nav from "@/components/homepage/Nav";
import Hero from "@/components/homepage/Hero";
import Partners from "@/components/homepage/Partners";
import DashboardShowcase from "@/components/homepage/DashboardShowcase";
import FeatureTabs from "@/components/homepage/FeatureTabs";
import InvestmentBento from "@/components/homepage/InvestmentBento";
import GlobalMap from "@/components/homepage/GlobalMap";
import LeadMagnet from "@/components/homepage/LeadMagnet";
import CTA from "@/components/homepage/CTA";
import Footer from "@/components/homepage/Footer";
import type { Metadata } from "next";
import { generatePlatformRouteMetadata } from "@/lib/seo/generate-platform-metadata";

/**
 * US-015 — the homepage's title, description and social card come from
 * `platform_seo_settings` when a super-admin has authored them. This page
 * exported no metadata at all before, so it served the root layout's block;
 * that block is still what it falls back to, now via PLATFORM_ROUTE_FALLBACKS.
 */
export function generateMetadata(): Promise<Metadata> {
  return generatePlatformRouteMetadata("/");
}

export default function HomePage() {
    return (
        <div className="budstacks-theme min-h-screen">
            <Nav />
            <main>
                <Hero />
                <Partners />
                <DashboardShowcase />
                <FeatureTabs />
                <InvestmentBento />
                <GlobalMap />
                <LeadMagnet />
                <CTA />
            </main>
            <Footer />
        </div>
    );
}
