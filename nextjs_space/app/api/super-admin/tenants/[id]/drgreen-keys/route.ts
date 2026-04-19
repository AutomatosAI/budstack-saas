import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
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
  return value.split(":").length === 3;
}

function inspect(label: string, encrypted: string | null | undefined) {
  if (!encrypted) return { label, stored: false };
  const wasEncrypted = isEncryptedValue(encrypted);
  let decoded: string;
  try {
    decoded = wasEncrypted ? decrypt(encrypted) : encrypted;
  } catch (err) {
    return {
      label,
      stored: true,
      wasEncrypted,
      decryptError: err instanceof Error ? err.message : String(err),
    };
  }

  const trimmed = decoded.trim();
  const startsWithDashes = trimmed.startsWith("-----BEGIN");
  const looksBase64 = /^[A-Za-z0-9+/=\s]+$/.test(trimmed) && trimmed.length > 80;

  let base64DecodedFirstByteHex: string | null = null;
  let base64DecodedAsTextStart: string | null = null;
  let base64DecodedLen: number | null = null;
  try {
    const bytes = Buffer.from(trimmed, "base64");
    base64DecodedLen = bytes.length;
    base64DecodedFirstByteHex = bytes.length > 0 ? bytes[0].toString(16).padStart(2, "0") : null;
    base64DecodedAsTextStart = bytes.toString("utf-8").slice(0, 30);
  } catch {
    // ignore — not valid base64
  }

  // Attempt sign with the stored (decoded) value to see if signer accepts it
  let signerResult: string;
  try {
    generateDrGreenSignature("diagnostic", decoded);
    signerResult = "OK";
  } catch (err) {
    signerResult = err instanceof Error ? err.message : String(err);
  }

  return {
    label,
    stored: true,
    wasEncrypted,
    decodedLength: trimmed.length,
    startsWithDashes,
    looksBase64,
    base64DecodedLen,
    base64DecodedFirstByteHex,
    base64DecodedAsTextStart,
    signerResult,
  };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    } catch (err) {
      const reason = err instanceof Error ? err.message : "could not parse";
      return NextResponse.json(
        { error: `Secret key format invalid: ${reason}` },
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
}
