/**
 * Read-only audit: classifies every tenant's stored drGreenSecretKey by
 * encryption shape so the team can confirm 100% v2 coverage BEFORE retiring the
 * `allowUnencryptedMigration: true` fail-open window in the three Dr Green
 * webhook routes (PRD-211 US-008 AC-4a).
 *
 * Classification is shape-only (isEncryptedValue + the `v2:` prefix). It NEVER
 * decrypts and NEVER prints a secret value — only the tenant id/subdomain and
 * its class. Needs no ENCRYPTION_KEY.
 *
 * Usage:
 *   npx tsx scripts/audit-drgreen-keys.ts
 *
 * Exit code: 0 when every stored key is v2; 1 when any legacy/plaintext key
 * remains (so it can gate a CI/ops check).
 */

import { PrismaClient } from "@prisma/client";
import { isEncryptedValue } from "../lib/security/encryption";

const prisma = new PrismaClient();

type KeyClass = "v2" | "legacy" | "plaintext" | "unset";

function classify(secret: string | null | undefined): KeyClass {
  if (!secret) return "unset";
  if (!isEncryptedValue(secret)) return "plaintext";
  return secret.startsWith("v2:") ? "v2" : "legacy";
}

async function main() {
  const tenants = await prisma.tenants.findMany({
    select: { id: true, subdomain: true, drGreenSecretKey: true },
  });

  const counts: Record<KeyClass, number> = {
    v2: 0,
    legacy: 0,
    plaintext: 0,
    unset: 0,
  };
  const nonV2: Array<{ id: string; subdomain: string; cls: KeyClass }> = [];

  for (const t of tenants) {
    const cls = classify(t.drGreenSecretKey);
    counts[cls] += 1;
    if (cls === "legacy" || cls === "plaintext") {
      nonV2.push({ id: t.id, subdomain: t.subdomain, cls });
    }
  }

  console.log("\n=== drGreenSecretKey encryption audit ===");
  console.log(`tenants scanned : ${tenants.length}`);
  console.log(`v2 (secure)     : ${counts.v2}`);
  console.log(`legacy (3-part) : ${counts.legacy}`);
  console.log(`plaintext       : ${counts.plaintext}`);
  console.log(`unset (no key)  : ${counts.unset}`);

  if (nonV2.length > 0) {
    console.log("\n=== NON-V2 KEYS (re-encrypt before retiring migration) ===");
    for (const row of nonV2) {
      // Never log the secret itself — id/subdomain/class only.
      console.log(`  [${row.cls}] ${row.subdomain} (${row.id})`);
    }
  }

  await prisma.$disconnect();

  if (nonV2.length > 0) {
    console.error(
      `\n✗ ${nonV2.length} tenant(s) still hold a non-v2 drGreenSecretKey — do NOT remove allowUnencryptedMigration yet.`,
    );
    process.exit(1);
  }

  console.log("\n✓ All stored drGreenSecretKey values are v2-encrypted.");
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
