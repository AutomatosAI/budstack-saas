import { NextResponse } from "next/server";
import { withSuperAdminParams } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";
import { generateDrGreenSignature } from "@/lib/drgreen-api-client";

export const dynamic = "force-dynamic";

/**
 * Super-admin diagnostic + rotation for a tenant's Dr Green keys.
 * Used to repair tenants whose stored secret key decrypts to garbage
 * (e.g. pasted raw PEM before normalization existed, or truncated paste).
 *
 * GET /api/super-admin/tenants/:id/drgreen-keys
 *   → reports format diagnostics without leaking the key material
 *
 * POST /api/super-admin/tenants/:id/drgreen-keys
 *   body: { apiKey?: string, secretKey?: string }
 *   → normalizes (raw PEM → base64), validates by dry-run signing,
 *     encrypts, and writes the values.
 */

function normalizeDrGreenKey(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("-----BEGIN")) {
    return Buffer.from(trimmed, "utf-8").toString("base64");
  }
  return trimmed;
}

function isEncryptedValue(value: string): boolean {
  const parts = value.split(":");
  return parts.length === 3 || (parts.length === 4 && parts[0] === "v2");
}

/**
 * Diagnose a stored key WITHOUT leaking any byte of decoded material.
 * Returns only:
 *   configured — a value is stored
 *   looksValid — it decrypts AND the signer accepts it (the only signal
 *                that matters for "is this tenant's key usable")
 *
 * SECURITY (AC-7): the previous version returned base64DecodedLen,
 * base64DecodedFirstByteHex, and the first 30 decoded bytes as text — a
 * needless oracle over secret bytes even behind super-admin auth. Removed.
 */
function inspect(label: string, encrypted: string | null | undefined) {
  if (!encrypted) return { label, configured: false, looksValid: false };

  let decoded: string;
  try {
    decoded = isEncryptedValue(encrypted) ? decrypt(encrypted) : encrypted;
  } catch {
    // Stored value is corrupt or was encrypted under a different key.
    return { label, configured: true, looksValid: false };
  }

  let looksValid = false;
  try {
    generateDrGreenSignature("diagnostic", decoded);
    looksValid = true;
  } catch {
    looksValid = false;
  }

  return { label, configured: true, looksValid };
}

export const GET = withSuperAdminParams(async (_req, _ctx, params) => {
  const tenant = await prisma.tenants.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      subdomain: true,
      businessName: true,
      drGreenApiKey: true,
      drGreenSecretKey: true,
      drGreenApiUrl: true,
    },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  return NextResponse.json({
    tenant: {
      id: tenant.id,
      subdomain: tenant.subdomain,
      businessName: tenant.businessName,
      drGreenApiUrl: tenant.drGreenApiUrl,
    },
    apiKey: inspect("apiKey", tenant.drGreenApiKey),
    secretKey: inspect("secretKey", tenant.drGreenSecretKey),
  });
});

export const POST = withSuperAdminParams(async (req, _ctx, params) => {
  const tenant = await prisma.tenants.findUnique({ where: { id: params.id } });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const { apiKey, secretKey } = await req.json();
  const update: { drGreenApiKey?: string; drGreenSecretKey?: string } = {};

  if (secretKey && typeof secretKey === "string" && secretKey.trim() !== "") {
    const normalized = normalizeDrGreenKey(secretKey);
    try {
      generateDrGreenSignature("validation_test", normalized);
    } catch {
      return NextResponse.json(
        { error: "Secret key format invalid — could not produce a signature with the provided value." },
        { status: 400 },
      );
    }
    update.drGreenSecretKey = encrypt(normalized);
  }

  if (apiKey && typeof apiKey === "string" && apiKey.trim() !== "") {
    update.drGreenApiKey = encrypt(normalizeDrGreenKey(apiKey));
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No keys provided" }, { status: 400 });
  }

  await prisma.tenants.update({
    where: { id: tenant.id },
    data: update,
  });

  return NextResponse.json({
    success: true,
    updated: Object.keys(update),
    tenant: { id: tenant.id, subdomain: tenant.subdomain },
  });
});
