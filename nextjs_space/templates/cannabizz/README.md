# CannaBiZZ Template

A playful, neon-drenched dark template for millennial cannabis consumers. Miami neon meets street art — vibrant purples, electric greens, and bold blues on a dark canvas. Built with spring animations and a casual, fun tone.

## Installation

### Option A: Upload to BudStack via GitHub
1. Push this repo to GitHub
2. Go to BudStack Super Admin → Store Templates
3. Click "Upload New Template"
4. Enter GitHub URL
5. Select "Default (BudStack)" structure
6. Click Upload

### Option B: Local Preview
```bash
cp -r . /path/to/budstack-saas/nextjs_space/templates/cannabizz/
cd /path/to/budstack-saas/nextjs_space
npx tsx scripts/sync-template-registry.ts
npm run dev
```
Visit: `http://localhost:3000/store/preview/cannabizz`

## Template Details
- **Category:** Modern
- **Mood:** Playful + Dark (Miami Neon)
- **Primary:** Neon Purple (275 70% 55%)
- **Secondary:** Neon Green (145 80% 55%)
- **Accent:** Electric Blue (210 100% 65%)
- **Fonts:** Outfit (headings) / Nunito (body)
- **Animations:** Spring-based (stiffness: 100, damping: 12)

## Structure
- `index.tsx` — Main template component
- `styles.css` — Dark theme styles with neon glow utilities
- `defaults.json` — Design system and default content
- `template.config.json` — Template metadata
- `components/` — 9 section components

## Sections
1. **Navigation** — Sticky full nav with neon CTA glow
2. **Hero** — Fullscreen with neon gradient overlay + ambient glow orbs
3. **ValueProps** — 4 icon cards on dark surface
4. **About** — Brand story with image and inline stats
5. **Features** — 6-item icon grid
6. **Stats** — Animated counters on neon gradient
7. **FAQ** — Spring-animated accordion
8. **ConsultationCTA** — Gradient CTA with ambient glow
9. **Footer** — Full multi-column with brand column

## Customization
After uploading to BudStack, tenants customize via `/tenant-admin/branding`:
- Logo and hero image
- Colors (primary, secondary, accent)
- Fonts
- Business info and content
