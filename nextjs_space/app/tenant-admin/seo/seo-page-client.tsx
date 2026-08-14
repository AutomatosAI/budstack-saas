"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SeoEditorModal, SeoProUpsell } from "@/components/admin/seo";
import { conditionPath } from "@/lib/seo/condition-paths";
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
} from "lucide-react";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

interface SeoData {
  title?: string;
  description?: string;
  ogImage?: string;
  /** US-009 — alt text for the entity's image; products and posts only. */
  imageAlt?: string;
}

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
   * US-013 — resolved server-side in page.tsx from the `tenants.plan` column.
   * False for plan 'basic' only; trial, pro and custom all hold `seo.pro`.
   * Presentation only: the server gate on each Pro route is the boundary.
   */
  seoProUnlocked: boolean;
}

export function SeoPageClient({
  tenantId,
  baseUrl,
  products,
  posts,
  conditions,
  pageSeo,
  seoProUnlocked,
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

  const hasSeo = (seo: SeoData | null | undefined): boolean => {
    return !!(
      seo &&
      (seo.title || seo.description || seo.ogImage || seo.imageAlt)
    );
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

    setLocalProducts((prev) =>
      prev.map((p) => (p.id === selectedProduct.id ? { ...p, seo } : p)),
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

    setLocalPosts((prev) =>
      prev.map((p) => (p.id === selectedPost.id ? { ...p, seo } : p)),
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

    setLocalConditions((prev) =>
      prev.map((c) => (c.id === selectedCondition.id ? { ...c, seo } : c)),
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

    // Mirrors what the route stores, legacy-key retirement included, so the
    // badge below cannot claim "Custom" from an entry the server just dropped.
    setLocalPageSeo((prev) => ({
      ...dropLegacyStorePageSeoKeys(prev, selectedPage.key),
      [selectedPage.key]: seo,
    }));
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
      <Tabs defaultValue="products" className="space-y-6">
        <TabsList
          className={
            seoProUnlocked
              ? "grid w-full grid-cols-2 sm:grid-cols-4 lg:w-auto lg:inline-grid"
              : "grid w-full grid-cols-2 sm:grid-cols-5 lg:w-auto lg:inline-grid"
          }
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
        />
      )}
    </>
  );
}
