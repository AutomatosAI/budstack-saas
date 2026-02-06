import { Tenant } from '@/types/client';
import { HeroSection } from '@/components/home/hero-section';
import { TrustBadges } from '@/components/home/trust-badges';
import { FeaturedConditions } from '@/components/home/featured-conditions';
import { ProcessSteps } from '@/components/home/process-steps';
import { EducationalContent } from '@/components/home/educational-content';
import { TestimonialsSlider } from '@/components/home/testimonials-slider';
import { CallToAction } from '@/components/home/call-to-action';

interface WellnessNatureTemplateProps {
  tenant: Tenant;
  heroImageUrl?: string | null;
  consultationUrl: string;
}

export function WellnessNatureTemplate({
  tenant,
  heroImageUrl,
  consultationUrl,
}: WellnessNatureTemplateProps) {
  const settings = (tenant.settings as any) || {};
  const colors = {
    primary: settings.primaryColor || '#059669', // Nature green
    secondary: settings.secondaryColor || '#14b8a6',
    accent: settings.accentColor || '#84cc16',
  };

  return (
    <div
      className="template-wellness-nature"
      style={{
        '--primary-color': colors.primary,
        '--secondary-color': colors.secondary,
        '--accent-color': colors.accent,
      } as React.CSSProperties}
    >
      <HeroSection tenant={tenant} heroImageUrl={heroImageUrl} consultationUrl={consultationUrl} />
      <TrustBadges />
      <FeaturedConditions consultationUrl={consultationUrl} />
      <ProcessSteps consultationUrl={consultationUrl} />
      <EducationalContent />
      <TestimonialsSlider />
      <CallToAction tenant={tenant} consultationUrl={consultationUrl} />
    </div>
  );
}
