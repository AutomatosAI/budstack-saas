'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, ExternalLink } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

interface Post {
    id: string;
    title: string;
    slug: string;
    published: boolean;
    createdAt: Date;
    author: { name: string | null };
}

export default function PostsList({ initialPosts }: { initialPosts: any[] }) {
    const router = useRouter();
    const [posts, setPosts] = useState(initialPosts);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this article?')) return;

        setIsDeleting(id);
        try {
            const res = await fetch(`/api/tenant-admin/posts/${id}`, {
                method: 'DELETE',
            });

            if (!res.ok) throw new Error('Failed to delete');

            setPosts(posts.filter(p => p.id !== id));
            toast.success('Article deleted');
            router.refresh();
        } catch (error) {
            toast.error('Failed to delete article');
        } finally {
            setIsDeleting(null);
        }
    };

    if (posts.length === 0) {
        return (
            <div className="text-center py-12 border rounded-lg bg-muted/10">
                <h3 className="text-lg font-semibold">No articles yet</h3>
                <p className="text-muted-foreground mb-4">Get started by creating your first post.</p>
                <Link href="/tenant-admin/the-wire/new">
                    <Button variant="outline">Create Article</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="border rounded-md">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Author</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {posts.map((post) => (
                        <TableRow key={post.id}>
                            <TableCell className="font-medium">
                                {post.title}
                                <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                    /{post.slug}
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant={post.published ? 'default' : 'secondary'}>
                                    {post.published ? 'Published' : 'Draft'}
                                </Badge>
                            </TableCell>
                            <TableCell>{post.author?.name || 'Unknown'}</TableCell>
                            <TableCell>
                                {format(new Date(post.createdAt), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                                <Link href={`/tenant-admin/the-wire/${post.id}`} passHref>
                                    <Button variant="ghost" size="icon">
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                </Link>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(post.id)}
                                    disabled={isDeleting === post.id}
                                    className="text-destructive hover:text-destructive/90"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
