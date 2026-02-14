import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/s3";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Palette, Layout, Eye, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import TemplateCloneButton from "./clone-button";
import ActivateButton from "./activate-button";
import DeleteButton from "./delete-button";
import { UploadTemplateDialog } from "./upload-dialog";
import UpdateGitHubButton from "./update-github-button";
import { ShareMarketplaceDialog } from "./share-marketplace-dialog";
import WithdrawButton from "./withdraw-button";
import ResubmitButton from "./resubmit-button";
import { PreviewUploadDialog } from "./preview-upload-dialog";
type ClonedTemplate = any;

/** Sign an S3 key to a URL, or pass through if already a URL */
async function signUrl(key: string | null | undefined): Promise<string | null> {
    if (!key) return null;
    if (key.startsWith("http")) return key;
    try { return await getFileUrl(key); } catch { return null; }
}

export default async function TemplatesPage() {
    const user = await currentUser();

    if (
        !user ||
        (user.publicMetadata.role !== "TENANT_ADMIN" &&
            user.publicMetadata.role !== "SUPER_ADMIN")
    ) {
        redirect("/sign-in");
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

    // 1. Fetch Tenant's Templates (include source for Custom/Cloned badges)
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

    // Sign preview URLs for my templates
    const myTemplates = await Promise.all(
        myTemplatesRaw.map(async (t: any) => ({
            ...t,
            signedPreviewUrl: await signUrl(t.previewUrl || t.templates?.previewUrl || t.templates?.thumbnailUrl),
        }))
    );

    // 2. Fetch Available Base Templates (Marketplace)
    const baseTemplatesRaw = await prisma.templates.findMany({
        where: { isActive: true, isPublic: true },
    });

    // Sign preview URLs for marketplace templates
    const baseTemplates = await Promise.all(
        baseTemplatesRaw.map(async (t: any) => ({
            ...t,
            signedPreviewUrl: await signUrl(t.previewUrl || t.thumbnailUrl),
        }))
    );

    // 3. Fetch marketplace submissions for this tenant (match to templates)
    const submissions = await prisma.marketplace_submissions.findMany({
        where: { tenantId: tenant.id },
        orderBy: { createdAt: "desc" },
    });

    // Build a map of tenantTemplateId -> latest active submission
    const submissionMap = new Map<string, typeof submissions[number]>();
    for (const sub of submissions) {
        if (!submissionMap.has(sub.tenantTemplateId)) {
            submissionMap.set(sub.tenantTemplateId, sub);
        }
    }

    return (
        <div className="space-y-8">
            {/* Centered Header */}
            <div className="text-center max-w-2xl mx-auto">
                <div className="section-badge mb-4 inline-flex">
                    <Layout className="h-4 w-4" />
                    Templates
                </div>
                <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                    Template Management
                </h1>
                <p className="mt-3 text-muted-foreground">
                    Manage your store&apos;s design and layout.
                </p>
            </div>

            <Tabs defaultValue="my-templates" className="w-full">
                <TabsList className="mb-8 bg-white border border-slate-200 rounded-xl p-1">
                    <TabsTrigger
                        value="my-templates"
                        className="rounded-lg data-[state=active]:bg-accent data-[state=active]:text-white"
                    >
                        My Templates
                    </TabsTrigger>
                    <TabsTrigger
                        value="marketplace"
                        className="rounded-lg data-[state=active]:bg-accent data-[state=active]:text-white"
                    >
                        Template Marketplace
                    </TabsTrigger>
                </TabsList>

                {/* MY TEMPLATES TAB */}
                <TabsContent value="my-templates">
                    <div className="flex justify-end mb-6">
                        <UploadTemplateDialog />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {myTemplates.length === 0 && (
                            <div className="col-span-full card-floating p-12 text-center">
                                <div className="icon-badge mx-auto mb-4">
                                    <Palette className="h-6 w-6 text-white" />
                                </div>
                                <h3 className="font-display text-lg font-bold text-foreground mb-2">
                                    No Templates Found
                                </h3>
                                <p className="text-muted-foreground mb-4">
                                    You haven&apos;t cloned any templates yet.
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    Visit the Marketplace to get started.
                                </p>
                            </div>
                        )}

                        {myTemplates.map((item: ClonedTemplate) => {
                            const sub = submissionMap.get(item.id);
                            const hasActiveSub = sub && ["pending", "changes_requested"].includes(sub.status);
                            const canShare = item.source === "custom" && (!sub || sub.status === "withdrawn" || sub.status === "rejected");
                            return (
                            <div
                                key={item.id}
                                className={`card-floating overflow-hidden transition-all ${item.isActive ? "ring-2 ring-accent border-accent" : ""
                                    }`}
                            >
                                <div className="aspect-video bg-slate-100 relative group">
                                    {item.signedPreviewUrl ? (
                                        <img
                                            src={item.signedPreviewUrl}
                                            alt={`${item.templateName} preview`}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                                            <Layout className="h-12 w-12 opacity-20" />
                                        </div>
                                    )}
                                    {/* Top-left overlay icons: Preview, Share, Upload Preview Image */}
                                    {item.source === "custom" && (
                                        <div className="absolute top-3 left-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Link href={`/store/${tenant.subdomain}?preview=${item.id}`} target="_blank">
                                                <button
                                                    className="h-8 w-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
                                                    title="Preview"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                            </Link>
                                            {canShare && (
                                                <ShareMarketplaceDialog
                                                    templateId={item.id}
                                                    templateName={item.templateName}
                                                    tenantBusinessName={tenant.businessName}
                                                    triggerElement={
                                                        <button
                                                            className="h-8 w-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
                                                            title="Share to Marketplace"
                                                        >
                                                            <Share2 className="h-4 w-4" />
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
                                            <Badge className="bg-emerald-500 hover:bg-emerald-600 border-none">
                                                Active
                                            </Badge>
                                        )}
                                        {item.source === "custom" ? (
                                            <Badge className="bg-purple-500 hover:bg-purple-600 border-none">
                                                Custom
                                            </Badge>
                                        ) : (
                                            <Badge className="bg-blue-500 hover:bg-blue-600 border-none">
                                                Cloned
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <div className="p-5">
                                    <h3 className="font-display font-bold text-foreground">
                                        {item.templateName}
                                    </h3>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {item.source === "custom" ? "Uploaded" : "Cloned"} {new Date(item.createdAt).toLocaleDateString()}
                                    </p>
                                    {(() => {
                                        if (!sub || sub.status === "withdrawn") return null;
                                        const statusConfig: Record<string, { label: string; className: string }> = {
                                            pending: { label: "Pending Review", className: "bg-yellow-100 text-yellow-800" },
                                            approved: { label: "Approved", className: "bg-green-100 text-green-800" },
                                            rejected: { label: "Rejected", className: "bg-red-100 text-red-800" },
                                            changes_requested: { label: "Changes Requested", className: "bg-orange-100 text-orange-800" },
                                        };
                                        const config = statusConfig[sub.status];
                                        if (!config) return null;
                                        return (
                                            <div className="mt-2">
                                                <Badge variant="secondary" className={config.className}>
                                                    {config.label}
                                                </Badge>
                                                {(sub.status === "rejected" || sub.status === "changes_requested") && sub.reviewerFeedback && (
                                                    <p className="text-xs text-muted-foreground mt-1 italic">
                                                        &ldquo;{sub.reviewerFeedback}&rdquo;
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                                <div className="flex flex-wrap gap-2 p-4 border-t border-slate-100 bg-slate-50/50">
                                    <Link href="/tenant-admin/branding" className="flex-1">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full rounded-xl"
                                        >
                                            <Palette className="mr-2 h-4 w-4" />
                                            Customize
                                        </Button>
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
                                    {/* Marketplace submission actions (bottom row) */}
                                    {item.source === "custom" && (() => {
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
                <TabsContent value="marketplace">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {baseTemplates.map((template: any) => (
                            <div
                                key={template.id}
                                className="card-floating overflow-hidden hover:scale-[1.01] transition-all duration-300"
                            >
                                <div className="aspect-video bg-slate-100 relative group">
                                    {template.signedPreviewUrl ? (
                                        <img
                                            src={template.signedPreviewUrl}
                                            alt={`${template.name} template preview`}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                                            <Palette className="h-16 w-16 opacity-30" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                        {template.demoUrl && (
                                            <a
                                                href={template.demoUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    className="shadow-lg rounded-xl"
                                                >
                                                    <Layout className="mr-2 h-4 w-4" />
                                                    Live Demo
                                                </Button>
                                            </a>
                                        )}
                                    </div>
                                </div>
                                <div className="p-5">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-display font-bold text-foreground">
                                                {template.name}
                                            </h3>
                                            {template.sourceType === "COMMUNITY" && template.authorName && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    By {template.authorName}
                                                </p>
                                            )}
                                            <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                                                {template.description ||
                                                    "A professional template for your store."}
                                            </p>
                                        </div>
                                        <div className="flex gap-1 flex-shrink-0">
                                            {template.sourceType === "COMMUNITY" ? (
                                                <Badge className="bg-teal-500 hover:bg-teal-600 border-none">
                                                    Community
                                                </Badge>
                                            ) : null}
                                            {template.isPremium && (
                                                <Badge
                                                    variant="secondary"
                                                    className="bg-amber-100 text-amber-800 hover:bg-amber-200"
                                                >
                                                    Premium
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                                    <TemplateCloneButton
                                        templateId={template.id}
                                        templateName={template.name}
                                    />
                                </div>
                            </div>
                        ))}

                        {baseTemplates.length === 0 && (
                            <div className="col-span-full card-floating p-12 text-center">
                                <p className="text-muted-foreground">
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
