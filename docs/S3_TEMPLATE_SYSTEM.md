# S3-Backed Template Marketplace

## Overview

Templates are now **permanently stored in S3** and automatically synced to the filesystem on every deployment. This enables true marketplace functionality with hot uploads.

## How It Works

### Upload Flow
```
1. Admin uploads template via API
   ↓
2. Files extracted from GitHub
   ↓
3. Files uploaded to S3 (templates/{slug}/)
   ↓
4. Database record created
   ↓
5. Registry auto-synced locally
   ↓
6. Template available immediately on Railway
```

### Deployment Flow
```
1. Railway starts deployment
   ↓
2. entrypoint.sh runs
   ↓
3. S3 sync downloads all templates
   ↓
4. Templates → /app/templates/
   ↓
5. Registry auto-generated
   ↓
6. App starts with all templates
```

## Key Benefits

✅ **Persistent Storage**: Templates survive rebuilds (stored in S3)
✅ **Fast Cloning**: Templates already in S3, instant tenant clones
✅ **Clean Repo**: No marketplace content cluttering git
✅ **Hot Upload**: Upload once, available everywhere
✅ **Scalable**: Unlimited templates without repo bloat

## Architecture

### S3 Structure
```
s3://your-bucket/
└── templates/
    ├── yellow-haze/
    │   ├── index.tsx
    │   ├── styles.css
    │   ├── template.config.json
    │   └── components/
    │       ├── Hero.tsx
    │       └── ...
    ├── another-template/
    │   └── ...
    └── ...
```

### Local Filesystem (After Sync)
```
/app/templates/
├── yellow-haze/      # From S3
├── gta-cannabis/     # Built-in (git)
├── healingbuds/      # Built-in (git)
└── wellness-nature/  # Built-in (git)
```

## Deployment Process

### Automatic (Production)

Railway's `entrypoint.sh` automatically:
1. Syncs templates from S3
2. Generates template registry
3. Starts application

No manual intervention needed!

### Manual (Development)

```bash
# Sync templates from S3
npm run sync-s3-templates

# Generate registry
npm run sync-templates

# Restart dev server
npm run dev
```

## Template Upload

### Via UI
1. Super Admin > Templates > Upload
2. Enter GitHub URL
3. Click Upload
4. Template automatically:
   - Uploaded to S3
   - Added to database
   - Available on next deployment

### Via API
```bash
curl -X POST https://your-domain.com/api/super-admin/templates/upload \
  -H "Content-Type: application/json" \
  -d '{
    "templateName": "My Template",
    "githubUrl": "https://github.com/user/repo"
  }'
```

## Clone Performance

### Before (Filesystem Copy)
- Clone time: 2-5 seconds
- Storage: Duplicated on filesystem
- Rebuilds: Lost after deployment

### After (S3-Backed)
- Clone time: < 1 second (S3 metadata only)
- Storage: Single source in S3
- Rebuilds: Persists permanently

## Troubleshooting

### Template Not Loading

**Check S3:**
```bash
# List templates in S3
aws s3 ls s3://your-bucket/templates/

# Check specific template
aws s3 ls s3://your-bucket/templates/yellow-haze/ --recursive
```

**Check Filesystem:**
```bash
# On Railway (via bash)
ls -la /app/templates/

# Locally
ls -la templates/
```

**Check Registry:**
```bash
# View generated registry
cat lib/template-registry.ts
```

### S3 Sync Failed

Check environment variables:
- `AWS_BUCKET_NAME`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`

View deployment logs for sync errors.

### Template Updates Not Showing

1. Re-upload template (overwrites S3)
2. Trigger deployment (syncs from S3)
3. Clear browser cache

## Migration Guide

### Migrating Existing Templates to S3

```bash
# For each existing template:
cd templates/your-template

# Upload to S3 manually
aws s3 sync . s3://your-bucket/templates/your-template/

# Or use the upload API
# (will detect existing files and upload to S3)
```

### Keeping Some Templates Git-Based

You can mix S3 and git-based templates:
- **Built-in templates**: Keep in git (healingbuds, etc.)
- **Marketplace templates**: Store in S3
- **Auto-sync** merges both on deployment

## Best Practices

1. **Template Naming**: Use kebab-case (my-template)
2. **S3 Organization**: One folder per template
3. **Versioning**: Use template.config.json version field
4. **Testing**: Test on staging before production
5. **Cleanup**: Delete S3 files when deleting templates
6. **Monitoring**: Watch S3 sync logs during deployment

## Cost Optimization

### S3 Storage
- Typical template: ~500KB
- 100 templates: ~50MB
- Monthly cost: ~$0.01

### Data Transfer
- Deployment sync: ~50MB download
- 30 deploys/month: 1.5GB
- Monthly cost: ~$0.15

**Total**: < $0.20/month for 100 templates

## Security

- S3 bucket is private (no public access)
- Railway uses IAM credentials for access
- Templates scanned on upload (future feature)
- No arbitrary code execution (templates reviewed)

## Future Enhancements

- [ ] Template CDN for faster global access
- [ ] Template versioning system
- [ ] Automatic security scanning
- [ ] Template preview before activation
- [ ] Marketplace ratings & reviews
- [ ] Premium template payments
- [ ] Template analytics dashboard

---

**Questions?** Check the main TEMPLATE_MARKETPLACE.md or contact dev team.
