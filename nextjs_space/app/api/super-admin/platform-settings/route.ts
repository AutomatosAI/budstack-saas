import { NextResponse } from "next/server";
import { withSuperAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { uploadFile } from "@/lib/storage/s3";
import { validateUploadBuffer } from "@/lib/storage/upload-validation";

export const POST = withSuperAdmin(async (req) => {
  try {
    const formData = await req.formData();

    // Extract form fields
    const businessName = formData.get("businessName") as string;
    const tagline = formData.get("tagline") as string;
    const primaryColor = formData.get("primaryColor") as string;
    const secondaryColor = formData.get("secondaryColor") as string;
    const accentColor = formData.get("accentColor") as string;
    const backgroundColor = formData.get("backgroundColor") as string;
    const textColor = formData.get("textColor") as string;
    const headingColor = formData.get("headingColor") as string;
    const fontFamily = formData.get("fontFamily") as string;
    const headingFontFamily = formData.get("headingFontFamily") as string;
    const template = formData.get("template") as string;
    const automatosApiKey = formData.get("automatosApiKey") as string | null;
    const automatosAgentIdStr = formData.get("automatosAgentId") as string | null;
    const automatosAgentId = automatosAgentIdStr ? parseInt(automatosAgentIdStr, 10) : null;
    const automatosHelperAgentIdStr = formData.get("automatosHelperAgentId") as string | null;
    const automatosHelperAgentId = automatosHelperAgentIdStr ? parseInt(automatosHelperAgentIdStr, 10) : null;

    // Handle file uploads
    const logoFile = formData.get("logo") as File | null;
    const faviconFile = formData.get("favicon") as File | null;

    let logoUrl: string | undefined;
    let faviconUrl: string | undefined;

    // SECURITY (C10): Sanitize filename + magic-byte verification on
    // platform branding uploads. Without this a super-admin (or anyone
    // who compromises one) could ship a non-image disguised as one.
    const safeFileName = (raw: string) =>
      raw
        .replace(/\.\.\//g, "")
        .replace(/\.\.\\/g, "")
        .replace(/[/\\]/g, "_")
        .slice(0, 200);

    // Upload logo if provided
    if (logoFile && logoFile.size > 0) {
      const logoBuffer = Buffer.from(await logoFile.arrayBuffer());
      const cleanName = safeFileName(logoFile.name);
      const validation = await validateUploadBuffer(
        logoBuffer,
        logoFile.type,
        cleanName,
      );
      if (!validation.valid) {
        return NextResponse.json(
          { error: `Logo: ${validation.error}` },
          { status: 400 },
        );
      }
      const logoKey = `platform/logo-${Date.now()}-${cleanName}`;
      logoUrl = await uploadFile(logoBuffer, logoKey, logoFile.type || undefined);
    }

    // Upload favicon if provided
    if (faviconFile && faviconFile.size > 0) {
      const faviconBuffer = Buffer.from(await faviconFile.arrayBuffer());
      const cleanName = safeFileName(faviconFile.name);
      const validation = await validateUploadBuffer(
        faviconBuffer,
        faviconFile.type,
        cleanName,
      );
      if (!validation.valid) {
        return NextResponse.json(
          { error: `Favicon: ${validation.error}` },
          { status: 400 },
        );
      }
      const faviconKey = `platform/favicon-${Date.now()}-${cleanName}`;
      faviconUrl = await uploadFile(faviconBuffer, faviconKey, faviconFile.type || undefined);
    }

    // Get or create platform settings
    let settings = await prisma.platform_settings.findUnique({
      where: { id: "platform" },
    });

    const updateData: any = {
      businessName,
      tagline: tagline || null,
      primaryColor,
      secondaryColor,
      accentColor,
      backgroundColor,
      textColor,
      headingColor,
      fontFamily,
      headingFontFamily,
      template,
      automatosApiKey: automatosApiKey || null,
      automatosAgentId: isNaN(automatosAgentId as number) ? null : automatosAgentId,
      automatosHelperAgentId: isNaN(automatosHelperAgentId as number) ? null : automatosHelperAgentId,
    };

    if (logoUrl) updateData.logoUrl = logoUrl;
    if (faviconUrl) updateData.faviconUrl = faviconUrl;

    if (!settings) {
      settings = await prisma.platform_settings.create({
        data: {
          id: "platform",
          ...updateData,
        },
      });
    } else {
      settings = await prisma.platform_settings.update({
        where: { id: "platform" },
        data: updateData,
      });
    }

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error("Platform settings update error:", error);
    return NextResponse.json(
      { error: "Failed to update platform settings" },
      { status: 500 },
    );
  }
});

export const GET = withSuperAdmin(async (_req) => {
  try {
    const settings = await prisma.platform_settings.findUnique({
      where: { id: "platform" },
    });

    if (!settings) {
      // Create default settings if not exists
      const newSettings = await prisma.platform_settings.create({
        data: { id: "platform" },
      });
      return NextResponse.json({ settings: newSettings });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Platform settings fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch platform settings" },
      { status: 500 },
    );
  }
});
