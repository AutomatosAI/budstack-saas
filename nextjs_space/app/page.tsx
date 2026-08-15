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
