import { ComponentType } from 'react';
import type { SectionProps } from './types/section-props';

// Heroes
import { HeroFullScreen } from '@/components/sections/heroes/HeroFullScreen';
import { HeroSplit } from '@/components/sections/heroes/HeroSplit';
import { HeroVideo } from '@/components/sections/heroes/HeroVideo';
import { HeroMinimal } from '@/components/sections/heroes/HeroMinimal';

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

// CTAs
import { CTABanner } from '@/components/sections/ctas/CTABanner';
import { CTAWithImage } from '@/components/sections/ctas/CTAWithImage';
import { CTASplit } from '@/components/sections/ctas/CTASplit';

// Navigation
import { NavMinimal } from '@/components/sections/navigation/NavMinimal';
import { NavFull } from '@/components/sections/navigation/NavFull';
import { NavTransparent } from '@/components/sections/navigation/NavTransparent';

// Footers
import { FooterSimple } from '@/components/sections/footers/FooterSimple';
import { FooterFull } from '@/components/sections/footers/FooterFull';

export const SECTION_REGISTRY: Record<string, ComponentType<SectionProps>> = {
  HeroFullScreen,
  HeroSplit,
  HeroVideo,
  HeroMinimal,
  ValueProps,
  ProductShowcase,
  Testimonials,
  About,
  Gallery,
  Stats,
  FAQ,
  BlogFeed,
  Features,
  CTABanner,
  CTAWithImage,
  CTASplit,
  NavMinimal,
  NavFull,
  NavTransparent,
  FooterSimple,
  FooterFull,
};

export function getSectionComponent(type: string): ComponentType<SectionProps> | null {
  return SECTION_REGISTRY[type] || null;
}
