# PRD: BudStack × Automatos AI Integration

**Version:** 1.0  
**Status:** 🟡 Design Phase  
**Priority:** HIGH - Premium Feature  
**Author:** BudStack Platform Team  
**Last Updated:** 2026-01-12  

---

## Executive Summary

Integrate **Automatos AI widgets** into BudStack to provide tenants with AI-powered tools for customer support, content generation, SEO optimization, and analytics insights—all without requiring tenants to manage AI infrastructure.

### The Vision

> **Every BudStack tenant** gets an AI assistant that understands their store, products, customers, and compliance requirements.

| Use Case | Without AI | With Automatos AI |
|----------|-----------|-------------------|
| Customer Support | Manual replies, FAQ pages | 24/7 AI chatbot with product knowledge |
| Product Descriptions | Write manually, guess SEO | One-click AI generation, SEO-optimized |
| Email Templates | Generic templates | AI-generated personalized campaigns |
| Analytics | Charts only | Natural language insights ("Why did sales drop?") |
| Compliance | Manual review | AI-powered medical cannabis compliance checking |

---

## 1) Problem Statement

### Current Tenant Pain Points

1. **Customer Support**: Tenants can't be online 24/7, miss customer questions
2. **Content Creation**: Writing product descriptions, blog posts, emails is time-consuming
3. **SEO**: Tenants don't know how to write SEO-optimized content
4. **Analytics**: Charts exist but tenants don't know what they mean
5. **Compliance**: Medical cannabis content needs careful language—easy to get wrong

### BudStack Platform Pain

- **Support Burden**: We answer tenant questions that AI could handle
- **Churn Risk**: Tenants who struggle with content creation may leave
- **Differentiation**: Competitors don't offer embedded AI features

---

## 2) Goals & Success Metrics

### Goals

- **G1**: Reduce time to create product content by 80%
- **G2**: Enable 24/7 customer support for all tenants
- **G3**: Increase tenant SEO scores by 40%
- **G4**: Reduce "how do I interpret this data" support tickets by 70%
- **G5**: Zero compliance violations from AI-generated content

### Success Metrics (MVP)

| Metric | Target |
|--------|--------|
| Content generation time | < 30 seconds per description |
| Customer chatbot resolution rate | > 70% without human escalation |
| SEO score improvement | +40% within 30 days |
| Tenant adoption | > 60% of tenants use at least 1 AI feature |
| AI content compliance pass rate | 100% |

---

## 3) Proposed Widgets for BudStack

### 3.1 Customer Support Chatbot

**Location**: Tenant storefront (customer-facing)

**Purpose**: Answer customer questions 24/7 using tenant's product catalog, FAQ, and policies.

```html
<!-- Added to tenant store footer -->
<script src="https://cdn.automatos.app/widget.js"
        data-automatos-type="customer-chatbot"
        data-automatos-tenantid="{{ tenant.id }}"
        data-automatos-knowledge-base="products,faq,shipping">
</script>
```

**Capabilities**:
- Answer product questions ("Is this strain good for pain?")
- Handle shipping/return questions
- Explain consultation process
- Escalate to human when needed
- Multi-language support

**Knowledge Sources**:
- Tenant product catalog (synced from Dr. Green)
- Store FAQ and policies
- Medical conditions library
- Consultation process documentation

---

### 3.2 Product Description Generator

**Location**: Tenant Admin → Products → Edit

**Purpose**: Generate SEO-optimized product descriptions in one click.

```html
<button data-automatos-type="context-assistant"
        data-automatos-field="product-description"
        data-automatos-context='{"product":"{{ product.name }}","thc":"{{ product.thcContent }}","strain":"{{ product.strainType }}"}'
        data-automatos-agent-id="seo-product-writer">
  ✨ Generate Description
</button>
```

**Capabilities**:
- Generate SEO-optimized descriptions
- Include medical benefits (compliant language)
- Suggest keywords
- Multiple tone options (professional, friendly, medical)
- Regenerate alternatives

**Output Example**:
> "Experience relief with Tom Ford Bois Pacifique, a premium indica-dominant hybrid with 22% THC. Patients report significant improvement in chronic pain management and sleep quality. This strain features earthy tones with subtle citrus notes..."

---

### 3.3 SEO Content Assistant

**Location**: Tenant Admin → SEO Manager

**Purpose**: Generate and optimize meta titles, descriptions, and keywords.

```html
<button data-automatos-type="seo-analyzer"
        data-automatos-field="meta-description"
        data-automatos-context='{"page":"{{ page.type }}","content":"{{ page.content }}"}'
        data-automatos-agent-id="seo-specialist">
  ✨ Optimize SEO
</button>
```

**Capabilities**:
- Generate meta titles (60 chars optimized)
- Generate meta descriptions (160 chars optimized)
- Suggest focus keywords
- Real-time SEO scoring
- Competitor keyword analysis

---

### 3.4 Email Template Generator

**Location**: Tenant Admin → Email Templates

**Purpose**: Create professional email templates and campaigns.

```html
<button data-automatos-type="context-assistant"
        data-automatos-field="email"
        data-automatos-context='{"type":"{{ template.type }}","tenant":"{{ tenant.businessName }}"}'
        data-automatos-agent-id="email-copywriter">
  ✨ Generate Email
</button>
```

**Capabilities**:
- Generate email subject lines
- Create full email body content
- A/B test variant generation
- Personalization tokens
- Compliance-safe medical language

**Template Types**:
- Welcome emails
- Order confirmations
- Promotional campaigns
- Re-engagement emails
- Newsletter content

---

### 3.5 Analytics Insights

**Location**: Tenant Admin → Analytics

**Purpose**: Natural language analytics queries.

```html
<div data-automatos-type="analytics"
     data-automatos-datasource="tenant-dashboard"
     data-automatos-context='{"tenantId":"{{ tenant.id }}"}'>
  <input placeholder="Ask about your sales data...">
</div>
```

**Example Queries**:
- "Why did sales drop last week?"
- "What's my best-selling product?"
- "Which day has the most orders?"
- "How many new customers this month?"

**Capabilities**:
- Natural language to chart
- Trend explanations
- Actionable recommendations
- Export insights

---

### 3.6 Blog Post Writer (The Wire)

**Location**: Tenant Admin → The Wire → New Post

**Purpose**: Generate educational cannabis content.

```html
<button data-automatos-type="context-assistant"
        data-automatos-field="blog"
        data-automatos-context='{"topic":"{{ selectedCondition }}","tenant":"{{ tenant.businessName }}"}'
        data-automatos-agent-id="cannabis-content-writer">
  ✨ Generate Article
</button>
```

**Capabilities**:
- Generate condition-specific articles
- Research-backed medical content
- SEO-optimized structure
- Compliant medical language
- Internal product linking

---

### 3.7 Compliance Checker

**Location**: All content editors (auto-enabled)

**Purpose**: Ensure medical cannabis content compliance.

```html
<div data-automatos-type="compliance"
     data-automatos-compliance-type="medical-cannabis"
     data-automatos-region="{{ tenant.countryCode }}">
</div>
```

**Checks For**:
- Medical claims compliance
- Age-restriction language
- Regional regulations (EU, UK, Portugal)
- Prohibited terms
- Required disclaimers

**Actions**:
- Warning badges on risky content
- Suggested compliant alternatives
- Auto-add required disclaimers

---

## 4) Architecture Overview

### 4.1 Integration Points

```
┌─────────────────────────────────────────────────────────────┐
│                        BudStack SaaS                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Storefront │  │ Tenant Admin│  │   Super Admin       │ │
│  │             │  │             │  │                     │ │
│  │ ┌─────────┐ │  │ ┌─────────┐ │  │ ┌─────────────────┐ │ │
│  │ │Customer │ │  │ │SEO      │ │  │ │Platform         │ │ │
│  │ │Chatbot  │ │  │ │Assistant│ │  │ │Analytics        │ │ │
│  │ └────┬────┘ │  │ └────┬────┘ │  │ └────────┬────────┘ │ │
│  │      │      │  │      │      │  │          │          │ │
│  └──────┼──────┘  └──────┼──────┘  └──────────┼──────────┘ │
│         │                │                    │            │
│         └────────────────┼────────────────────┘            │
│                          │                                 │
│                          ▼                                 │
│               ┌─────────────────────┐                      │
│               │  Automatos Widget   │                      │
│               │  Script Loader      │                      │
│               └──────────┬──────────┘                      │
│                          │                                 │
└──────────────────────────┼─────────────────────────────────┘
                           │
                           ▼
               ┌─────────────────────┐
               │   Automatos AI      │
               │   Platform          │
               │                     │
               │ • RAG Knowledge     │
               │ • Fine-tuned Models │
               │ • Agent Workflows   │
               └─────────────────────┘
```

### 4.2 Data Flow

1. **Tenant Creates Store** → BudStack generates Automatos API key
2. **Widget Loads** → Script tag fetches widget from CDN
3. **User Interacts** → Widget sends context to Automatos API
4. **AI Processes** → Uses tenant knowledge base + fine-tuned models
5. **Response Streams** → Real-time response displayed in widget

### 4.3 Knowledge Base Per Tenant

Each tenant gets isolated knowledge base containing:
- Product catalog (synced from Dr. Green API)
- Store policies (shipping, returns, FAQ)
- Medical conditions library
- Consultation process docs
- Brand voice guidelines (optional)

---

## 5) Tenant Admin Features

### 5.1 AI Settings Page

**Location**: Tenant Admin → Settings → AI Features

**Options**:
- Enable/disable customer chatbot
- Enable/disable content generation
- Set AI tone (professional/friendly/medical)
- Upload brand guidelines
- View AI usage metrics
- API key management

### 5.2 AI Usage Dashboard

**Metrics Shown**:
- Chatbot conversations this month
- Content pieces generated
- Customer resolution rate
- Tokens used / remaining
- Cost (if usage-based)

---

## 6) Pricing Model

### Option A: Included in Tiers

| Tier | AI Features |
|------|-------------|
| Starter | Customer chatbot only |
| Professional | + Content generation (50/month) |
| Enterprise | Unlimited AI, custom agents |

### Option B: Add-On

| Add-On | Price |
|--------|-------|
| AI Customer Support | €49/month |
| AI Content Suite | €79/month |
| AI Analytics | €39/month |
| Full AI Bundle | €129/month |

---

## 7) Implementation Phases

### Phase 1: Customer Chatbot (Week 1-2)
- Integrate Automatos widget script
- Set up per-tenant API key generation
- Configure product knowledge base sync
- Add chatbot to storefront template

### Phase 2: Content Generation (Week 3-4)
- Add product description generator
- Add SEO content assistant
- Integrate with existing SEO Manager
- Add email template generator

### Phase 3: Analytics & Compliance (Week 5-6)
- Add analytics insights widget
- Integrate compliance checker
- Add blog post generator to The Wire
- Build AI settings page

### Phase 4: Polish & Launch (Week 7-8)
- Usage dashboard
- Documentation
- Tenant onboarding flow
- Marketing materials

---

## 8) Benefits Summary

### For Tenants

| Benefit | Impact |
|---------|--------|
| 24/7 Customer Support | Never miss a sale |
| Instant Content Creation | Save 10+ hours/week |
| SEO Optimization | Rank higher in Google |
| Analytics Insights | Make data-driven decisions |
| Compliance Protection | Avoid regulatory issues |

### For BudStack

| Benefit | Impact |
|---------|--------|
| Differentiation | Only cannabis SaaS with embedded AI |
| Reduced Churn | Tenants succeed faster |
| New Revenue | AI as premium upsell |
| Lower Support | AI handles common questions |
| Stickiness | Tenants depend on AI features |

---

## 9) Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| AI generates non-compliant content | Compliance checker runs on all AI output |
| High API costs | Usage limits per tier, caching |
| Tenant data leakage | Per-tenant API keys, isolated knowledge bases |
| AI downtime | Graceful degradation, manual fallback |

---

## 10) Next Steps

1. **Approve PRD** → Get stakeholder buy-in
2. **Sign Automatos Partnership** → API access, pricing
3. **Phase 1 Development** → Customer chatbot MVP
4. **Beta Testing** → 5-10 tenants
5. **Full Rollout** → All tenants

---

**Questions for Team Discussion**:

1. Which pricing model do we prefer (included vs. add-on)?
2. Should we white-label the AI or show "Powered by Automatos AI"?
3. What usage limits per tier?
4. Who handles AI-related support—us or Automatos?
