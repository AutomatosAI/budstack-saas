/**
 * THROWAWAY spike (US-002) — validate the SA ID-upload signing against Dr Green
 * staging end-to-end. NOT shipped and NOT imported anywhere.
 *
 * Prereqs on Dr Green staging: STG_SA_ID_ENABLED=true and a known ZA test
 * client. Then run:
 *
 *   DRG_HOST=https://stage-api.drgreennft.com/api/v1 \
 *   DRG_APIKEY=... DRG_SECRET=... DRG_CLIENT_ID=... DRG_SAMPLE_FILE=./id.jpg \
 *   pnpm exec tsx scripts/_spike/verify-id-upload.ts
 *
 * Expect: 201 PENDING. Sanity checks: a text file → 400; flag off → 403.
 */
import { readFileSync } from "fs";

import { uploadIdentityDocument } from "../../lib/drgreen-identity";

function mimeFor(path: string): string {
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".pdf")) return "application/pdf";
  return "image/jpeg";
}

async function main() {
  const { DRG_HOST, DRG_APIKEY, DRG_SECRET, DRG_CLIENT_ID, DRG_SAMPLE_FILE } =
    process.env;

  if (!DRG_APIKEY || !DRG_SECRET || !DRG_CLIENT_ID || !DRG_SAMPLE_FILE) {
    throw new Error(
      "Set DRG_APIKEY, DRG_SECRET, DRG_CLIENT_ID, DRG_SAMPLE_FILE (and optionally DRG_HOST).",
    );
  }

  const file = readFileSync(DRG_SAMPLE_FILE);

  const result = await uploadIdentityDocument({
    clientId: DRG_CLIENT_ID,
    documentType: "ID",
    documentNumber: "SPIKE-TEST-001",
    file,
    mimeType: mimeFor(DRG_SAMPLE_FILE),
    config: { apiKey: DRG_APIKEY, secretKey: DRG_SECRET },
    baseUrl: DRG_HOST,
  });

  console.log("✅ Upload accepted by Dr Green:", JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("❌ Upload failed:", err?.message || err);
  process.exit(1);
});
