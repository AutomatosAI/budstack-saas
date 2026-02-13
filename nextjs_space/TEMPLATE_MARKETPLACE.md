# Template Marketplace - Hot Upload System

## Overview

BudStacks' template marketplace supports **semi-automated hot template uploads** with automatic registry syncing and optional deployment triggers.

## How It Works

### 1. Template Upload Flow

```
Upload Template (via API)
    ↓
Files copied to /templates/{slug}/
    ↓
Database record created
    ↓
Registry auto-synced (npm run sync-templates)
    ↓
[OPTIONAL] Trigger Railway rebuild
    ↓
Template goes live
```

### 2. Template Structure

Templates must follow this structure:

```
templates/
└── your-template-name/
    ├── index.tsx              # Required: Main template component (default export)
    ├── styles.css             # Required: Template styles
    ├── template.config.json   # Required: Template metadata
    ├── defaults.json          # Optional: Default configuration
    ├── package.json           # Optional: Template-specific dependencies
    └── components/            # Optional: Template components
        ├── Navigation.tsx     # Optional: Custom navigation
        ├── Footer.tsx         # Optional: Custom footer
        └── *.tsx              # Other components
```

### 3. template.config.json Format

```json
{
  "id": "your-template-slug",
  "name": "Your Template Name",
  "description": "Template description",
  "category": "modern",
  "tags": ["tag1", "tag2"],
  "version": "1.0.0",
  "author": "Author Name",
  "preview_image": "https://...",
  "features": ["Feature 1", "Feature 2"],
  "compatibility": {
    "nextjs": "14.x",
    "react": "18.x"
  }
}
```

## Usage

### For Super Admins

#### Upload a New Template

1. **Via UI**: Navigate to Super Admin > Templates > Upload Template
   - Enter template name
   - Provide GitHub repository URL
   - Select structure type (default/lovable)
   - Click Upload

2. **Via API**:
```bash
curl -X POST https://your-domain.com/api/super-admin/templates/upload \
  -H "Content-Type: application/json" \
  -d '{
    "templateName": "My Template",
    "githubUrl": "https://github.com/username/template-repo",
    "structureType": "default"
  }'
```

#### Activate the Template (2 Options)

**Option A: Automatic (Recommended)**
- Set `RAILWAY_DEPLOY_WEBHOOK_URL` environment variable
- Template upload will automatically trigger rebuild
- Template goes live in 3-5 minutes

**Option B: Manual**
1. Upload completes and syncs registry
2. Push the updated registry to git:
   ```bash
   git add lib/template-registry.ts
   git commit -m "Add new template: Template Name"
   git push
   ```
3. Railway auto-deploys on push
4. Template goes live after build

#### Manual Registry Sync (if needed)

```bash
npm run sync-templates
```

This scans `/templates/` and regenerates `lib/template-registry.ts`.

### For Tenant Admins

1. Navigate to Tenant Admin > Templates > Marketplace
2. Browse available templates
3. Click "Clone" on desired template
4. Customize in Tenant Admin > Branding
5. Activate the template

## Architecture

### Why Registry Sync?

Next.js requires static imports at build time for code splitting and SSR. We can't truly "hot swap" templates without a rebuild. Our solution:

1. **Auto-Registry Generation**: `sync-template-registry.ts` scans templates and generates imports
2. **Semi-Automated**: Registry updates automatically on upload
3. **One Rebuild**: Single rebuild makes all new templates available

### Future: True Hot Swapping

For v2, we're exploring:
- Template-as-configuration (JSON-based templates)
- Generic renderer for uploaded templates
- Serverless template execution
- Client-side template hydration

## Railway Deployment Webhook Setup

To enable automatic rebuilds after template upload:

1. Go to Railway Project > Settings > Webhooks
2. Create new webhook (type: "Deployment")
3. Copy the webhook URL
4. Add to Railway environment variables:
   ```
   RAILWAY_DEPLOY_WEBHOOK_URL=https://backboard.railway.app/webhooks/...
   ```
5. Save and redeploy

Now template uploads will automatically trigger rebuilds!

## Development

### Testing Template Upload Locally

```bash
# 1. Start dev server
npm run dev

# 2. Upload test template
curl -X POST http://localhost:3000/api/super-admin/templates/upload \
  -H "Content-Type: application/json" \
  -d '{"templateName": "Test", "githubUrl": "https://github.com/..."}'

# 3. Registry auto-syncs
# 4. Restart dev server to pick up changes
```

### Creating a Template

1. Clone the template starter: https://github.com/your-org/template-starter
2. Customize components, styles, and config
3. Push to GitHub
4. Upload via admin panel
5. Test on staging environment
6. Publish to production

## Troubleshooting

### Template Not Showing in Marketplace

- Check database: Template record exists?
- Check filesystem: Files in `/templates/{slug}/`?
- Check registry: Slug listed in `lib/template-registry.ts`?
- Check build: Did deployment complete successfully?

### Template Loads But Looks Broken

- Check browser console for errors
- Verify styles.css is being loaded
- Check component imports (case-sensitive paths)
- Validate template.config.json syntax

### Registry Out of Sync

Run manual sync:
```bash
npm run sync-templates
git add lib/template-registry.ts
git commit -m "Sync template registry"
git push
```

## Best Practices

1. **Template Naming**: Use kebab-case (my-template-name)
2. **Version Control**: Tag template versions in git
3. **Testing**: Test templates on staging before production
4. **Documentation**: Include README.md in each template
5. **Dependencies**: Minimize external dependencies
6. **Performance**: Optimize images and lazy-load components
7. **Accessibility**: Follow WCAG 2.1 AA standards

## API Reference

### POST /api/super-admin/templates/upload
Upload a new template from GitHub

**Request**:
```json
{
  "templateName": "string",
  "githubUrl": "string",
  "structureType": "default" | "lovable"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Template uploaded successfully...",
  "template": {
    "id": "uuid",
    "slug": "template-slug",
    "name": "Template Name"
  },
  "requiresRebuild": true
}
```

### POST /api/super-admin/templates/trigger-rebuild
Manually trigger a deployment rebuild

**Response**:
```json
{
  "success": true,
  "message": "Deployment triggered successfully...",
  "estimatedTime": "3-5 minutes"
}
```

### DELETE /api/super-admin/templates/{id}
Delete a template

**Response**:
```json
{
  "success": true,
  "message": "Template deleted successfully"
}
```

---

**Questions?** Contact the dev team or check the wiki.
