"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SeoEditorModal } from "@/components/admin/seo";
import {
  Package,
  FileText,
  Home,
  Search,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

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

    // Update local state
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

    // Update local state
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

    // Update local state
    setLocalPageSeo((prev) => ({
      ...prev,
      [selectedPage.key]: seo,
    }));
  };

  const SeoStatusBadge = ({ hasCustomSeo }: { hasCustomSeo: boolean }) => (
    <Badge variant={hasCustomSeo ? "default" : "secondary"} className="gap-1">
      {hasCustomSeo ? (
        <>
          <CheckCircle className="h-3 w-3" />
          Custom
        </>
      ) : (
        <>
          <AlertCircle className="h-3 w-3" />
          Default
        </>
      )}
    </Badge>
  );

  return (
    <>
      <Tabs defaultValue="products" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="products" className="gap-2">
            <Package className="h-4 w-4 hidden sm:block" />
            Products ({localProducts.length})
          </TabsTrigger>
          <TabsTrigger value="posts" className="gap-2">
            <FileText className="h-4 w-4 hidden sm:block" />
            Posts ({localPosts.length})
          </TabsTrigger>
          <TabsTrigger value="pages" className="gap-2">
            <Home className="h-4 w-4 hidden sm:block" />
            Static Pages
          </TabsTrigger>
        </TabsList>

        {/* Products Tab */}
        <TabsContent value="products">
          <Card>
            <CardHeader>
              <CardTitle>Product SEO</CardTitle>
              <CardDescription>
                Customize titles and descriptions for your products in search
                results.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {localProducts.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  No products found. Sync products from Dr Green first.
                </p>
              ) : (
                <div className="divide-y">
                  {localProducts.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between py-3 gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {product.images[0] && (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="w-10 h-10 rounded object-cover flex-shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">
                            {product.name}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {baseUrl}/products/{product.slug}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <SeoStatusBadge hasCustomSeo={hasSeo(product.seo)} />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedProduct(product)}
                        >
                          <Search className="h-4 w-4 mr-1" />
                          Edit SEO
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Posts Tab */}
        <TabsContent value="posts">
          <Card>
            <CardHeader>
              <CardTitle>Blog Post SEO</CardTitle>
              <CardDescription>
                Optimize your blog posts for search engines.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {localPosts.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  No blog posts yet. Create posts in The Wire section.
                </p>
              ) : (
                <div className="divide-y">
                  {localPosts.map((post) => (
                    <div
                      key={post.id}
                      className="flex items-center justify-between py-3 gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {post.coverImage && (
                          <img
                            src={post.coverImage}
                            alt={post.title}
                            className="w-10 h-10 rounded object-cover flex-shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">
                            {post.title}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {baseUrl}/the-wire/{post.slug}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <SeoStatusBadge hasCustomSeo={hasSeo(post.seo)} />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedPost(post)}
                        >
                          <Search className="h-4 w-4 mr-1" />
                          Edit SEO
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Static Pages Tab */}
        <TabsContent value="pages">
          <Card>
            <CardHeader>
              <CardTitle>Static Page SEO</CardTitle>
              <CardDescription>
                Set metadata for your store's main pages.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {STATIC_PAGES.map((page) => (
                  <div
                    key={page.key}
                    className="flex items-center justify-between py-3 gap-4"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{page.name}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {baseUrl}
                        {page.path || "/"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <SeoStatusBadge
                        hasCustomSeo={hasSeo(localPageSeo[page.key])}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedPage(page)}
                      >
                        <Search className="h-4 w-4 mr-1" />
                        Edit SEO
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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
