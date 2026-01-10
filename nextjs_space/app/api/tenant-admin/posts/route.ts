import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// Slugify helper
function slugify(text: string) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')     // Replace spaces with -
        .replace(/[^\w\-]+/g, '') // Remove all non-word chars
        .replace(/\-\-+/g, '-');  // Replace multiple - with single -
}

const postSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    content: z.string().min(1, 'Content is required'),
    excerpt: z.string().optional(),
    coverImage: z.string().optional(),
    published: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user.role !== 'TENANT_ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.users.findUnique({
            where: { id: session.user.id },
            include: { tenants: true },
        });

        if (!user?.tenants) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        const body = await req.json();
        const validatedData = postSchema.parse(body);

        // Generate base slug
        let slug = slugify(validatedData.title);

        // Ensure uniqueness within tenant
        let uniqueSlug = slug;
        let counter = 1;
        while (await prisma.posts.findUnique({
            where: { slug_tenantId: { slug: uniqueSlug, tenantId: user.tenants.id } }
        })) {
            uniqueSlug = `${slug}-${counter}`;
            counter++;
        }

        const post = await prisma.posts.create({
            data: {
                title: validatedData.title,
                slug: uniqueSlug,
                content: validatedData.content,
                excerpt: validatedData.excerpt,
                coverImage: validatedData.coverImage,
                published: validatedData.published,
                tenantId: user.tenants.id,
                authorId: user.id,
            },
        });

        return NextResponse.json(post);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        console.error('Error creating post:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user.role !== 'TENANT_ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.users.findUnique({
            where: { id: session.user.id },
            include: { tenants: true },
        });

        if (!user?.tenants) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        const posts = await prisma.posts.findMany({
            where: { tenantId: user.tenants.id },
            orderBy: { createdAt: 'desc' },
            include: { author: { select: { name: true, email: true } } }
        });

        return NextResponse.json(posts);
    } catch (error) {
        console.error('Error fetching posts:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
