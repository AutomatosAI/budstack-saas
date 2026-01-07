
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
import { TenantTemplate, Template } from '@prisma/client';

export default async function TemplatesPage() {
    const session = await getServerSession(authOptions);

    if (!session || (session.user.role !== 'TENANT_ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
        redirect('/auth/login');
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { tenant: true },
    });

    if (!user?.tenant) {
        redirect('/tenant-admin');
    }

    const tenant = user.tenant;

    // 1. Fetch Tenant's Templates
    const myTemplates = await prisma.tenantTemplate.findMany({
        where: { tenantId: tenant.id },
        orderBy: { createdAt: 'desc' },
    });

    // 2. Fetch Available Base Templates (Marketplace)
    const baseTemplates = await prisma.template.findMany({
        where: { isActive: true, isPublic: true },
    });

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <Link href="/tenant-admin" className="text-slate-500 hover:text-slate-700 flex items-center mb-2">
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Back to Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight">Template Management</h1>
                    <p className="text-muted-foreground mt-2">
                        Manage your store's design and layout.
                    </p>
                </div>
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

                        {myTemplates.map((item: TenantTemplate) => (
                            <Card key={item.id} className={`overflow-hidden transition-all ${item.isActive ? 'ring-2 ring-primary border-primary' : ''}`}>
                                <div className="aspect-video bg-slate-100 relative">
                                    {/* Placeholder for Screenshot */}
                                    <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                                        <Layout className="h-12 w-12 opacity-20" />
                                    </div>
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
                                <CardFooter className="flex justify-between border-t bg-slate-50/50 p-4">
                                    <Link href="/tenant-admin/branding">
                                        <Button variant="outline" size="sm">
                                            Customize
                                        </Button>
                                    </Link>
                                    {!item.isActive && (
                                        <Button size="sm" variant="secondary">
                                            Verify Design
                                        </Button>
                                    )}
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* MARKETPLACE TAB */}
                <TabsContent value="marketplace">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {baseTemplates.map((template: Template) => (
                            <Card key={template.id} className="overflow-hidden hover:shadow-md transition-shadow">
                                <div className="aspect-video bg-slate-900 relative group">
                                    {/* Placeholder for Thumbnail */}
                                    {template.thumbnailUrl ? (
                                        <img src={template.thumbnailUrl} alt={template.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center text-slate-600">
                                            <Palette className="h-12 w-12 opacity-20" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        {template.demoUrl && (
                                            <a href={template.demoUrl} target="_blank" rel="noopener noreferrer" className="mr-2">
                                                <Button variant="secondary" size="sm">Live Demo</Button>
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
