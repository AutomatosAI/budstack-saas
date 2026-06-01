import { NextResponse } from "next/server";
import { withSuperAdmin } from "@/lib/api-auth";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/security/encryption";
import { apiError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";

const platformConfigSchema = z.object({
  drGreenApiUrl: z.string().max(2000).optional().nullable(),
  awsBucketName: z.string().max(255).optional().nullable(),
  awsFolderPrefix: z.string().max(255).optional().nullable(),
  awsRegion: z.string().max(64).optional().nullable(),
  awsAccessKeyId: z.string().max(500).optional().nullable(),
  awsSecretAccessKey: z.string().max(500).optional().nullable(),
  emailServer: z.string().max(2000).optional().nullable(),
  emailFrom: z.string().max(320).optional().nullable(),
  redisUrl: z.string().max(2000).optional().nullable(),
});

export const GET = withSuperAdmin(async (_req) => {
  try {
    const config = await prisma.platform_config.findUnique({
      where: { id: "config" },
    });

    if (!config) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    // Mask sensitive fields
    const maskedConfig = {
      ...config,
      awsAccessKeyId: config.awsAccessKeyId ? "********" : "",
      awsSecretAccessKey: config.awsSecretAccessKey ? "********" : "",
      emailServer: config.emailServer ? "********" : "",
      redisUrl: config.redisUrl ? "********" : "",
    };

    return NextResponse.json(maskedConfig);
  } catch (error) {
    return apiError(error, {
      route: "GET /api/super-admin/settings",
      safeMessage: "Failed to fetch config",
    });
  }
});

export const POST = withSuperAdmin(async (req) => {
  try {
    const {
      drGreenApiUrl,
      awsBucketName,
      awsFolderPrefix,
      awsRegion,
      awsAccessKeyId,
      awsSecretAccessKey,
      emailServer,
      emailFrom,
      redisUrl,
    } = await parseJsonBody(req, platformConfigSchema);

    const dataToUpdate: any = {
      drGreenApiUrl: drGreenApiUrl || null,
      awsBucketName: awsBucketName || null,
      awsFolderPrefix: awsFolderPrefix || null,
      awsRegion: awsRegion || null,
      emailFrom: emailFrom || null,
    };

    // Only update encrypted fields if new values are provided
    if (awsAccessKeyId && awsAccessKeyId.trim() !== "") {
      console.log("Encrypting new AWS access key...");
      try {
        dataToUpdate.awsAccessKeyId = encrypt(awsAccessKeyId);
      } catch (e) {
        console.error("Encryption failed for AWS access key:", e);
        throw e;
      }
    }

    if (awsSecretAccessKey && awsSecretAccessKey.trim() !== "") {
      console.log("Encrypting new AWS secret key...");
      try {
        dataToUpdate.awsSecretAccessKey = encrypt(awsSecretAccessKey);
      } catch (e) {
        console.error("Encryption failed for AWS secret key:", e);
        throw e;
      }
    }

    if (emailServer && emailServer.trim() !== "") {
      console.log("Encrypting new email server...");
      try {
        dataToUpdate.emailServer = encrypt(emailServer);
      } catch (e) {
        console.error("Encryption failed for email server:", e);
        throw e;
      }
    }

    if (redisUrl && redisUrl.trim() !== "") {
      console.log("Encrypting new Redis URL...");
      try {
        dataToUpdate.redisUrl = encrypt(redisUrl);
      } catch (e) {
        console.error("Encryption failed for Redis URL:", e);
        throw e;
      }
    }

    console.log("Updating platform config...");

    // Upsert the config
    await prisma.platform_config.upsert({
      where: { id: "config" },
      create: { id: "config", ...dataToUpdate, updatedAt: new Date() },
      update: { ...dataToUpdate, updatedAt: new Date() },
    });

    console.log("Platform config updated successfully");
    return NextResponse.json({
      success: true,
      message: "Settings updated successfully",
    });
  } catch (error) {
    return apiError(error, {
      route: "POST /api/super-admin/settings",
      safeMessage: "Failed to update settings",
    });
  }
});
