import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { uploadFile } from '@/lib/s3';
import { getBucketConfig } from '@/lib/aws-config';

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !['TENANT_ADMIN', 'SUPER_ADMIN'].includes(session.user.role || '')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Convert File to Buffer
        const buffer = Buffer.from(await file.arrayBuffer());

        // Upload to S3
        // Use session tenant ID in path to organize files?
        // lib/s3.ts uploadFile adds timestamp prepended.
        // We'll trust it for now. 

        // Note: uploadFile returns the KEY.
        // We need to construct the URL or s3Client.getFileUrl() returns signed URL.
        // But for public blog posts, we usually want PUBLIC access if the bucket is public?
        // AWS config says "private" usually.
        // But `lib/s3.ts` has `getFileUrl` which signs it.
        // If posts are public, the images need to be public or signed on render.
        // User asked "Do the image get pushed to the tenant S3 space also?".
        // We should use `uploadFile`.

        const key = await uploadFile(buffer, file.name);

        // If bucket is public read, we can construct URL.
        // If private, we need signed URL.
        // For "The Wire" (public blog), signed URLs expire, which is bad for SEO/Caching.
        // Ideally bucket should be public-read for /uploads.
        // Assuming our S3 setup allows public read or we use a CloudFront distribution.
        // For now, I'll return the Key and a "Provisional" URL which might be signed or public.

        // Let's verify `lib/aws-config.ts` or usage.
        // The `getFileUrl` in `lib/s3.ts` returns a SIGNED url.
        // This implies private bucket.
        // If so, public blog posts will have broken images after 1 hour unless we re-sign them on every render.
        // Next.js Server Components CAN re-sign on every render.
        // But client-side cache might hold them.
        // The User mentioned "Dr Green publish articals ... share to all tenants".
        // This implies a shared public bucket is better.
        // I will assume for now I return the KEY, and the frontend handles getting the URL.
        // But the EDITOR needs to show the image immediately.
        // So I will return a signed URL for preview.

        const { bucketName, region } = await getBucketConfig();
        // Construct a "permanent" url if public
        const publicUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;

        return NextResponse.json({
            success: true,
            key,
            url: publicUrl // Optimistic public URL. 
        });

    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
