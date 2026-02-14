import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getFileUrl } from '@/lib/s3';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, Layout, ClipboardList, ImageIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { UploadTemplateDialog } from './upload-dialog';
import { TemplateActions } from './template-actions';
import Image from 'next/image';
import Link from 'next/link';

export default async function TemplatesManagementPage() {
  const user = await currentUser();

  if (!user || user.publicMetadata.role !== 'SUPER_ADMIN') {
    redirect('/sign-in');
  }

  // Fetch all templates
  const templates = await prisma.templates.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Sign preview URLs for display
  const templatesWithSignedUrls = await Promise.all(
    templates.map(async (t: any) => {
      let signedPreviewUrl: string | null = null;
      if (t.previewUrl && !t.previewUrl.startsWith('http')) {
        try {
          signedPreviewUrl = await getFileUrl(t.previewUrl);
        } catch { /* ignore */ }
      } else if (t.previewUrl) {
        signedPreviewUrl = t.previewUrl;
      }
      return { ...t, signedPreviewUrl };
    })
  );

  // Fetch community submissions for the tab
  const pendingSubmissions = await prisma.marketplace_submissions.findMany({
    where: { status: { in: ["pending", "changes_requested"] } },
    include: {
      tenant: { select: { businessName: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-8">
      {/* Centered Header */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="section-badge mb-4 inline-flex">
          <Layout className="h-4 w-4" />
          Templates
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Store Templates
        </h1>
        <p className="mt-3 text-muted-foreground">
          Manage home page templates for tenants. Templates define the visual layout of each store.
        </p>
        <div className="mt-6">
          <UploadTemplateDialog />
        </div>
      </div>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="mb-8 bg-white border border-slate-200 rounded-xl p-1">
          <TabsTrigger
            value="templates"
            className="rounded-lg data-[state=active]:bg-accent data-[state=active]:text-white"
          >
            All Templates
          </TabsTrigger>
          <TabsTrigger
            value="submissions"
            className="rounded-lg data-[state=active]:bg-accent data-[state=active]:text-white"
          >
            Community Submissions {pendingSubmissions.length > 0 && (
              <Badge className="ml-2 bg-yellow-500 hover:bg-yellow-600 border-none text-xs">
                {pendingSubmissions.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templatesWithSignedUrls.map((template: any) => (
          <div
            key={template.id}
            className="card-floating overflow-hidden group"
          >
            {/* Preview Image */}
            <div className="relative w-full aspect-video bg-slate-100">
              {template.signedPreviewUrl ? (
                <Image
                  src={template.signedPreviewUrl}
                  alt={`${template.name} preview`}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                  <ImageIcon className="h-12 w-12 opacity-20" />
                </div>
              )}
              {/* Top-left overlay icons: Preview, Edit photo */}
              <div className="absolute top-3 left-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {template.slug && (
                  <Link href={`/store/preview/${template.slug}`} target="_blank">
                    <button
                      className="h-8 w-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
                      title="Preview"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </Link>
                )}
              </div>
              {/* Top-right badges */}
              <div className="absolute top-3 right-3 flex gap-1">
                <Badge
                  className={
                    template.isActive
                      ? "bg-emerald-500 hover:bg-emerald-600 border-none"
                      : "bg-slate-400 border-none"
                  }
                >
                  {template.isActive ? "Active" : "Inactive"}
                </Badge>
                <Badge
                  variant="outline"
                  className="bg-white/90 border-slate-300 text-slate-700"
                >
                  {template.category}
                </Badge>
              </div>
            </div>
            <div className="p-5">
              <h3 className="font-display text-xl font-bold text-foreground group-hover:text-accent transition-colors">
                {template.name}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                {template.description}
              </p>
              {/* Metadata */}
              <div className="grid grid-cols-2 gap-3 text-sm mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent"></div>
                  <span className="text-muted-foreground">v{template.version}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                  <span className="text-muted-foreground">
                    {template.usageCount} tenant(s)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                  <span className="text-muted-foreground">
                    {template.author || "BudStacks"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-muted-foreground">
                    {template.downloadCount} downloads
                  </span>
                </div>
              </div>
              {/* Tags */}
              <div className="flex flex-wrap gap-2 mt-3">
                {template.tags.slice(0, 4).map((tag: string) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-xs bg-blue-50 border-blue-200 text-blue-700"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
            {/* Actions — single row */}
            <div className="flex flex-wrap gap-2 p-4 border-t border-slate-100 bg-slate-50/50">
              <TemplateActions
                templateId={template.id}
                templateName={template.name}
                usageCount={template.usageCount}
                previewUrl={template.signedPreviewUrl}
                slug={template.slug}
                metadata={template.metadata as Record<string, any> | null}
              />
            </div>
          </div>
        ))}
      </div>

      {templates.length === 0 && (
        <div className="card-floating p-12 text-center">
          <div className="icon-badge mx-auto mb-4">
            <Layout className="h-6 w-6 text-white" />
          </div>
          <h3 className="font-display text-lg font-bold text-foreground mb-2">
            No Templates Found
          </h3>
          <p className="text-muted-foreground">
            Upload your first template to get started.
          </p>
        </div>
      )}
        </TabsContent>

        {/* Community Submissions Tab */}
        <TabsContent value="submissions">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pendingSubmissions.map((sub: any) => {
              const statusConfig: Record<string, { label: string; className: string }> = {
                pending: { label: "Pending Review", className: "bg-yellow-500 hover:bg-yellow-600" },
                changes_requested: { label: "Changes Requested", className: "bg-orange-500 hover:bg-orange-600" },
              };
              const config = statusConfig[sub.status] || { label: sub.status, className: "bg-slate-400" };
              return (
                <div key={sub.id} className="card-floating overflow-hidden">
                  <div className="p-5 border-b border-slate-100">
                    <div className="flex justify-between items-start mb-3">
                      <Badge className={config.className}>
                        {config.label}
                      </Badge>
                      {sub.category && (
                        <Badge variant="outline" className="bg-white border-slate-300 text-slate-700">
                          {sub.category}
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-display text-lg font-bold text-foreground">
                      {sub.templateName}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      By {sub.tenant.businessName}
                    </p>
                    {sub.description && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {sub.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Submitted {new Date(sub.createdAt).toLocaleDateString()}
                    </p>
                    {sub.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {sub.tags.slice(0, 4).map((tag: string) => (
                          <Badge key={tag} variant="outline" className="text-xs bg-blue-50 border-blue-200 text-blue-700">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <Link href={`/super-admin/templates/submissions/${sub.id}`}>
                      <Button size="sm" className="w-full rounded-xl bg-blue-600 hover:bg-blue-700">
                        <ClipboardList className="mr-2 h-4 w-4" />
                        Review
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}

            {pendingSubmissions.length === 0 && (
              <div className="col-span-full card-floating p-12 text-center">
                <div className="icon-badge mx-auto mb-4">
                  <ClipboardList className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-display text-lg font-bold text-foreground mb-2">
                  No Submissions to Review
                </h3>
                <p className="text-muted-foreground">
                  When tenants share their custom templates, they will appear here for review.
                </p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Info Box */}
      <div className="card-floating p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="rounded-2xl bg-slate-500 p-3">
            <Layout className="h-5 w-5 text-white" />
          </div>
          <h2 className="font-display text-xl font-bold text-foreground">
            Template System Information
          </h2>
        </div>
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2"></div>
            <span>
              Templates are stored in{" "}
              <code className="px-2 py-0.5 bg-slate-100 rounded text-xs font-mono">
                /templates
              </code>{" "}
              directory
            </span>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2"></div>
            <span>
              Each template consists of index.tsx, components/, styles.css,
              template.config.json, and defaults.json
            </span>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2"></div>
            <span>
              Templates automatically inherit tenant branding (colors, fonts,
              images)
            </span>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2"></div>
            <span>
              Upload templates directly from GitHub repositories using the
              &quot;Upload New Template&quot; button
            </span>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2"></div>
            <span>
              Templates can be deleted if they are not currently in use by any
              tenant
            </span>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2"></div>
            <span>
              See TEMPLATE_DESIGN_GUIDE.md for template creation guidelines
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
