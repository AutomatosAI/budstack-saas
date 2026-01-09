
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, Copy, Palette, Layout, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import TemplateCloneButton from './clone-button';
import ActivateButton from './activate-button';
import { Prisma, templates } from '@prisma/client';

// Define typed interface for the cloned template with the included base template relation
type ClonedTemplate = any;

export default async function TemplatesPage() {
    const session = await getServerSession(authOptions);

    if (!session || (session.user.role !== 'TENANT_ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
        redirect('/auth/login');
    }

    const user = await prisma.users.findUnique({
        where: { id: session.user.id },
        include: { tenants: true },
    });

    if (!user?.tenant) {
        redirect('/tenant-admin');
    }

    const tenant = user.tenant;

    // 1. Fetch Tenant's Templates
    const myTemplates = await prisma.tenant_templates.findMany({
        where: { tenantId: tenant.id },
        include: {
            baseTemplate: {
                select: {
                    thumbnailUrl: true,
                    previewUrl: true,
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    // 2. Fetch Available Base Templates (Marketplace)
    const baseTemplates = await prisma.templates.findMany({
        where: { isActive: true, isPublic: true },
    });

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Template Management</h1>
                <p className="text-slate-600 mt-2">Manage your store's design and layout</p>
            </div>

            <Tabs defaultValue="my-templates" className="w-full">
                <TabsList className="mb-8">
                    <TabsTrigger value="my-templates">My Templates</TabsTrigger>
                    <TabsTrigger value="marketplace">Template Marketplace</TabsTrigger>
                </TabsList>

                {/* MY TEMPLATES TAB */}
                <TabsContent value="my-templates">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {myTemplates.length === 0 && (
                            <div className="col-span-full text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                                <Palette className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-slate-900">No Templates Found</h3>
                                <p className="text-slate-500 mb-4">You haven't cloned any templates yet.</p>
                                <p className="text-sm text-slate-400">Visit the Marketplace to get started.</p>
                            </div>
                        )}

                        {myTemplates.map((item: ClonedTemplate) => (
                            <Card key={item.id} className={`overflow-hidden transition-all ${item.isActive ? 'ring-2 ring-primary border-primary' : ''}`}>
                                <div className="aspect-video bg-gradient-to-br from-slate-100 to-slate-200 relative">
                                    {item.baseTemplate?.thumbnailUrl ? (
                                        <img
                                            src={item.baseTemplate.thumbnailUrl}
                                            alt={`${item.templateName} preview`}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                                            <Layout className="h-12 w-12 opacity-20" />
                                        </div>
                                    )}
                                    {item.isActive && (
                                        <div className="absolute top-2 right-2">
                                            <Badge className="bg-green-500 hover:bg-green-600">Active</Badge>
                                        </div>
                                    )}
                                </div>
                                <CardHeader>
                                    <CardTitle>{item.templateName}</CardTitle>
                                    <CardDescription>Cloned {new Date(item.createdAt).toLocaleDateString()}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-slate-500">
                                        Based on: {item.baseTemplateId}
                                    </p>
                                </CardContent>
                                <CardFooter className="flex justify-between gap-2 border-t bg-slate-50/50 p-4">
                                    <Link href="/tenant-admin/branding" className="flex-1">
                                        <Button variant="outline" size="sm" className="w-full">
                                            <Palette className="mr-2 h-4 w-4" />
                                            Customize
                                        </Button>
                                    </Link>
                                    <ActivateButton
                                        templateId={item.id}
                                        templateName={item.templateName}
                                        isActive={item.isActive}
                                    />
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* MARKETPLACE TAB */}
                <TabsContent value="marketplace">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {baseTemplates.map((template: templates) => (
                            <Card key={template.id} className="overflow-hidden hover:shadow-lg transition-all border-slate-200">
                                <div className="aspect-video bg-gradient-to-br from-slate-100 to-slate-200 relative group">
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
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
                                        {template.demoUrl && (
                                            <a href={template.demoUrl} target="_blank" rel="noopener noreferrer">
                                                <Button variant="secondary" size="sm" className="shadow-lg">
                                                    <Layout className="mr-2 h-4 w-4" />
                                                    Live Demo
                                                </Button>
                                            </a>
                                        )}
                                    </div>
                                </div>
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle>{template.name}</CardTitle>
                                            <CardDescription className="line-clamp-2 mt-2">
                                                {template.description || "A professional template for your store."}
                                            </CardDescription>
                                        </div>
                                        {template.isPremium && <Badge variant="secondary">Premium</Badge>}
                                    </div>
                                </CardHeader>
                                <CardFooter className="border-t bg-slate-50/50 p-4">
                                    <TemplateCloneButton templateId={template.id} templateName={template.name} />
                                </CardFooter>
                            </Card>
                        ))}

                        {baseTemplates.length === 0 && (
                            <div className="col-span-full text-center py-12">
                                <p className="text-slate-500">No base templates available in the system.</p>
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
