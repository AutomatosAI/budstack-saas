import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/storage/s3";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Eye,
  Layout,
  ClipboardList,
  ImageIcon,
  Paintbrush,
  Plus,
} from "lucide-react";
import { RowPill } from "@/components/admin/shared";
import { UploadTemplateDialog } from "./upload-dialog";
import { TemplateActions } from "./template-actions";
import Image from "next/image";
import Link from "next/link";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

export default async function TemplatesManagementPage() {
  const user = await currentUser();

  if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
    redirect("/auth/login");
  }

  const templates = await prisma.templates.findMany({
    orderBy: { createdAt: "desc" },
  });

  const templatesWithSignedUrls = await Promise.all(
    templates.map(async (t: any) => {
      let signedPreviewUrl: string | null = null;
      if (t.previewUrl && !t.previewUrl.startsWith("http")) {
        try {
          signedPreviewUrl = await getFileUrl(t.previewUrl);
        } catch {
          /* ignore */
        }
      } else if (t.previewUrl) {
        signedPreviewUrl = t.previewUrl;
      }
      return { ...t, signedPreviewUrl };
    }),
  );

  const pendingSubmissions = await prisma.marketplace_submissions.findMany({
    where: { status: { in: ["pending", "changes_requested"] } },
    include: {
      tenant: { select: { businessName: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-8">
      <div className="bs-page-header-compact flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="bs-page-title">Store Themes</h1>
          <p className="bs-page-subtitle">
            Manage storefront themes for tenants. Themes define the visual layout
            of each store.
          </p>
        </div>
        <div className="flex gap-3 justify-start sm:justify-end">
          <UploadTemplateDialog />
          <Link
            href="/api/super-admin/templates/create-blank"
            prefetch={false}
            className="bs-btn bs-btn-ghost gap-2"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create New Theme
          </Link>
        </div>
      </div>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="mb-8">
          <TabsTrigger value="templates">All Themes</TabsTrigger>
          <TabsTrigger value="submissions">
            Community Submissions{" "}
            {pendingSubmissions.length > 0 && (
              <RowPill tone="amber" className="ml-2">
                {pendingSubmissions.length}
              </RowPill>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templatesWithSignedUrls.map((template: any) => (
              <div
                key={template.id}
                className={`bs-card overflow-hidden group ${
                  template.isActive ? "ring-1 ring-bs-green" : ""
                }`}
              >
                <div className="relative w-full aspect-video bg-bs-card-2">
                  {template.signedPreviewUrl ? (
                    <Image
                      src={template.signedPreviewUrl}
                      alt={`${template.name} preview`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-bs-fg-muted">
                      <ImageIcon
                        className="h-12 w-12 opacity-30"
                        aria-hidden="true"
                      />
                    </div>
                  )}
                  <div className="absolute top-3 left-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {template.slug && (
                      <Link
                        href={`/store/preview/${template.slug}`}
                        target="_blank"
                      >
                        <button
                          type="button"
                          className="h-8 w-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </Link>
                    )}
                  </div>
                  <div className="absolute top-3 right-3 flex gap-1">
                    <RowPill tone={template.isActive ? "emerald" : "slate"}>
                      {template.isActive ? "Active" : "Inactive"}
                    </RowPill>
                    <RowPill tone="slate">{template.category}</RowPill>
                  </div>
                </div>
                <div className="p-5">
                  <h3
                    className="text-[22px] leading-tight text-bs-fg group-hover:text-bs-green transition-colors"
                    style={sectionTitleStyle}
                  >
                    {template.name}
                  </h3>
                  <p className="text-sm text-bs-fg-muted line-clamp-2 mt-2">
                    {template.description}
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-sm mt-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-bs-green" />
                      <span className="text-bs-fg-muted">
                        v{template.version}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-bs-info" />
                      <span className="text-bs-fg-muted">
                        {template.usageCount} tenant(s)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-bs-warn" />
                      <span className="text-bs-fg-muted">
                        {template.author || "BudStacks"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-bs-fg-muted" />
                      <span className="text-bs-fg-muted">
                        {template.downloadCount} downloads
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {template.tags.slice(0, 4).map((tag: string) => (
                      <RowPill key={tag} tone="blue">
                        {tag}
                      </RowPill>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 p-4 border-t border-bs-border-100 bg-bs-card-2/40">
                  {template.slug && (
                    <Link
                      href={`/super-admin/templates/${template.id}/edit`}
                      className="bs-btn bs-btn-green bs-btn-sm gap-1.5"
                    >
                      <Paintbrush
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                      Customize
                    </Link>
                  )}
                  <TemplateActions
                    templateId={template.id}
                    templateName={template.name}
                    usageCount={template.usageCount}
                    previewUrl={template.signedPreviewUrl}
                    slug={template.slug}
                    metadata={template.metadata as Record<string, any> | null}
                    isActive={template.isActive}
                  />
                </div>
              </div>
            ))}
          </div>

          {templates.length === 0 && (
            <div className="bs-card bs-card-pad p-12 text-center">
              <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-bs-md bg-bs-card-2">
                <Layout
                  className="h-6 w-6 text-bs-fg"
                  aria-hidden="true"
                />
              </div>
              <h3
                className="text-[22px] leading-tight text-bs-fg mb-2"
                style={sectionTitleStyle}
              >
                No Themes Found
              </h3>
              <p className="text-bs-fg-muted">
                Upload your first theme to get started.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="submissions">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pendingSubmissions.map((sub: any) => {
              const statusConfig: Record<
                string,
                { label: string; tone: "amber" | "gold" | "slate" }
              > = {
                pending: { label: "Pending Review", tone: "amber" },
                changes_requested: {
                  label: "Changes Requested",
                  tone: "gold",
                },
              };
              const config = statusConfig[sub.status] || {
                label: sub.status,
                tone: "slate" as const,
              };
              return (
                <div key={sub.id} className="bs-card overflow-hidden">
                  <div className="p-5 border-b border-bs-border-100">
                    <div className="flex justify-between items-start mb-3">
                      <RowPill tone={config.tone}>{config.label}</RowPill>
                      {sub.category && (
                        <RowPill tone="slate">{sub.category}</RowPill>
                      )}
                    </div>
                    <h3
                      className="text-[22px] leading-tight text-bs-fg"
                      style={sectionTitleStyle}
                    >
                      {sub.templateName}
                    </h3>
                    <p className="text-sm text-bs-fg-muted mt-1">
                      By {sub.tenant.businessName}
                    </p>
                    {sub.description && (
                      <p className="text-sm text-bs-fg-muted mt-2 line-clamp-2">
                        {sub.description}
                      </p>
                    )}
                    <p className="text-xs text-bs-fg-muted mt-2">
                      Submitted{" "}
                      {new Date(sub.createdAt).toLocaleDateString()}
                    </p>
                    {sub.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {sub.tags.slice(0, 4).map((tag: string) => (
                          <RowPill key={tag} tone="blue">
                            {tag}
                          </RowPill>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <Link
                      href={`/super-admin/templates/submissions/${sub.id}`}
                      className="bs-btn bs-btn-green w-full gap-2"
                    >
                      <ClipboardList
                        className="h-4 w-4"
                        aria-hidden="true"
                      />
                      Review
                    </Link>
                  </div>
                </div>
              );
            })}

            {pendingSubmissions.length === 0 && (
              <div className="col-span-full bs-card bs-card-pad p-12 text-center">
                <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-bs-md bg-bs-card-2">
                  <ClipboardList
                    className="h-6 w-6 text-bs-fg"
                    aria-hidden="true"
                  />
                </div>
                <h3
                  className="text-[22px] leading-tight text-bs-fg mb-2"
                  style={sectionTitleStyle}
                >
                  No Submissions to Review
                </h3>
                <p className="text-bs-fg-muted">
                  When tenants share their custom templates, they will appear
                  here for review.
                </p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <section className="bs-card bs-card-pad">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-bs-md bg-bs-card-2 p-2.5">
            <Layout
              className="h-5 w-5 text-bs-fg"
              aria-hidden="true"
            />
          </div>
          <h2
            className="text-[22px] leading-tight text-bs-fg"
            style={sectionTitleStyle}
          >
            Template System Information
          </h2>
        </div>
        <ul className="space-y-3 text-sm text-bs-fg-muted">
          <li className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-bs-green mt-2" />
            <span>
              Templates are stored in{" "}
              <code className="px-2 py-0.5 bg-bs-canvas border border-bs-border-100 rounded-bs-sm text-xs font-mono text-bs-fg">
                /templates
              </code>{" "}
              directory
            </span>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-bs-green mt-2" />
            <span>
              Each template consists of index.tsx, components/, styles.css,
              template.config.json, and defaults.json
            </span>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-bs-green mt-2" />
            <span>
              Templates automatically inherit tenant branding (colors, fonts,
              images)
            </span>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-bs-green mt-2" />
            <span>
              Upload templates directly from GitHub repositories using the
              &quot;Upload New Template&quot; button
            </span>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-bs-green mt-2" />
            <span>
              Templates can be deleted if they are not currently in use by any
              tenant
            </span>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-bs-green mt-2" />
            <span>
              See TEMPLATE_DESIGN_GUIDE.md for template creation guidelines
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
