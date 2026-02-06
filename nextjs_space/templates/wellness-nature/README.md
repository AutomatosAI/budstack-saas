# Wellness & Nature Template

## Overview

A serene, organic template designed for wellness brands, CBD shops, and natural health products. Features earthy tones, spacious layouts, and a calming aesthetic that emphasizes natural healing and holistic wellness.

## Design Philosophy

- **Natural & Organic**: Earth-tone color palette (#6B8E23 sage green, #3C2F24 deep brown, #F5F1E8 cream)
- **Spacious & Breathable**: Generous whitespace and padding for a calm, uncluttered feel
- **Trust & Transparency**: Clean typography and clear information hierarchy
- **Accessible**: High contrast ratios and readable font sizes

## Key Features

- **Beautiful Hero Section**: Large wellness imagery with natural product showcase
- **Benefits Highlight**: 4-column grid showcasing key value propositions
- **Product Categories**: Visual category cards with emoji icons
- **Social Proof**: Customer testimonials with ratings
- **Consultation CTA**: 3-step process with clear call-to-action
- **Custom Footer**: Comprehensive links and contact information
- **Smooth Animations**: Framer Motion powered interactions
- **Fully Responsive**: Mobile-first design

## Customization

### Colors

The template uses natural earth tones that can be customized:

```json
{
  "primary": "#6B8E23",    // Sage Green
  "secondary": "#3C2F24",  // Deep Brown
  "accent": "#8B7355",     // Warm Brown
  "background": "#F5F1E8", // Cream
  "surface": "#ffffff"     // White
}
```

### Typography

- **Headings**: Lora (serif) - Elegant and readable
- **Body**: Montserrat (sans-serif) - Clean and modern

### Spacing

All sections use generous padding (py-24) for a spacious, calming feel.

## Components

### Hero
- Full-width hero with product imagery
- Trust badges (Certified Organic, Lab Tested, Eco-Friendly)
- Dual CTA buttons
- Floating stats badge

### Benefits
- 4-column responsive grid
- Icon-based feature highlights
- Hover animations

### Product Categories
- 4-column category showcase
- Gradient backgrounds
- Emoji icons for visual appeal
- "View All" CTA

### Testimonials
- 3-column testimonial cards
- Star ratings
- Quote styling

### Consultation CTA
- Sage green background
- 3-step process visualization
- Trust indicators
- Prominent CTA button

### Footer
- 4-column layout
- Brand information
- Quick links
- Contact details
- Social media icons

## Technical Details

- **Framework**: Next.js 14+, React 18+
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Scroll Detection**: react-intersection-observer
- **Styling**: Tailwind CSS + Custom CSS

## Browser Support

- Chrome (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Edge (last 2 versions)

## Performance

- Optimized images with Next.js Image component
- Lazy loading for below-fold content
- CSS animations for smooth transitions
- Minimal dependencies

## Accessibility

- WCAG 2.1 AA compliant
- Semantic HTML
- ARIA labels where appropriate
- Keyboard navigation support
- High contrast ratios

## Installation & Usage

This template is integrated into the BudStack multi-tenant system. Tenants can select it from the Template Selector in their admin dashboard.

## Version History

### 1.0.0 (2025-11-26)
- Initial release
- Complete template with all core components
- Responsive design
- Natural earth-tone styling
