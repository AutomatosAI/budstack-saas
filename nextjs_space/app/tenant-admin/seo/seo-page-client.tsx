"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SeoEditorModal } from "@/components/admin/seo";
import {
  Package,
  FileText,
  Home,
  Search,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

interface SeoData {
  title?: string;
  description?: string;
  ogImage?: string;
}

interface ProductItem {
  id: string;
  name: string;
  slug: string;
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

interface SeoPageClientProps {
  tenantId: string;
  baseUrl: string;
  products: ProductItem[];
  posts: PostItem[];
  pageSeo: Record<string, SeoData> | null;
}

const STATIC_PAGES = [
  { key: "home", name: "Homepage", path: "" },
  { key: "about", name: "About Us", path: "/about" },
  { key: "contact", name: "Contact", path: "/contact" },
  { key: "faq", name: "FAQ", path: "/faq" },
];

export function SeoPageClient({
  tenantId,
  baseUrl,
  products,
  posts,
  pageSeo,
}: SeoPageClientProps) {
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(
    null,
  );
  const [selectedPost, setSelectedPost] = useState<PostItem | null>(null);
  const [selectedPage, setSelectedPage] = useState<{
    key: string;
    name: string;
    path: string;
  } | null>(null);
  const [localPageSeo, setLocalPageSeo] = useState<Record<string, SeoData>>(
    pageSeo || {},
  );
  const [localProducts, setLocalProducts] = useState(products);
  const [localPosts, setLocalPosts] = useState(posts);

  const hasSeo = (seo: SeoData | null | undefined): boolean => {
    return !!(seo && (seo.title || seo.description || seo.ogImage));
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

  const handleSavePageSeo = async (seo: SeoData) => {
    if (!selectedPage) return;

    const res = await fetch("/api/tenant-admin/seo/pages", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageKey: selectedPage.key, seo }),
    });

    if (!res.ok) throw new Error("Failed to save");

    setLocalPageSeo((prev) => ({
      ...prev,
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
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="products" className="gap-2">
            <Package className="h-4 w-4 hidden sm:block" aria-hidden="true" />
            Products ({localProducts.length})
          </TabsTrigger>
          <TabsTrigger value="posts" className="gap-2">
            <FileText className="h-4 w-4 hidden sm:block" aria-hidden="true" />
            Posts ({localPosts.length})
          </TabsTrigger>
          <TabsTrigger value="pages" className="gap-2">
            <Home className="h-4 w-4 hidden sm:block" aria-hidden="true" />
            Static Pages
          </TabsTrigger>
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
                          {baseUrl}/products/{product.slug}
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
              {STATIC_PAGES.map((page) => (
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
                      hasCustomSeo={hasSeo(localPageSeo[page.key])}
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
          previewUrl={`${baseUrl}/products/${selectedProduct.slug}`}
          initialSeo={selectedProduct.seo || undefined}
          onSave={handleSaveProductSeo}
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
          initialSeo={localPageSeo[selectedPage.key] || undefined}
          onSave={handleSavePageSeo}
        />
      )}
    </>
  );
}
