# Vice City Cannabis Template - Installation Guide

## Overview

This guide walks you through installing and configuring the Vice City Cannabis template for your BudStack tenant.

## Prerequisites

- Access to BudStack Super Admin dashboard
- GitHub repository containing the template
- Tenant account set up in BudStack

## Installation Steps

### Step 1: Upload Template to GitHub

1. Create a new GitHub repository (e.g., `gta-cannabis-template`)
2. Upload all template files:
   ```
   template.config.json
   defaults.json
   index.tsx
   styles.css
   README.md
   INSTALLATION.md
   CUSTOMIZATION_GUIDE.md
   components/
     Hero.tsx
     About.tsx
     Features.tsx
     ProductShowcase.tsx
     ConsultationCTA.tsx
     Footer.tsx
   hawaii-illustration-retro-comic-style.jpg
   woman.jpg
   ```
3. Make the repository public
4. Copy the repository URL (e.g., `https://github.com/yourusername/gta-cannabis-template.git`)

### Step 2: Upload Template via Super Admin

1. Login to BudStack as Super Admin
   - URL: `https://budstack.to/auth/login`
   - Credentials: Your super admin credentials

2. Navigate to Template Management
   - Go to: `https://budstack.to/super-admin`
   - Click "Manage Templates" card

3. Upload Template
   - Click "Upload New Template" button
   - Paste GitHub URL: `https://github.com/yourusername/gta-cannabis-template.git`
   - Click "Upload Template"
   - Wait 15-30 seconds for clone + validation

4. Verify Upload Success
   - Template should appear in list as "Vice City Cannabis"
   - Status should be "Active"
   - Delete button should be available

### Step 3: Assign Template to Tenant

1. Login as Tenant Admin
   - URL: `https://budstack.to/auth/login`
   - Credentials: Your tenant admin credentials

2. Navigate to Branding
   - Go to: `https://budstack.to/tenant-admin/branding`

3. Select Template
   - Click "Change Template" button
   - Find "Vice City Cannabis" in the list
   - Click "Select Template"
   - Template defaults will be applied automatically

4. Customize Settings (Optional)
   - Update business name
   - Upload custom logo (or keep default behavior)
   - Adjust colors if needed
   - Modify hero image (or keep template default)
   - Update page content (titles, descriptions)
   - Click "Save Changes"

### Step 4: Verify Storefront

1. Visit your storefront
   - Path-based URL: `https://budstack.to/store/your-subdomain`
   - Custom domain: `https://your-domain.com` (if configured)

2. Check Template Rendering
   - Hero section with retro illustration
   - About section with team image
   - Features grid with icons
   - Product showcase
   - Consultation CTA
   - Footer with all links

3. Test Responsive Design
   - Mobile view (< 768px)
   - Tablet view (768px - 1024px)
   - Desktop view (> 1024px)

4. Verify Interactions
   - Scroll animations
   - Hover effects on cards
   - Button click navigation
   - Form submissions (if applicable)

## Troubleshooting

### Upload Fails

**Error: "Template with slug already exists"**
- Solution: Delete existing template first via Super Admin → Templates

**Error: "template.config.json not found"**
- Solution: Ensure `template.config.json` is in repository root
- Check: `https://github.com/yourusername/gta-cannabis-template/blob/main/template.config.json`

**Error: "Required file index.tsx not found"**
- Solution: Ensure `index.tsx` is in repository root
- Check: `https://github.com/yourusername/gta-cannabis-template/blob/main/index.tsx`

**Error: Git clone timeout**
- Solution: Check repository is public and accessible
- Verify: No large files (> 50MB) in repository
- Try: Upload again after a few minutes

### Template Not Rendering

**White/blank page**
- Check: Browser console (F12) for JavaScript errors
- Verify: All component files are uploaded
- Ensure: Dependencies are installed (Next.js, React, Framer Motion)

**Images not loading**
- Check: Image paths in `defaults.json` are correct
- Verify: Images are in template directory
- Ensure: Image files are not corrupted

**Styles not applying**
- Check: `styles.css` is in template root
- Verify: CSS file has no syntax errors
- Clear: Browser cache and hard refresh (Ctrl+Shift+R)

### Customization Issues

**Logo not displaying**
- In `defaults.json`, `logoPath` is set to `null` by design
- Upload logo via Tenant Admin → Branding → Logo Upload
- Or set custom path in tenant settings

**Colors not changing**
- Check: Tenant settings override template defaults
- Verify: Color values are valid hex codes (e.g., `#FF6B6B`)
- Ensure: Changes are saved via "Save Changes" button

**Content not updating**
- Check: `pageContent` fields in tenant settings
- Verify: Fields match expected names (e.g., `homeHeroTitle`)
- Clear: Browser cache and refresh

## Support

For additional help:

- Review: `CUSTOMIZATION_GUIDE.md` for branding options
- Check: BudStack documentation at `https://docs.budstack.io`
- Contact: BudStack support team

## Next Steps

1. Customize template via Tenant Admin → Branding
2. Add products via Tenant Admin → Products
3. Configure consultation settings
4. Test complete user flow
5. Go live with your storefront!
