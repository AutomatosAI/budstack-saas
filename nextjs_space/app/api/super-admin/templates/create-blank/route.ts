import { NextResponse } from "next/server";
import { withSuperAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { createS3Client, getBucketConfig } from "@/lib/storage/aws-config";
import { PutObjectCommand } from "@aws-sdk/client-s3";

/**
 * Creates a blank marketplace template with scaffold files in S3, then returns
 * the editor URL for the client to navigate to.
 *
 * POST (not GET): this creates a DB row and writes S3 objects, so it must not
 * be a safe/idempotent GET that a browser prefetch or crawler could trigger.
 */
export const POST = withSuperAdmin(async (_req) => {
  const timestamp = Date.now();
  const slug = `new-template-${timestamp}`;
  const name = "New Template";

  // Create DB record
  const template = await prisma.templates.create({
    data: {
      id: `tmpl_${timestamp}`,
      name,
      slug,
      description: "A blank template ready to customize",
      isActive: false,
      isPublic: true,
      sourceType: "SYSTEM",
      category: "modern",
      version: "1.0.0",
      author: "BudStacks",
      tags: [],
      updatedAt: new Date(),
    },
  });

  // Create scaffold files in S3
  const s3Client = await createS3Client();
  const { bucketName } = await getBucketConfig();
  const s3Prefix = `templates/${slug}`;

  const scaffoldLayout = {
    navigation: "NavDark",
    footer: "FooterSimple",
    sections: [
      {
        id: "hero-1",
        type: "HeroFullScreen",
        config: {
          title: "Welcome",
          subtitle: "Your tagline here",
          ctaText: "Get Started",
          heroHeight: "large",
          heroType: "gradient",
          textAlign: "center",
        },
      },
    ],
  };

  const scaffoldDefaults = {
    designSystem: {
      colors: {
        primary: "160 60% 45%",
        secondary: "160 40% 60%",
        accent: "160 70% 50%",
        background: "0 0% 100%",
        text: "220 10% 20%",
        heading: "220 15% 10%",
      },
      typography: {
        fontFamily: { body: "inter", heading: "inter" },
        fontSize: { base: "medium" },
        fontWeight: { body: "400", heading: "700" },
      },
    },
    pageContent: {},
  };

  const writeJson = async (key: string, data: any) => {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: Buffer.from(JSON.stringify(data, null, 2)),
        ContentType: "application/json",
      })
    );
  };

  await writeJson(`${s3Prefix}/layout.json`, scaffoldLayout);
  await writeJson(`${s3Prefix}/defaults.json`, scaffoldDefaults);

  return NextResponse.json({
    url: `/super-admin/templates/${template.id}/edit`,
  });
});
