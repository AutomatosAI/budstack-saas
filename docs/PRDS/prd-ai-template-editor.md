# PRD: AI Template Editor Chatbot

## 1. Introduction

Add a conversational AI assistant to the tenant admin panel that lets tenants customize their store template through natural language. Instead of navigating forms and settings pages, tenants describe what they want — "change the hero title", "make the primary color darker", "add a FAQ section", "swap the testimonials and about sections" — and the AI modifies the template data in real-time with a live preview.

**Current State:**
- Tenants customize templates via the Branding page (colors, fonts, logo, hero image)
- No way to edit layout (section order, section configs) without uploading a new template from GitHub
- No way to edit page content (hero title, subtitles, value props) beyond branding fields
- No way to add/remove/reorder sections
- Template customization requires developer knowledge or a new GitHub upload

**Target State:**
- Tenant admin has a "Template Editor" page with split-pane: chat panel + live preview
- Tenants describe changes in plain English → AI modifies template data → preview updates in real-time
- AI can modify: colors, fonts, text content, section order, section configs, add/remove sections, CSS treatments
- All changes scoped exclusively to the tenant's own template data — no access to anything else
- Changes persist to S3 and database on explicit save
- Full undo/redo history

## 2. Goals

- **Democratize Customization:** Non-technical tenants can fully customize their store without developer help
- **Real-Time Feedback:** Every change is immediately visible in the live preview
- **Security First:** AI can ONLY modify the tenant's own template data — sandboxed, validated, audited
- **Preserve Architecture:** Uses the existing data-driven template system (layout.json + defaults.json + styles.css) — no new rendering pipeline
- **Incremental Changes:** Each AI action modifies one thing at a time — atomic, reversible, auditable

## 3. Non-Goals

- AI does NOT generate React components or custom code
- AI does NOT have access to tenant business data (orders, customers, products)
- AI does NOT have access to other tenants' templates or data
- AI does NOT deploy changes — tenant must explicitly save and activate
- AI does NOT replace the existing branding page — it's an alternative interface
- No autonomous actions — every modification requires the tenant to see it in preview first

## 4. Security Model

### 4.1 Tenant Isolation (CRITICAL)

The AI operates in a strict sandbox scoped to ONE tenant's template data:

```
ALLOWED:
  ✓ Read/modify THIS tenant's layout.json sections and configs
  ✓ Read/modify THIS tenant's defaults.json (colors, fonts, text, navigation, footer)
  ✓ Read/modify THIS tenant's styles.css (scoped CSS variables and overrides)
  ✓ Read the component catalog (what sections exist and their configs)

BLOCKED:
  ✗ Any database queries or mutations beyond template data
  ✗ Access to other tenants' data, templates, or S3 paths
  ✗ Access to tenant business data (orders, customers, products, billing)
  ✗ Access to platform config, super admin settings, or system tables
  ✗ Execution of arbitrary code, scripts, or system commands
  ✗ File system access beyond the template S3 prefix
  ✗ External API calls or network requests
  ✗ Access to environment variables, secrets, or credentials
```

### 4.2 Tool-Level Enforcement

Every tool the AI can call is:

1. **Server-side only** — tools execute in API route handlers, never on client
2. **Tenant-scoped** — every tool receives `tenantId` from the authenticated session (not from AI input)
3. **Schema-validated** — all inputs validated with Zod before execution
4. **Allowlisted values** — section types, color names, font names checked against known-good lists
5. **Size-limited** — text inputs capped (title: 200 chars, description: 1000 chars, CSS: 50KB)
6. **Sanitized** — CSS sanitized (no @import, url(), expression(), javascript:), text stripped of HTML/script tags
7. **Audited** — every tool call logged with tenant ID, tool name, parameters, timestamp

### 4.3 Input Sanitization

```
User message → Claude API → Tool call → Validate with Zod → Sanitize → Apply → Return
                                              ↓
                                        Reject if invalid
                                        (don't execute, return error to AI)
```

**CSS injection prevention:**
- Strip `@import`, `url()`, `expression()`, `javascript:`, `behavior:`, `-moz-binding:`
- Only allow properties under `.template-{slug}` scope (already enforced by template-renderer.tsx)
- CSS changes stored as structured data where possible (color values, font names) rather than raw CSS strings

**JSON injection prevention:**
- Tool parameters are typed — AI can't inject arbitrary JSON paths
- Each tool modifies ONE specific field — no generic "set any field" tool
- Layout section types validated against the component registry allowlist

### 4.4 Rate Limiting

- Max 60 AI requests per tenant per hour
- Max 500 tool calls per tenant per day
- Max 10 concurrent sessions per tenant
- Token budget per session: 100K tokens (prevents runaway conversations)

### 4.5 Audit Trail

Every AI interaction logged to `template_edit_logs` table:
```
tenant_id, user_id, session_id, timestamp,
message_type (user|assistant|tool_call|tool_result),
tool_name, tool_params, tool_result,
template_snapshot_before, template_snapshot_after
```

Super admins can review any tenant's AI edit history.

## 5. User Stories

### 5.1 HIGH PRIORITY — Core Editor

#### US-001: Open Template Editor
**As a** tenant admin, **I want to** open an AI-powered template editor **so that** I can customize my store through conversation.

**Acceptance Criteria:**
- [ ] New "AI Editor" button on tenant admin Templates page (next to Customize)
- [ ] Opens `/tenant-admin/templates/[id]/editor` page
- [ ] Split-pane layout: chat panel (left 40%) + live preview (right 60%)
- [ ] Chat panel has message input, send button, message history
- [ ] Live preview shows the current template rendered in an iframe
- [ ] Only available for the tenant's active template or selected "My Templates" entry
- [ ] Requires authentication — session must have valid tenant context
- [ ] Typecheck passes

#### US-002: Change Colors via Chat
**As a** tenant admin, **I want to** say "change the primary color to navy blue" **so that** my store colors update immediately.

**Acceptance Criteria:**
- [ ] AI understands color requests in multiple formats: color names ("navy blue"), hex ("#1e3a5f"), descriptions ("make it darker", "more vibrant")
- [ ] AI converts to HSL format internally (the template system requires raw HSL)
- [ ] `updateColor` tool modifies the specific color in defaults.json designSystem
- [ ] CSS variables in styles.css updated to match
- [ ] Preview iframe refreshes to show new colors
- [ ] Supports all 8 color tokens: primary, secondary, accent, background, surface, text, heading, border
- [ ] AI confirms the change with the HSL value: "Updated primary to 220 60% 35%"
- [ ] Typecheck passes

#### US-003: Edit Text Content via Chat
**As a** tenant admin, **I want to** say "change the hero title to Welcome to GreenLeaf" **so that** my store content updates.

**Acceptance Criteria:**
- [ ] AI can modify: hero title, hero subtitle, hero description, about text, CTA button text
- [ ] AI can modify section-specific text: value prop titles/descriptions, FAQ questions/answers, testimonial quotes
- [ ] `updateText` tool targets the correct field in defaults.json or layout.json section config
- [ ] Text input sanitized (no HTML, no script tags)
- [ ] Text length validated per field (title: 200 chars, description: 1000 chars)
- [ ] Preview updates immediately
- [ ] Typecheck passes

#### US-004: Add/Remove Sections via Chat
**As a** tenant admin, **I want to** say "add a FAQ section" or "remove the stats" **so that** I can control my page layout.

**Acceptance Criteria:**
- [ ] `addSection` tool: AI picks from the 22 registered section types
- [ ] New section inserted at a logical position (or user-specified: "add FAQ before the footer")
- [ ] Section gets a unique ID and default config from the component catalog
- [ ] `removeSection` tool: removes by section ID or type name
- [ ] AI warns before removing: "I'll remove the Stats section. This will delete the counter data. Proceed?"
- [ ] Preview updates to reflect new/removed section
- [ ] Section type validated against component registry allowlist
- [ ] Max 10 sections enforced (prevent absurd layouts)
- [ ] Typecheck passes

#### US-005: Reorder Sections via Chat
**As a** tenant admin, **I want to** say "move testimonials above the FAQ" **so that** I can control page flow.

**Acceptance Criteria:**
- [ ] `reorderSections` tool accepts source section ID and target position
- [ ] AI understands relative positions: "before FAQ", "after hero", "to the top", "to the bottom"
- [ ] Hero always stays first (prevent moving hero to middle of page)
- [ ] Preview updates with new section order
- [ ] Typecheck passes

#### US-006: Change Typography via Chat
**As a** tenant admin, **I want to** say "use a serif font for headings" **so that** I can change the typographic feel.

**Acceptance Criteria:**
- [ ] `changeFont` tool updates heading font, body font, or both
- [ ] AI knows the 20 curated font pairings from the template system
- [ ] Can suggest pairings: "For a luxury feel, I'd recommend Playfair Display for headings + Source Sans 3 for body"
- [ ] Updates: defaults.json typography, styles.css font variables, Google Fonts URL in both layout.json and styles.css
- [ ] Font names validated against Google Fonts allowlist (no arbitrary font injection)
- [ ] Preview loads new fonts and refreshes
- [ ] Typecheck passes

#### US-007: Save Changes
**As a** tenant admin, **I want to** explicitly save my changes **so that** they persist and go live on my store.

**Acceptance Criteria:**
- [ ] "Save" button in the editor UI (separate from chat — this is a deliberate action)
- [ ] Saves modified layout.json, defaults.json, styles.css back to tenant's S3 path
- [ ] Updates TenantTemplate record in database (designSystem, pageContent, navigation, footer, customCss)
- [ ] Shows confirmation: "Changes saved! Your store has been updated."
- [ ] If tenant navigates away without saving, show "Unsaved changes" warning
- [ ] Typecheck passes

### 5.2 MEDIUM PRIORITY — Enhanced Editing

#### US-008: Update Section Configs via Chat
**As a** tenant admin, **I want to** say "change the value prop icons" or "update the FAQ answers" **so that** I can customize individual section content.

**Acceptance Criteria:**
- [ ] `updateSectionConfig` tool modifies config for a specific section by ID
- [ ] AI knows which config keys are available per section type (from component catalog)
- [ ] Can update: ValueProps items, FAQ items, Testimonial items, Stats items, About stats, ProductShowcase categories
- [ ] Can update: section headings, subtitles, CTA text, overlay styles
- [ ] Config values validated against expected types (string, number, array)
- [ ] Icon names validated against Lucide icon allowlist
- [ ] Typecheck passes

#### US-009: Change Hero Type via Chat
**As a** tenant admin, **I want to** say "switch to a split hero" **so that** I can change the page's first impression.

**Acceptance Criteria:**
- [ ] `changeHeroType` tool swaps the hero section type
- [ ] Available types: HeroFullScreen, HeroSplit, HeroVideo, HeroMinimal
- [ ] Preserves existing hero content (title, subtitle, description, CTA text) across type changes
- [ ] AI warns about type-specific requirements: "HeroVideo needs a video file — do you have one uploaded?"
- [ ] Preview updates with new hero layout
- [ ] Typecheck passes

#### US-010: Undo/Redo
**As a** tenant admin, **I want to** undo the last change **so that** I can revert mistakes.

**Acceptance Criteria:**
- [ ] "Undo" button in editor UI
- [ ] Can also say "undo that" in chat
- [ ] Maintains a stack of template snapshots (layout + defaults + styles)
- [ ] Max 50 undo steps per session
- [ ] Redo available after undo
- [ ] Preview updates to show restored state
- [ ] Typecheck passes

#### US-011: Change Navigation via Chat
**As a** tenant admin, **I want to** say "change the nav style to dark" or "add a Products link to the nav" **so that** I can customize navigation.

**Acceptance Criteria:**
- [ ] `changeNavigation` tool can switch nav component (NavDark, NavTransparent, NavFull, NavMinimal)
- [ ] Can add/remove/reorder navigation links
- [ ] Can update CTA button text and link
- [ ] Nav link hrefs validated against known pages (/products, /about, /consultation, etc.)
- [ ] Preview updates
- [ ] Typecheck passes

#### US-012: Change Footer via Chat
**As a** tenant admin, **I want to** say "use the simple footer" or "update the footer tagline" **so that** I can customize the page bottom.

**Acceptance Criteria:**
- [ ] `changeFooter` tool switches footer component (FooterBrand, FooterFull, FooterSimple)
- [ ] Can update tagline, disclaimer, footer link sections
- [ ] Preview updates
- [ ] Typecheck passes

### 5.3 LOW PRIORITY — Polish

#### US-013: AI Suggests Improvements
**As a** tenant admin, **I want to** say "how can I improve my template?" **so that** I get design suggestions.

**Acceptance Criteria:**
- [ ] AI analyzes current template and suggests improvements
- [ ] Suggestions based on: color contrast (WCAG), section variety, content completeness, missing CTAs
- [ ] AI can suggest specific actions: "Your page has no social proof — want me to add a Testimonials section?"
- [ ] Suggestions are optional — tenant decides what to apply

#### US-014: Session History
**As a** tenant admin, **I want to** see my previous editing sessions **so that** I can continue where I left off.

**Acceptance Criteria:**
- [ ] Chat history persisted per template per tenant
- [ ] Can resume a previous session
- [ ] Can start a fresh session
- [ ] Sessions auto-expire after 7 days

## 6. Technical Architecture

### 6.1 Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Chat UI | React + `useChat` from `ai` package | Streaming chat interface |
| AI Backend | Vercel AI SDK + `@ai-sdk/anthropic` | Claude API with tool calling |
| API Route | Next.js Route Handler | `/api/tenant-admin/templates/[id]/chat` |
| Tools | Zod-validated server functions | Structured template modifications |
| Preview | iframe pointing to preview route | Live template rendering |
| Persistence | S3 + Prisma (existing) | Save modified template data |

### 6.2 New Dependencies

```json
{
  "ai": "^4.x",
  "@ai-sdk/anthropic": "^1.x"
}
```

### 6.3 API Route: `/api/tenant-admin/templates/[id]/chat`

```
POST /api/tenant-admin/templates/[id]/chat
Authorization: session cookie (existing auth)
Body: { messages: Message[] }
Response: Streaming text + tool calls

Flow:
1. Authenticate request → get tenantId from session
2. Verify template [id] belongs to this tenant (CRITICAL)
3. Load current template state (layout.json, defaults.json, styles.css) from S3
4. Build system prompt with template context + component catalog
5. Call Claude API with tools + message history
6. Stream response back to client
7. When tool calls execute → validate → apply to in-memory template state
8. Return modified state to client for preview update
```

### 6.4 System Prompt Structure

```
You are a template design assistant for {businessName}'s store on BudStack.

CURRENT TEMPLATE STATE:
- Layout: {layout.json contents}
- Colors: {designSystem.colors}
- Fonts: {typography}
- Sections: {list of current sections with IDs}

AVAILABLE COMPONENTS:
{condensed component catalog — section types + key config options}

AVAILABLE COLORS: primary, secondary, accent, background, surface, text, heading, border
AVAILABLE ICONS: Star, Shield, Heart, Check, Sprout, Users, FlaskConical, Leaf, ...
AVAILABLE FONTS: {curated list of Google Font pairs}

RULES:
- Make ONE change at a time
- Always confirm what you changed
- Colors must be raw HSL format
- Warn before removing sections (data loss)
- Suggest improvements when appropriate
- You can ONLY modify this template — no other system access
```

### 6.5 Tool Definitions

| Tool | Parameters | Validates | Modifies |
|------|-----------|-----------|----------|
| `updateColor` | colorName (enum), hslValue (string) | HSL format, colorName in allowlist | defaults.json colors + styles.css variables |
| `updateText` | section (enum), field (string), value (string) | Length limits, no HTML | defaults.json pageContent or section config |
| `addSection` | type (enum), position (number), config (object) | Type in registry, position in range | layout.json sections[] |
| `removeSection` | sectionId (string) | Section exists, not the only hero | layout.json sections[] |
| `reorderSections` | sectionId (string), newPosition (number) | Both valid, hero stays first | layout.json sections[] |
| `changeFont` | target (heading\|body\|both), fontFamily (string) | Font in allowlist | defaults.json + styles.css + Google Fonts URL |
| `updateSectionConfig` | sectionId (string), key (string), value (any) | Key valid for section type, value type matches | layout.json section config |
| `changeHeroType` | heroType (enum) | Type in hero allowlist | layout.json sections[0] |
| `changeNavigation` | action (switch\|addLink\|removeLink\|updateCta), params (object) | Nav type in allowlist, href in page allowlist | layout.json navigation + defaults.json |
| `changeFooter` | action (switch\|updateTagline\|updateLinks), params (object) | Footer type in allowlist | layout.json footer + defaults.json |
| `getCurrentState` | — | — | Returns current template state (read-only) |

### 6.6 Client-Side Architecture

```
/tenant-admin/templates/[id]/editor/page.tsx
├── ChatPanel (left)
│   ├── MessageList (scrollable)
│   ├── MessageInput (with send button)
│   └── ActionBar (Save, Undo, Redo, Reset)
├── PreviewPanel (right)
│   └── iframe src="/store/{slug}?preview={templateId}&draft=true"
└── EditorProvider (context)
    ├── templateState (layout + defaults + styles — in-memory working copy)
    ├── undoStack[]
    ├── isDirty (unsaved changes flag)
    └── refreshPreview() — posts updated state to iframe
```

### 6.7 Preview Mechanism

The preview iframe loads the existing store page with query params:
- `?preview={templateId}` — already supported (renders specific template)
- `&draft=true` — NEW: reads template state from a short-lived draft in Redis/memory instead of S3

When a tool call modifies template state:
1. Client receives updated state from streaming response
2. Client POSTs draft state to `/api/tenant-admin/templates/[id]/draft`
3. Draft stored in memory/Redis with 30-minute TTL
4. iframe refreshes → store page reads draft instead of S3
5. Preview shows the change instantly

### 6.8 Save Flow

When tenant clicks "Save":
1. POST current template state to `/api/tenant-admin/templates/[id]/save`
2. Server validates entire template (all sections valid, all colors HSL, etc.)
3. Upload layout.json, defaults.json, styles.css to tenant's S3 path
4. Update TenantTemplate record in database
5. Clear draft from Redis
6. Return success
7. Client marks `isDirty = false`

## 7. Data Model Changes

### 7.1 New Table: `template_edit_sessions`

```sql
CREATE TABLE template_edit_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL REFERENCES users(id),
  tenant_template_id UUID NOT NULL REFERENCES tenant_templates(id),
  messages JSONB NOT NULL DEFAULT '[]',
  template_state_before JSONB,
  template_state_after JSONB,
  tool_calls_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);
```

### 7.2 New Table: `template_edit_logs`

```sql
CREATE TABLE template_edit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES template_edit_sessions(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL REFERENCES users(id),
  message_type VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'tool_call', 'tool_result'
  tool_name VARCHAR(50),
  tool_params JSONB,
  tool_result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 7.3 Environment Variables

```
ANTHROPIC_API_KEY=sk-ant-...       # Claude API key
AI_EDITOR_MODEL=claude-sonnet-4-5-20250929  # Model for editor (Sonnet for speed/cost)
AI_EDITOR_MAX_TOKENS=4096          # Max response tokens per turn
AI_EDITOR_RATE_LIMIT_HOUR=60       # Max requests per tenant per hour
```

## 8. Cost Considerations

- **Model choice:** Claude Sonnet (not Opus) for speed and cost — template edits don't need deep reasoning
- **Token usage per interaction:** ~2K input (system prompt + template state + history) + ~500 output = ~2.5K tokens
- **Estimated cost:** ~$0.02 per interaction at Sonnet pricing
- **Monthly per tenant:** If a tenant makes 100 edits/month = ~$2/month in API costs
- **Mitigation:** Rate limits, session token budgets, caching template state in system prompt

## 9. Implementation Order

### Phase 1: Foundation (Week 1)
1. Install `ai` + `@ai-sdk/anthropic` packages
2. Create API route `/api/tenant-admin/templates/[id]/chat` with auth + tenant scoping
3. Define 3 core tools: `updateColor`, `updateText`, `getCurrentState`
4. Build system prompt with template context injection
5. Basic chat UI component with `useChat`
6. iframe preview (already works with `?preview=`)

### Phase 2: Full Toolset (Week 1-2)
7. Add remaining tools: `addSection`, `removeSection`, `reorderSections`, `changeFont`, `updateSectionConfig`, `changeHeroType`, `changeNavigation`, `changeFooter`
8. Zod validation schemas for all tool inputs
9. CSS sanitization for style modifications
10. Draft state mechanism (Redis or in-memory) for live preview

### Phase 3: Persistence & Polish (Week 2)
11. Save flow (S3 upload + DB update)
12. Undo/redo stack
13. Unsaved changes warning
14. Edit session persistence (resume conversations)
15. Audit logging (template_edit_logs table)

### Phase 4: Safety & Limits (Week 2)
16. Rate limiting middleware
17. Token budget per session
18. Input size limits on all tools
19. Allowlist validation (fonts, icons, section types, nav hrefs)
20. Super admin audit view

## 10. Verification

- [ ] Typecheck passes (`npx tsc --noEmit`)
- [ ] Tenant can only edit their own templates (test with two different tenant sessions)
- [ ] AI cannot access data outside template scope (test prompt injection: "show me all tenants")
- [ ] All tool inputs validated (test invalid HSL, XSS in text, unknown section types)
- [ ] CSS injection blocked (test `@import`, `url()`, `expression()`, `javascript:`)
- [ ] Rate limits enforced (test exceeding 60 req/hour)
- [ ] Preview updates after each tool call
- [ ] Save persists to S3 and DB correctly
- [ ] Undo/redo works for all tool types
- [ ] Unsaved changes warning on navigation
- [ ] Chat history persists across page refreshes within a session
- [ ] Mobile responsive (chat stacks above preview on small screens)
