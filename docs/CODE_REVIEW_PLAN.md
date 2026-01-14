# BudStack Code Review Plan

## Strategy: Phased Branch Reviews

Create branches with trivial changes (whitespace, comments, or formatting) to trigger CodeRabbit review on each file batch. This forces review without changing functionality.

---

## Codebase Summary

| Directory | Files | Description |
|-----------|-------|-------------|
| `app/api/` | ~79 | API routes |
| `app/store/` | ~34 | Storefront pages |
| `app/tenant-admin/` | ~37 | Tenant admin pages |
| `app/super-admin/` | ~22 | Super admin pages |
| `components/admin/` | ~33 | Admin components |
| `components/ui/` | ~49 | UI primitives |
| `components/` (root) | ~20 | Shared components |
| `lib/` | ~34 | Utilities & services |
| **Total** | ~333 | TypeScript/TSX files |

---

## Phase Plan (6 Phases)

### Phase 1: Core Infrastructure (~50 files)
**Branch:** `review/phase1-core`

```
lib/                          # All lib files (~34)
prisma/schema.prisma          # Database schema
app/layout.tsx                # Root layout
app/page.tsx                  # Landing page
components/session-provider.tsx
components/query-provider.tsx
components/theme-provider.tsx
```

**Focus:** Database, auth, utilities, API clients

---

### Phase 2: UI Components (~55 files)
**Branch:** `review/phase2-ui`

```
components/ui/                # All UI primitives (~49)
components/footer.tsx
components/navigation.tsx
components/cookie-consent.tsx
components/language-switcher.tsx
components/tenant-theme-provider.tsx
```

**Focus:** Reusable UI components, accessibility, consistency

---

### Phase 3: API Routes (~55 files)
**Branch:** `review/phase3-api`

```
app/api/auth/
app/api/tenant-admin/
app/api/super-admin/
app/api/store/
app/api/webhooks/
```

**Focus:** Security, authorization, error handling, validation

---

### Phase 4: Admin Components (~35 files)
**Branch:** `review/phase4-admin-components`

```
components/admin/             # All admin components
components/consultation/
components/home/
components/shop/
```

**Focus:** Business logic, state management, forms

---

### Phase 5: Tenant Admin Pages (~40 files)
**Branch:** `review/phase5-tenant-admin`

```
app/tenant-admin/             # All tenant admin pages
app/auth/
app/onboarding/
```

**Focus:** Page structure, data fetching, permissions

---

### Phase 6: Storefront & Super Admin (~50 files)
**Branch:** `review/phase6-storefront`

```
app/store/                    # All storefront pages
app/super-admin/              # All super admin pages
```

**Focus:** Customer-facing UX, SEO, SSR

---

## How to Trigger CodeRabbit

For each phase, make a trivial change to each file:

```bash
# Option 1: Add trailing newline
echo "" >> file.tsx

# Option 2: Add/update file header comment
# Add to top of each file:
# // Reviewed: Phase X - 2026-01-13

# Option 3: Run prettier (will touch all files)
npx prettier --write "app/api/**/*.ts"
```

### Workflow Script

```bash
#!/bin/bash
# Run from nextjs_space directory

PHASE=$1
PATTERN=$2

# Create branch
git checkout -b "review/phase${PHASE}"

# Touch files (add trailing newline)
find "$PATTERN" \( -name "*.ts" -o -name "*.tsx" \) | while read -r f; do
  echo "" >> "$f"
done

# Commit and push
git add .
git commit -m "chore: Phase ${PHASE} code review batch"
git push -u origin "review/phase${PHASE}"

# Create PR (use gh CLI)
gh pr create --title "Code Review: Phase ${PHASE}" --body "Batch review for CodeRabbit"
```

---

## Execution Order

| Phase | Branch | Est. Review Time |
|-------|--------|------------------|
| 1 | `review/phase1-core` | 1-2 days |
| 2 | `review/phase2-ui` | 1-2 days |
| 3 | `review/phase3-api` | 2-3 days |
| 4 | `review/phase4-admin-components` | 1-2 days |
| 5 | `review/phase5-tenant-admin` | 1-2 days |
| 6 | `review/phase6-storefront` | 2-3 days |

**Total:** ~10-14 days

---

## After Each Phase

1. Review CodeRabbit comments
2. Create fix PRs for critical issues
3. Merge phase branch (no-op changes)
4. Move to next phase

---

## Quick Start

```bash
cd /Users/gkavanagh/Development/HealingBuds/budstack-saas/nextjs_space

# Phase 1
git checkout -b review/phase1-core
npx prettier --write "lib/**/*.ts"
git add . && git commit -m "chore: Phase 1 code review - core infrastructure"
git push -u origin review/phase1-core
gh pr create --title "Code Review: Phase 1 - Core Infrastructure" --body "Batch review for lib/, prisma, root layouts"
```
