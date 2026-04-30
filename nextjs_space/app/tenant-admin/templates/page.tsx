import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/s3";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Palette, Layout, Eye, Share2 } from "lucide-react";
import TemplateCloneButton from "./clone-button";
import ActivateButton from "./activate-button";
import DeleteButton from "./delete-button";
import { UploadTemplateDialog } from "./upload-dialog";
import { CreateBlankDialog } from "./create-blank-dialog";
import UpdateGitHubButton from "./update-github-button";
import { ShareMarketplaceDialog } from "./share-marketplace-dialog";
import WithdrawButton from "./withdraw-button";
import ResubmitButton from "./resubmit-button";
import { PreviewUploadDialog } from "./preview-upload-dialog";

type ClonedTemplate = any;

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

/** Sign an S3 key to a URL, or pass through if already a URL */
async function signUrl(key: string | null | undefined): Promise<string | null> {
  if (!key) return null;
  if (key.startsWith("http")) return key;
  try {
    return await getFileUrl(key);
  } catch {
    return null;
  }
}

export default async function TemplatesPage() {
  const user = await currentUser();

  if (
    !user ||
    (user.publicMetadata.role !== "TENANT_ADMIN" &&
      user.publicMetadata.role !== "SUPER_ADMIN")
  ) {
    redirect("/auth/login");
  }

  const email = user.emailAddresses[0]?.emailAddress;
  const localUser = await prisma.users.findFirst({
    where: { email: email },
    include: { tenants: true },
  });

  if (!localUser?.tenants) {
    redirect("/tenant-admin");
  }

  const tenant = localUser.tenants;

  const myTemplatesRaw = await prisma.tenant_templates.findMany({
    where: { tenantId: tenant.id },
    include: {
      templates: {
        select: {
          thumbnailUrl: true,
          previewUrl: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const myTemplates = await Promise.all(
    myTemplatesRaw.map(async (t: any) => ({
      ...t,
      signedPreviewUrl: await signUrl(
        t.previewUrl || t.templates?.previewUrl || t.templates?.thumbnailUrl,
      ),
    })),
  );

  const baseTemplatesRaw = await prisma.templates.findMany({
    where: { isActive: true, isPublic: true },
  });

  const baseTemplates = await Promise.all(
    baseTemplatesRaw.map(async (t: any) => ({
      ...t,
      signedPreviewUrl: await signUrl(t.previewUrl || t.thumbnailUrl),
    })),
  );

  const submissions = await prisma.marketplace_submissions.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
  });

  const submissionMap = new Map<string, (typeof submissions)[number]>();
  for (const sub of submissions) {
    if (!submissionMap.has(sub.tenantTemplateId)) {
      submissionMap.set(sub.tenantTemplateId, sub);
    }
  }

  return (
    <div className="space-y-8">
      <div className="bs-page-header-centered">
        <h1 className="bs-page-title">Theme Management</h1>
        <p className="bs-page-subtitle">
          Manage your store&apos;s design and layout.
        </p>
      </div>

      <Tabs defaultValue="my-templates" className="w-full">
        <TabsList>
          <TabsTrigger value="my-templates">My Themes</TabsTrigger>
          <TabsTrigger value="marketplace">Theme Marketplace</TabsTrigger>
        </TabsList>

        {/* MY TEMPLATES TAB */}
        <TabsContent value="my-templates" className="mt-6">
          <div className="flex justify-end gap-3 mb-6">
            <CreateBlankDialog />
            <UploadTemplateDialog />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myTemplates.length === 0 && (
              <div className="col-span-full bs-card bs-card-pad text-center py-12">
                <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-bs-green/10">
                  <Palette
                    className="h-6 w-6 text-bs-green"
                    aria-hidden="true"
                  />
                </div>
                <h3
                  className="text-[22px] leading-tight mb-2"
                  style={sectionTitleStyle}
                >
                  No Themes Found
                </h3>
                <p className="text-bs-fg-muted mb-2">
                  You don&apos;t have any themes yet.
                </p>
                <p className="text-sm text-bs-fg-muted">
                  Create a new theme or browse the Marketplace to get started.
                </p>
              </div>
            )}

            {myTemplates.map((item: ClonedTemplate) => {
              const sub = submissionMap.get(item.id);
              const hasActiveSub =
                sub && ["pending", "changes_requested"].includes(sub.status);
              const canShare =
                item.source === "custom" &&
                (!sub ||
                  sub.status === "withdrawn" ||
                  sub.status === "rejected");
              return (
                <div
                  key={item.id}
                  className={`bs-card overflow-hidden transition-all ${
                    item.isActive ? "ring-1 ring-bs-green border-bs-green" : ""
                  }`}
                >
                  <div className="aspect-video bg-bs-card-2 relative group">
                    {item.signedPreviewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.signedPreviewUrl}
                        alt={`${item.templateName} preview`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-bs-fg-muted">
                        <Layout className="h-12 w-12 opacity-30" />
                      </div>
                    )}
                    {item.source === "custom" && (
                      <div className="absolute top-3 left-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link
                          href={`/store/${tenant.subdomain}?preview=${item.id}`}
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
                        {canShare && (
                          <ShareMarketplaceDialog
                            templateId={item.id}
                            templateName={item.templateName}
                            tenantBusinessName={tenant.businessName}
                            triggerElement={
                              <button
                                type="button"
                                className="h-8 w-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
                                title="Share to Marketplace"
                              >
                                <Share2
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              </button>
                            }
                          />
                        )}
                        <PreviewUploadDialog
                          templateId={item.id}
                          templateName={item.templateName}
                          currentPreviewUrl={item.signedPreviewUrl}
                        />
                      </div>
                    )}
                    <div className="absolute top-3 right-3 flex gap-1">
                      {item.isActive && (
                        <span className="bs-chip bs-chip-green">Active</span>
                      )}
                      {item.source === "custom" ? (
                        <span className="bs-chip bs-chip-info">Custom</span>
                      ) : (
                        <span className="bs-chip bs-chip-muted">Cloned</span>
                      )}
                    </div>
                  </div>
                  <div className="p-5">
                    <h3
                      className="text-[20px] leading-tight text-bs-fg"
                      style={sectionTitleStyle}
                    >
                      {item.templateName}
                    </h3>
                    <p className="text-sm text-bs-fg-muted mt-1">
                      {item.source === "custom" ? "Uploaded" : "Cloned"}{" "}
                      {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                    {(() => {
                      if (!sub || sub.status === "withdrawn") return null;
                      const statusConfig: Record<
                        string,
                        { label: string; chipClass: string }
                      > = {
                        pending: {
                          label: "Pending Review",
                          chipClass: "bs-chip-warn",
                        },
                        approved: {
                          label: "Approved",
                          chipClass: "bs-chip-green",
                        },
                        rejected: {
                          label: "Rejected",
                          chipClass: "bs-chip-danger",
                        },
                        changes_requested: {
                          label: "Changes Requested",
                          chipClass: "bs-chip-warn",
                        },
                      };
                      const config = statusConfig[sub.status];
                      if (!config) return null;
                      return (
                        <div className="mt-2">
                          <span className={`bs-chip ${config.chipClass}`}>
                            {config.label}
                          </span>
                          {(sub.status === "rejected" ||
                            sub.status === "changes_requested") &&
                            sub.reviewerFeedback && (
                              <p className="text-xs text-bs-fg-muted mt-1 italic">
                                &ldquo;{sub.reviewerFeedback}&rdquo;
                              </p>
                            )}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex flex-wrap gap-2 p-4 border-t border-bs-border-100 bg-bs-card-2/30">
                    <Link
                      href={`/tenant-admin/branding?templateId=${item.id}`}
                      className="flex-1"
                    >
                      <button
                        type="button"
                        className="bs-btn bs-btn-ghost bs-btn-sm w-full"
                      >
                        <Palette className="mr-2 h-4 w-4" aria-hidden="true" />
                        Customize
                      </button>
                    </Link>
                    <ActivateButton
                      templateId={item.id}
                      templateName={item.templateName}
                      isActive={item.isActive}
                    />
                    <DeleteButton
                      templateId={item.id}
                      templateName={item.templateName}
                      isActive={item.isActive}
                    />
                    {item.source === "custom" && (
                      <UpdateGitHubButton
                        templateId={item.id}
                        templateName={item.templateName}
                      />
                    )}
                    {item.source === "custom" &&
                      (() => {
                        if (sub?.status === "changes_requested") {
                          return (
                            <>
                              <ResubmitButton
                                templateId={item.id}
                                templateName={item.templateName}
                              />
                              <WithdrawButton
                                templateId={item.id}
                                templateName={item.templateName}
                              />
                            </>
                          );
                        }
                        if (hasActiveSub) {
                          return (
                            <WithdrawButton
                              templateId={item.id}
                              templateName={item.templateName}
                            />
                          );
                        }
                        return null;
                      })()}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* MARKETPLACE TAB */}
        <TabsContent value="marketplace" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {baseTemplates.map((template: any) => (
              <div
                key={template.id}
                className="bs-card overflow-hidden hover:bg-bs-card-2/40 transition-colors"
              >
                <div className="aspect-video bg-bs-card-2 relative group">
                  {template.signedPreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={template.signedPreviewUrl}
                      alt={`${template.name} template preview`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-bs-fg-muted">
                      <Palette className="h-16 w-16 opacity-30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    {template.demoUrl && (
                      <a
                        href={template.demoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <button
                          type="button"
                          className="bs-btn bs-btn-ghost bs-btn-sm bg-bs-card/80"
                        >
                          <Layout
                            className="mr-2 h-4 w-4"
                            aria-hidden="true"
                          />
                          Live Demo
                        </button>
                      </a>
                    )}
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h3
                        className="text-[20px] leading-tight text-bs-fg"
                        style={sectionTitleStyle}
                      >
                        {template.name}
                      </h3>
                      {template.sourceType === "COMMUNITY" &&
                        template.authorName && (
                          <p className="text-xs text-bs-fg-muted mt-1">
                            By {template.authorName}
                          </p>
                        )}
                      <p className="text-sm text-bs-fg-muted line-clamp-2 mt-2">
                        {template.description ||
                          "A professional theme for your store."}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {template.sourceType === "COMMUNITY" ? (
                        <span className="bs-chip bs-chip-info">Community</span>
                      ) : null}
                      {template.isPremium && (
                        <span className="bs-chip bs-chip-warn">Premium</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="p-4 border-t border-bs-border-100 bg-bs-card-2/30">
                  <TemplateCloneButton
                    templateId={template.id}
                    templateName={template.name}
                  />
                </div>
              </div>
            ))}

            {baseTemplates.length === 0 && (
              <div className="col-span-full bs-card bs-card-pad text-center py-12">
                <p className="text-bs-fg-muted">
                  No base templates available in the system.
                </p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
