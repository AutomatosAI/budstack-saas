import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Palette, Layout } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import TemplateCloneButton from "./clone-button";
import ActivateButton from "./activate-button";
import { templates } from "@prisma/client";

type ClonedTemplate = any;

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

    // 1. Fetch Tenant's Templates
    const myTemplates = await prisma.tenant_templates.findMany({
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

    // 2. Fetch Available Base Templates (Marketplace)
    const baseTemplates = await prisma.templates.findMany({
        where: { isActive: true, isPublic: true },
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

                        {myTemplates.map((item: ClonedTemplate) => (
                            <div
                                key={item.id}
                                className={`card-floating overflow-hidden transition-all ${item.isActive ? "ring-2 ring-accent border-accent" : ""
                                    }`}
                            >
                                <div className="aspect-video bg-slate-100 relative">
                                    {item.templates?.thumbnailUrl ? (
                                        <img
                                            src={item.templates.thumbnailUrl}
                                            alt={`${item.templateName} preview`}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                                            <Layout className="h-12 w-12 opacity-20" />
                                        </div>
                                    )}
                                    {item.isActive && (
                                        <div className="absolute top-3 right-3">
                                            <Badge className="bg-emerald-500 hover:bg-emerald-600 border-none">
                                                Active
                                            </Badge>
                                        </div>
                                    )}
                                </div>
                                <div className="p-5">
                                    <h3 className="font-display font-bold text-foreground">
                                        {item.templateName}
                                    </h3>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Cloned {new Date(item.createdAt).toLocaleDateString()}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        Based on: {item.templatesId}
                                    </p>
                                </div>
                                <div className="flex gap-2 p-4 border-t border-slate-100 bg-slate-50/50">
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
                                </div>
                            </div>
                        ))}
                    </div>
                </TabsContent>

                {/* MARKETPLACE TAB */}
                <TabsContent value="marketplace">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {baseTemplates.map((template: templates) => (
                            <div
                                key={template.id}
                                className="card-floating overflow-hidden hover:scale-[1.01] transition-all duration-300"
                            >
                                <div className="aspect-video bg-slate-100 relative group">
                                    {template.thumbnailUrl ? (
                                        <img
                                            src={template.thumbnailUrl}
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
                                            <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                                                {template.description ||
                                                    "A professional template for your store."}
                                            </p>
                                        </div>
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
