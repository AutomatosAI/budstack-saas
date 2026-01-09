import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import PostsList from './posts-list';
import { Breadcrumbs } from '@/components/admin/shared';

export const metadata = {
    title: 'The Wire Management',
};

export default async function TheWirePage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect('/auth/login');
    }

    const user = await prisma.users.findUnique({
        where: { id: session.user.id },
        include: { tenants: true },
    });

    if (!user?.tenant) {
        redirect('/tenant-admin');
    }

    const posts = await prisma.posts.findMany({
        where: { tenantId: user.tenant.id },
        orderBy: { createdAt: 'desc' },
        include: { users: true },
    });

    return (
        <div className="p-8">
            {/* Breadcrumbs */}
            <Breadcrumbs
                items={[
                    { label: 'Dashboard', href: '/tenant-admin' },
                    { label: 'The Wire' },
                ]}
                className="mb-4"
            />

            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">The Wire</h1>
                    <p className="text-slate-600 mt-2">Manage your news and articles</p>
                </div>
                <Link href="/tenant-admin/the-wire/new">
                    <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-medium shadow-md hover:shadow-lg transition-all">
                        <Plus className="mr-2 h-4 w-4" /> New Article
                    </Button>
                </Link>
            </div>

            <PostsList initialPosts={posts} />
        </div>
    );
}
