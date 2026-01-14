import {
  Navbar,
  Footer,
  Hero,
  DashboardPreview,
  InfrastructureSection,
  EcosystemSection,
  ManagementModels,
  ApplicationStepsSection,
  FeaturesSection,
  FranchiseOpportunitySection,
  PricingSection,
  TestimonialsSection,
  CTASection,
} from "@/components/landing";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        <DashboardPreview />
        <InfrastructureSection />
        <EcosystemSection />
        <ManagementModels />
        <ApplicationStepsSection />
        <FeaturesSection />
        <FranchiseOpportunitySection />
        <PricingSection />
        <TestimonialsSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
