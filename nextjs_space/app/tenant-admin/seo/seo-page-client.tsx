"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AiCrawlersTab,
  LlmsTxtCard,
  RedirectsTab,
  SeoAuditTab,
  SeoEditorModal,
  SeoProUpsell,
  VerificationTab,
  type RedirectRow,
  type VerificationValues,
} from "@/components/admin/seo";
import type { AiCrawlerPolicy } from "@/lib/seo/ai-crawlers";
import type { SeoAuditTarget } from "@/lib/seo/audit-types";
import { conditionPath } from "@/lib/seo/condition-paths";
import {
  isEmptyEntitySeo,
  readEntitySeo,
  type EntitySeo,
} from "@/lib/seo/entity-seo";
import { LLMS_TXT_PATH } from "@/lib/seo/llms-txt-copy";
import { productPath } from "@/lib/seo/product-paths";
import {
  STORE_SEO_PAGES,
  dropLegacyStorePageSeoKeys,
  readStorePageSeo,
  type StoreSeoPage,
} from "@/lib/seo/store-pages";
import {
  Package,
  FileText,
  Home,
  HeartPulse,
  Search,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Signpost,
  Gauge,
  BadgeCheck,
  Bot,
} from "lucide-react";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

/**
 * The authored record for one entity — the same shape the storefront parses, so
 * a field added there (US-009's `imageAlt`, US-022's indexing keys) reaches this
 * editor without a second definition to keep in step.
 */
type SeoData = EntitySeo;

interface ProductItem {
  id: string;
  name: string;
  slug: string;
  /**
   * The Dr Green strain id — what the storefront product route is keyed by, and
   * so what the preview URL must use. Null for a row that has never been synced,
   * which has no product page at all (see `productPath`).
   */
  drGreenStrainId: string | null;
  seo: SeoData | null;
  images: string[];
}

interface PostItem {
  id: string;
  title: string;
  slug: string;
  seo: SeoData | null;
  coverImage: string | null;
}

interface ConditionItem {
  id: string;
  name: string;
  /** The storefront route key — condition pages are slug-keyed, not id-keyed. */
  slug: string;
  seo: SeoData | null;
  image: string | null;
}

interface SeoPageClientProps {
  tenantId: string;
  baseUrl: string;
  products: ProductItem[];
  posts: PostItem[];
  conditions: ConditionItem[];
  pageSeo: Record<string, SeoData> | null;
  /**
   * US-020 — the store's 301s. Loaded for every plan (a downgraded tenant keeps
   * their rules, dormant) but only rendered when `seoProUnlocked`.
   */
  redirects: RedirectRow[];
  /**
   * US-013 — resolved server-side in page.tsx from the `tenants.plan` column.
   * False for plan 'basic' only; trial, pro and custom all hold `seo.pro`.
   * Presentation only: the server gate on each Pro route is the boundary.
   */
  seoProUnlocked: boolean;
  /**
   * US-025 — whether this tenant has Automatos credentials stored, resolved
   * server-side in page.tsx. A boolean, never the credential. Decides whether
   * the editors offer a Generate button or the connect card; the route re-checks
   * either way.
   */
  aiAssistConnected: boolean;
  /**
   * US-026 — the store's Search Console / Bing / GA4 values, read and re-checked
   * server-side in page.tsx. Three strings, never the settings blob they came
   * out of.
   */
  verification: VerificationValues;
  /**
   * LLM Visibility US-001 — the store's AI crawler policy, resolved server-side
   * through `parseAiCrawlerPolicy`, so an absent or unreadable stored value
   * arrives here as 'open' (maximum visibility) rather than as undefined.
   */
  aiCrawlerPolicy: AiCrawlerPolicy;
  /** `settings.analyticsEnabled` — whether the GA4 tag is allowed to load. */
  analyticsCookiesEnabled: boolean;
}

export function SeoPageClient({
  tenantId,
  baseUrl,
  products,
  posts,
  conditions,
  pageSeo,
  redirects,
  seoProUnlocked,
  aiAssistConnected,
  verification,
  aiCrawlerPolicy,
  analyticsCookiesEnabled,
}: SeoPageClientProps) {
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(
    null,
  );
  const [selectedPost, setSelectedPost] = useState<PostItem | null>(null);
  const [selectedCondition, setSelectedCondition] =
    useState<ConditionItem | null>(null);
  const [selectedPage, setSelectedPage] = useState<StoreSeoPage | null>(null);
  const [localPageSeo, setLocalPageSeo] = useState<Record<string, SeoData>>(
    pageSeo || {},
  );
  const [localProducts, setLocalProducts] = useState(products);
  const [localPosts, setLocalPosts] = useState(posts);
  const [localConditions, setLocalConditions] = useState(conditions);
  /**
   * US-023 made the tabs CONTROLLED. An audit finding's Fix button has to move
   * the panel to another tab and open an editor there, which an uncontrolled
   * `defaultValue` cannot express.
   */
  const [activeTab, setActiveTab] = useState("products");

  // The same emptiness rule the write routes and the storefront apply, so the
  // badge cannot say "Default" for an entity whose only authored field is one
  // this list does not enumerate (US-022's indexing controls, most recently).
  const hasSeo = (seo: SeoData | null | undefined): boolean =>
    !isEmptyEntitySeo(readEntitySeo(seo));

  /**
   * The record the server says it stored, falling back to what was submitted.
   *
   * US-022 made the two able to differ: a save that omits the indexing controls
   * (every Basic save) preserves whatever is already stored, so echoing the
   * SUBMITTED record back into this list would show a downgraded tenant their
   * dormant rules as deleted — the one thing the write path exists not to do.
   */
  const savedSeo = async (res: Response, submitted: SeoData): Promise<SeoData> => {
    const body: { seo?: SeoData } | null = await res.json().catch(() => null);
    return body?.seo ?? submitted;
  };

  const handleSaveProductSeo = async (seo: SeoData) => {
    if (!selectedProduct) return;

    const res = await fetch(
      `/api/tenant-admin/seo/products/${selectedProduct.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(seo),
      },
    );

    if (!res.ok) throw new Error("Failed to save");
    const stored = await savedSeo(res, seo);

    setLocalProducts((prev) =>
      prev.map((p) =>
        p.id === selectedProduct.id ? { ...p, seo: stored } : p,
      ),
    );
  };

  const handleSavePostSeo = async (seo: SeoData) => {
    if (!selectedPost) return;

    const res = await fetch(`/api/tenant-admin/seo/posts/${selectedPost.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(seo),
    });

    if (!res.ok) throw new Error("Failed to save");
    const stored = await savedSeo(res, seo);

    setLocalPosts((prev) =>
      prev.map((p) => (p.id === selectedPost.id ? { ...p, seo: stored } : p)),
    );
  };

  const handleSaveConditionSeo = async (seo: SeoData) => {
    if (!selectedCondition) return;

    const res = await fetch(
      `/api/tenant-admin/seo/conditions/${selectedCondition.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(seo),
      },
    );

    if (!res.ok) throw new Error("Failed to save");
    const stored = await savedSeo(res, seo);

    setLocalConditions((prev) =>
      prev.map((c) =>
        c.id === selectedCondition.id ? { ...c, seo: stored } : c,
      ),
    );
  };

  const handleSavePageSeo = async (seo: SeoData) => {
    if (!selectedPage) return;

    const res = await fetch("/api/tenant-admin/seo/pages", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageKey: selectedPage.key, seo }),
    });

    if (!res.ok) throw new Error("Failed to save");

    // This route returns the WHOLE recomputed blob, so the list is set from it
    // rather than mirrored. The optimistic merge below (legacy-key retirement
    // included, so the badge cannot claim "Custom" from an entry the server just
    // dropped) is the fallback for a response that did not parse.
    const body: { pageSeo?: Record<string, SeoData> } | null = await res
      .json()
      .catch(() => null);

    setLocalPageSeo((prev) =>
      body?.pageSeo ?? {
        ...dropLegacyStorePageSeoKeys(prev, selectedPage.key),
        [selectedPage.key]: seo,
      },
    );
  };

  /**
   * US-023 — the deep link on an audit finding: move to the tab that owns the
   * entity, and open its editor.
   *
   * The row is looked up in the LOCAL lists, which already carry every save made
   * in this session, so fixing one finding and returning for the next never
   * reopens an editor on stale data. A finding whose row is no longer here — the
   * audit's cached result describing a store that has since changed — still
   * switches the tab: landing on the right list beats a button that does
   * nothing. "redirects" has no per-row editor; the tab itself is the fix.
   */
  const handleAuditFix = (target: SeoAuditTarget) => {
    setActiveTab(target.tab);
    if (!target.entityId) return;

    if (target.tab === "products") {
      const product = localProducts.find((p) => p.id === target.entityId);
      if (product) setSelectedProduct(product);
    } else if (target.tab === "posts") {
      const post = localPosts.find((p) => p.id === target.entityId);
      if (post) setSelectedPost(post);
    } else if (target.tab === "conditions") {
      const condition = localConditions.find((c) => c.id === target.entityId);
      if (condition) setSelectedCondition(condition);
    } else if (target.tab === "pages") {
      const page = STORE_SEO_PAGES.find((p) => p.key === target.entityId);
      if (page) setSelectedPage(page);
    }
  };

  const SeoStatusBadge = ({ hasCustomSeo }: { hasCustomSeo: boolean }) => (
    <span className={hasCustomSeo ? "bs-chip bs-chip-green inline-flex items-center gap-1" : "bs-chip bs-chip-muted inline-flex items-center gap-1"}>
      {hasCustomSeo ? (
        <>
          <CheckCircle className="h-3 w-3" aria-hidden="true" />
          Custom
        </>
      ) : (
        <>
          <AlertCircle className="h-3 w-3" aria-hidden="true" />
          Default
        </>
      )}
    </span>
  );

  return (
    <>
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        {/*
          Four shared tabs, then the plan decides: an entitled tenant gets
          Redirects and Audit, everyone else gets the single upsell tab. Both
          arms stay explicit so the next C story that adds a tab has to decide
          which arm it belongs in.
        */}
        <TabsList
          className={`grid w-full grid-cols-2 ${seoProUnlocked ? "sm:grid-cols-8" : "sm:grid-cols-5"} lg:w-auto lg:inline-grid`}
        >
          <TabsTrigger value="products" className="gap-2">
            <Package className="h-4 w-4 hidden sm:block" aria-hidden="true" />
            Products ({localProducts.length})
          </TabsTrigger>
          <TabsTrigger value="posts" className="gap-2">
            <FileText className="h-4 w-4 hidden sm:block" aria-hidden="true" />
            Posts ({localPosts.length})
          </TabsTrigger>
          <TabsTrigger value="conditions" className="gap-2">
            <HeartPulse className="h-4 w-4 hidden sm:block" aria-hidden="true" />
            Conditions ({localConditions.length})
          </TabsTrigger>
          <TabsTrigger value="pages" className="gap-2">
            <Home className="h-4 w-4 hidden sm:block" aria-hidden="true" />
            Static Pages
          </TabsTrigger>
          {/*
            US-020 — the first Workstream C story with an admin surface of its
            own. Pro only: a Basic tenant still meets it as a locked card in the
            Pro tab below, which is where the upsell belongs.
          */}
          {seoProUnlocked && (
            <TabsTrigger value="redirects" className="gap-2">
              <Signpost className="h-4 w-4 hidden sm:block" aria-hidden="true" />
              Redirects ({redirects.length})
            </TabsTrigger>
          )}
          {/*
            US-026 — the store's identity to Google, Bing and GA4. Pro only, and
            configuration rather than authoring, so it sits after the four
            content tabs and before the audit.
          */}
          {seoProUnlocked && (
            <TabsTrigger value="verification" className="gap-2">
              <BadgeCheck className="h-4 w-4 hidden sm:block" aria-hidden="true" />
              Verification
            </TabsTrigger>
          )}
          {/*
            LLM Visibility US-001 — which AI bots may read the store. Pro only,
            configuration rather than authoring, so it sits with Verification
            rather than among the four content tabs.
          */}
          {seoProUnlocked && (
            <TabsTrigger value="ai-crawlers" className="gap-2">
              <Bot className="h-4 w-4 hidden sm:block" aria-hidden="true" />
              AI Crawlers
            </TabsTrigger>
          )}
          {/*
            US-023 — the audit. Pro only, and last: it is the tab that sends an
            owner to all the others.
          */}
          {seoProUnlocked && (
            <TabsTrigger value="audit" className="gap-2">
              <Gauge className="h-4 w-4 hidden sm:block" aria-hidden="true" />
              Audit
            </TabsTrigger>
          )}
          {/*
            US-013 — the upsell tab exists ONLY while `seo.pro` is missing. An
            entitled tenant (trial, pro, custom) must never see a tab selling
            them what they already have; as Workstream C lands, its sections
            take this slot for everyone and the locked cards shrink to whatever
            is still unbuilt.
          */}
          {!seoProUnlocked && (
            <TabsTrigger value="pro" className="gap-2">
              <Sparkles className="h-4 w-4 hidden sm:block" aria-hidden="true" />
              Pro
            </TabsTrigger>
          )}
        </TabsList>

        {/* Products Tab */}
        <TabsContent value="products">
          <section className="bs-card bs-card-pad space-y-4">
            <div>
              <h3 className="text-[22px] leading-tight" style={sectionTitleStyle}>
                Product SEO
              </h3>
              <p className="text-sm text-bs-fg-muted">
                Customize titles and descriptions for your products in search results.
              </p>
            </div>
            {localProducts.length === 0 ? (
              <p className="text-sm text-bs-fg-muted text-center py-8">
                No products found. Sync products from Dr Green first.
              </p>
            ) : (
              <div className="divide-y divide-bs-border-100">
                {localProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                      {product.images[0] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-10 h-10 rounded object-cover flex-shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-bs-fg truncate">
                          {product.name}
                        </p>
                        <p className="text-xs text-bs-fg-muted truncate font-mono">
                          {baseUrl}
                          {productPath(product.drGreenStrainId)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-2 flex-shrink-0 w-full sm:w-auto pl-14 sm:pl-0">
                      <SeoStatusBadge hasCustomSeo={hasSeo(product.seo)} />
                      <button
                        type="button"
                        className="bs-btn bs-btn-ghost bs-btn-sm"
                        onClick={() => setSelectedProduct(product)}
                      >
                        <Search className="h-4 w-4 mr-1" aria-hidden="true" />
                        Edit SEO
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </TabsContent>

        {/* Posts Tab */}
        <TabsContent value="posts">
          <section className="bs-card bs-card-pad space-y-4">
            <div>
              <h3 className="text-[22px] leading-tight" style={sectionTitleStyle}>
                Blog Post SEO
              </h3>
              <p className="text-sm text-bs-fg-muted">
                Optimize your blog posts for search engines.
              </p>
            </div>
            {localPosts.length === 0 ? (
              <p className="text-sm text-bs-fg-muted text-center py-8">
                No blog posts yet. Create posts in The Wire section.
              </p>
            ) : (
              <div className="divide-y divide-bs-border-100">
                {localPosts.map((post) => (
                  <div
                    key={post.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                      {post.coverImage && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={post.coverImage}
                          alt={post.title}
                          className="w-10 h-10 rounded object-cover flex-shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-bs-fg truncate">
                          {post.title}
                        </p>
                        <p className="text-xs text-bs-fg-muted truncate font-mono">
                          {baseUrl}/the-wire/{post.slug}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-2 flex-shrink-0 w-full sm:w-auto pl-14 sm:pl-0">
                      <SeoStatusBadge hasCustomSeo={hasSeo(post.seo)} />
                      <button
                        type="button"
                        className="bs-btn bs-btn-ghost bs-btn-sm"
                        onClick={() => setSelectedPost(post)}
                      >
                        <Search className="h-4 w-4 mr-1" aria-hidden="true" />
                        Edit SEO
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </TabsContent>

        {/* Conditions Tab */}
        <TabsContent value="conditions">
          <section className="bs-card bs-card-pad space-y-4">
            <div>
              <h3 className="text-[22px] leading-tight" style={sectionTitleStyle}>
                Condition SEO
              </h3>
              <p className="text-sm text-bs-fg-muted">
                Condition pages are your content-marketing landing pages — the
                ones people find by searching a symptom.
              </p>
            </div>
            {localConditions.length === 0 ? (
              <p className="text-sm text-bs-fg-muted text-center py-8">
                No conditions yet. Conditions shared by the platform are managed
                centrally and cannot be edited here.
              </p>
            ) : (
              <div className="divide-y divide-bs-border-100">
                {localConditions.map((condition) => (
                  <div
                    key={condition.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                      {condition.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={condition.image}
                          alt={condition.name}
                          className="w-10 h-10 rounded object-cover flex-shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-bs-fg truncate">
                          {condition.name}
                        </p>
                        <p className="text-xs text-bs-fg-muted truncate font-mono">
                          {baseUrl}
                          {conditionPath(condition.slug)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-2 flex-shrink-0 w-full sm:w-auto pl-14 sm:pl-0">
                      <SeoStatusBadge hasCustomSeo={hasSeo(condition.seo)} />
                      <button
                        type="button"
                        className="bs-btn bs-btn-ghost bs-btn-sm"
                        onClick={() => setSelectedCondition(condition)}
                      >
                        <Search className="h-4 w-4 mr-1" aria-hidden="true" />
                        Edit SEO
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </TabsContent>

        {/* Static Pages Tab */}
        <TabsContent value="pages">
          <section className="bs-card bs-card-pad space-y-4">
            <div>
              <h3 className="text-[22px] leading-tight" style={sectionTitleStyle}>
                Static Page SEO
              </h3>
              <p className="text-sm text-bs-fg-muted">
                Set metadata for your store&apos;s main pages.
              </p>
            </div>
            <div className="divide-y divide-bs-border-100">
              {STORE_SEO_PAGES.map((page) => (
                <div
                  key={page.key}
                  className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-4"
                >
                  <div className="min-w-0 w-full sm:w-auto">
                    <p className="font-medium text-bs-fg">{page.name}</p>
                    <p className="text-xs text-bs-fg-muted truncate font-mono">
                      {baseUrl}
                      {page.path || "/"}
                    </p>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-2 flex-shrink-0 w-full sm:w-auto">
                    <SeoStatusBadge
                      hasCustomSeo={hasSeo(readStorePageSeo(localPageSeo, page.key))}
                    />
                    <button
                      type="button"
                      className="bs-btn bs-btn-ghost bs-btn-sm"
                      onClick={() => setSelectedPage(page)}
                    >
                      <Search className="h-4 w-4 mr-1" aria-hidden="true" />
                      Edit SEO
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </TabsContent>

        {/* Redirects Tab — Pro only (US-020) */}
        {seoProUnlocked && (
          <TabsContent value="redirects">
            <RedirectsTab baseUrl={baseUrl} initialRedirects={redirects} />
          </TabsContent>
        )}

        {/* Verification Tab — Pro only (US-026) */}
        {seoProUnlocked && (
          <TabsContent value="verification">
            <VerificationTab
              initialValues={verification}
              analyticsCookiesEnabled={analyticsCookiesEnabled}
            />
          </TabsContent>
        )}

        {/* AI Crawlers Tab — Pro only (LLM Visibility US-001, US-003) */}
        {seoProUnlocked && (
          <TabsContent value="ai-crawlers" className="space-y-6">
            <AiCrawlersTab
              initialPolicy={aiCrawlerPolicy}
              robotsUrl={`${baseUrl}/robots.txt`}
            />
            {/* US-003 — the other machine-readable file this store publishes.
                It sits here rather than in a tab of its own because there is
                nothing to configure: the card exists to say what the file is and
                what the evidence for it actually shows. */}
            <LlmsTxtCard llmsUrl={`${baseUrl}${LLMS_TXT_PATH}`} />
          </TabsContent>
        )}

        {/* Audit Tab — Pro only (US-023) */}
        {seoProUnlocked && (
          <TabsContent value="audit">
            <SeoAuditTab onFix={handleAuditFix} />
          </TabsContent>
        )}

        {/* Pro Tab — locked cards, Basic only */}
        {!seoProUnlocked && (
          <TabsContent value="pro">
            <SeoProUpsell />
          </TabsContent>
        )}
      </Tabs>

      {/* Product SEO Modal */}
      {selectedProduct && (
        <SeoEditorModal
          isOpen={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          entityType="product"
          entityId={selectedProduct.id}
          entityName={selectedProduct.name}
          entitySlug={selectedProduct.slug}
          previewUrl={`${baseUrl}${productPath(selectedProduct.drGreenStrainId)}`}
          initialSeo={selectedProduct.seo || undefined}
          onSave={handleSaveProductSeo}
          canUploadOgImage={seoProUnlocked}
          canEditIndexing={seoProUnlocked}
          canUseAiAssist={seoProUnlocked}
          // LLM Visibility US-002 — products only; no other modal passes it.
          canEditQa={seoProUnlocked}
          aiAssistConnected={aiAssistConnected}
        />
      )}

      {/* Post SEO Modal */}
      {selectedPost && (
        <SeoEditorModal
          isOpen={!!selectedPost}
          onClose={() => setSelectedPost(null)}
          entityType="post"
          entityId={selectedPost.id}
          entityName={selectedPost.title}
          entitySlug={selectedPost.slug}
          previewUrl={`${baseUrl}/the-wire/${selectedPost.slug}`}
          initialSeo={selectedPost.seo || undefined}
          onSave={handleSavePostSeo}
          canUploadOgImage={seoProUnlocked}
          canEditIndexing={seoProUnlocked}
          canUseAiAssist={seoProUnlocked}
          aiAssistConnected={aiAssistConnected}
        />
      )}

      {/* Condition SEO Modal */}
      {selectedCondition && (
        <SeoEditorModal
          isOpen={!!selectedCondition}
          onClose={() => setSelectedCondition(null)}
          entityType="condition"
          entityId={selectedCondition.id}
          entityName={selectedCondition.name}
          entitySlug={selectedCondition.slug}
          previewUrl={`${baseUrl}${conditionPath(selectedCondition.slug)}`}
          initialSeo={selectedCondition.seo || undefined}
          onSave={handleSaveConditionSeo}
          canUploadOgImage={seoProUnlocked}
          canEditIndexing={seoProUnlocked}
          canUseAiAssist={seoProUnlocked}
          aiAssistConnected={aiAssistConnected}
        />
      )}

      {/* Page SEO Modal */}
      {selectedPage && (
        <SeoEditorModal
          isOpen={!!selectedPage}
          onClose={() => setSelectedPage(null)}
          entityType="page"
          entityId={selectedPage.key}
          entityName={selectedPage.name}
          entitySlug={selectedPage.path || "/"}
          previewUrl={`${baseUrl}${selectedPage.path || "/"}`}
          initialSeo={readStorePageSeo(localPageSeo, selectedPage.key)}
          onSave={handleSavePageSeo}
          canUploadOgImage={seoProUnlocked}
          canEditIndexing={seoProUnlocked}
          canUseAiAssist={seoProUnlocked}
          aiAssistConnected={aiAssistConnected}
        />
      )}
    </>
  );
}
