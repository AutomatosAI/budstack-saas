import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/encryption";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    console.error("Error fetching platform config:", error);
    return NextResponse.json(
      { error: "Failed to fetch config" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
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
    } = body;

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
    console.error("Error updating platform config:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 },
    );
  }
}
