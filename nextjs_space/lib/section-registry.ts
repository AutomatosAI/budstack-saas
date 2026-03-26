import { ComponentType } from 'react';
import type { SectionProps } from './types/section-props';

// Heroes
import { HeroFullScreen } from '@/components/sections/heroes/HeroFullScreen';
import { HeroSplit } from '@/components/sections/heroes/HeroSplit';
import { HeroVideo } from '@/components/sections/heroes/HeroVideo';
import { HeroMinimal } from '@/components/sections/heroes/HeroMinimal';
import { HeroWarpShader } from '@/components/sections/heroes/HeroWarpShader';
import { HeroMeshGradient } from '@/components/sections/heroes/HeroMeshGradient';
import { HeroAurora } from '@/components/sections/heroes/HeroAurora';
import { HeroShaderGlass } from '@/components/sections/heroes/HeroShaderGlass';
import { HeroDesignali } from '@/components/sections/heroes/HeroDesignali';
import { HeroSplitImages } from '@/components/sections/heroes/HeroSplitImages';
import { HeroFuturistic } from '@/components/sections/heroes/HeroFuturistic';
import { HeroCollage } from '@/components/sections/heroes/HeroCollage';

// Content sections
import { ValueProps } from '@/components/sections/content/ValueProps';
import { ProductShowcase } from '@/components/sections/content/ProductShowcase';
import { Testimonials } from '@/components/sections/content/Testimonials';
import { About } from '@/components/sections/content/About';
import { Gallery } from '@/components/sections/content/Gallery';
import { Stats } from '@/components/sections/content/Stats';
import { FAQ } from '@/components/sections/content/FAQ';
import { BlogFeed } from '@/components/sections/content/BlogFeed';
import { Features } from '@/components/sections/content/Features';
import { ImageShowcase } from '@/components/sections/content/ImageShowcase';
import { LogoMarquee } from '@/components/sections/content/LogoMarquee';
import { BentoGrid } from '@/components/sections/content/BentoGrid';
import { Pricing } from '@/components/sections/content/Pricing';
import { TeamGrid } from '@/components/sections/content/TeamGrid';
import { Timeline } from '@/components/sections/content/Timeline';
import { ComparisonTable } from '@/components/sections/content/ComparisonTable';
import { Parallax } from '@/components/sections/content/Parallax';
import { SocialProof } from '@/components/sections/content/SocialProof';
import { TabsShowcase } from '@/components/sections/content/TabsShowcase';
import { VideoGallery } from '@/components/sections/content/VideoGallery';
import { ProcessSteps } from '@/components/sections/content/ProcessSteps';
import { StatsCounter } from '@/components/sections/content/StatsCounter';

// CTAs
import { CTABanner } from '@/components/sections/ctas/CTABanner';
import { CTAWithImage } from '@/components/sections/ctas/CTAWithImage';
import { CTASplit } from '@/components/sections/ctas/CTASplit';
import { Newsletter } from '@/components/sections/ctas/Newsletter';

// Navigation
import { NavMinimal } from '@/components/sections/navigation/NavMinimal';
import { NavFull } from '@/components/sections/navigation/NavFull';
import { NavTransparent } from '@/components/sections/navigation/NavTransparent';
import { NavDark } from '@/components/sections/navigation/NavDark';
import { NavHealingBuds } from '@/components/sections/navigation/NavHealingBuds';

// Footers
import { FooterSimple } from '@/components/sections/footers/FooterSimple';
import { FooterFull } from '@/components/sections/footers/FooterFull';
import { FooterBrand } from '@/components/sections/footers/FooterBrand';

export const SECTION_REGISTRY: Record<string, ComponentType<SectionProps>> = {
  HeroFullScreen,
  HeroSplit,
  HeroVideo,
  HeroMinimal,
  HeroWarpShader,
  HeroMeshGradient,
  HeroAurora,
  HeroShaderGlass,
  HeroDesignali,
  HeroSplitImages,
  HeroFuturistic,
  HeroCollage,
  ValueProps,
  ProductShowcase,
  Testimonials,
  About,
  Gallery,
  Stats,
  FAQ,
  BlogFeed,
  Features,
  ImageShowcase,
  LogoMarquee,
  BentoGrid,
  Pricing,
  TeamGrid,
  Timeline,
  ComparisonTable,
  Parallax,
  SocialProof,
  TabsShowcase,
  VideoGallery,
  ProcessSteps,
  StatsCounter,
  CTABanner,
  CTAWithImage,
  CTASplit,
  Newsletter,
  NavMinimal,
  NavFull,
  NavTransparent,
  NavDark,
  NavHealingBuds,
  FooterSimple,
  FooterFull,
  FooterBrand,
};

export function getSectionComponent(type: string): ComponentType<SectionProps> | null {
  return SECTION_REGISTRY[type] || null;
}
