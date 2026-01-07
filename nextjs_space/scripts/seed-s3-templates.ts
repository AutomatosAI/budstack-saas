import fs from 'fs';
import path from 'path';
import { uploadFile } from '../lib/s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getBucketConfig, createS3Client } from '../lib/aws-config';
import dotenv from 'dotenv';

// Load env vars
dotenv.config();

const TEMPLATES_DIR = path.join(process.cwd(), 'templates');

async function walk(dir: string): Promise<string[]> {
    let results: string[] = [];
    const list = await fs.promises.readdir(dir);
    for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = await fs.promises.stat(filePath);
        if (stat && stat.isDirectory()) {
            const res = await walk(filePath);
            results = results.concat(res);
        } else {
            results.push(filePath);
        }
    }
    return results;
}

async function uploadTemplate(templateName: string) {
    const templateDir = path.join(TEMPLATES_DIR, templateName);

    if (!fs.existsSync(templateDir)) {
        console.warn(`Template directory not found: ${templateDir}`);
        return;
    }

    console.log(`Scanning ${templateName}...`);
    const files = await walk(templateDir);
    console.log(`Found ${files.length} files.`);

    const { bucketName } = await getBucketConfig();
    const client = await createS3Client();

    for (const file of files) {
        const relativePath = path.relative(templateDir, file);
        // S3 Key: templates/{templateName}/{relativePath}
        const key = `templates/${templateName}/${relativePath.replace(/\\/g, '/')}`;

        const content = await fs.promises.readFile(file);

        // We can't reuse lib/s3 uploadFile directly because it mandates a specific prefix logic (uploads/timestamp).
        // We need raw upload to specific key.

        await client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: content,
            // Guess content type or let S3 default? ideally mime-types lookup but fine for now.
        }));

        console.log(`Uploaded: ${key}`);
    }
}

async function main() {
    const templates = ['healingbuds', 'wellness-nature', 'gta-cannabis'];

    for (const t of templates) {
        await uploadTemplate(t);
    }

    console.log('Seeding complete.');
}

main().catch(console.error);
