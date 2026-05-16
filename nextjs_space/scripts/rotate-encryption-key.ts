/**
 * Rotates ENCRYPTION_KEY for all encrypted columns.
 *
 * Decrypts each ciphertext with OLD_ENCRYPTION_KEY, re-encrypts with NEW_ENCRYPTION_KEY,
 * and writes back. Idempotent: rows already in new format are skipped.
 *
 * Usage:
 *   # Dry-run (no writes; prints what would change)
 *   OLD_ENCRYPTION_KEY=<old> NEW_ENCRYPTION_KEY=<new> \
 *     npx tsx scripts/rotate-encryption-key.ts
 *
 *   # Confirm mode (actually writes)
 *   OLD_ENCRYPTION_KEY=<old> NEW_ENCRYPTION_KEY=<new> \
 *     npx tsx scripts/rotate-encryption-key.ts --confirm
 *
 * Encrypted columns processed:
 *   - tenants.drGreenApiKey (string)
 *   - tenants.drGreenSecretKey (string)
 *   - tenants.settings.smtp.password (JSON nested)
 *   - platform_config.awsAccessKeyId (string)
 *   - platform_config.awsSecretAccessKey (string)
 *   - platform_config.emailServer (string)
 *   - platform_config.redisUrl (string)
 *
 * Mirrors lib/encryption.ts crypto exactly:
 *   - AES-256-GCM
 *   - scrypt KDF with fixed salt 'budstack-encryption-v2'
 *   - v2 prefix format: v2:iv:authTag:ciphertext
 */

import * as crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const ALGORITHM = 'aes-256-gcm';
const APP_SALT = Buffer.from('budstack-encryption-v2', 'utf8');

function deriveKey(rawKey: string): Buffer {
  return crypto.scryptSync(rawKey, APP_SALT, 32, { N: 16384, r: 8, p: 1 });
}

function deriveLegacyKey(rawKey: string): Buffer {
  return crypto.createHash('sha256').update(String(rawKey)).digest();
}

function encryptWith(rawKey: string, text: string): string {
  if (!text) return '';
  const key = deriveKey(rawKey);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `v2:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decryptWith(rawKey: string, text: string): string {
  if (!text) return '';
  const parts = text.split(':');
  const isV2 = parts[0] === 'v2';
  const expected = isV2 ? 4 : 3;
  if (parts.length !== expected) {
    throw new Error(`Ciphertext format invalid (expected ${expected} parts, got ${parts.length})`);
  }
  const [ivHex, authTagHex, encryptedHex] = isV2 ? parts.slice(1) : parts;
  const key = isV2 ? deriveKey(rawKey) : deriveLegacyKey(rawKey);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

type Result = {
  table: string;
  pk: string;
  column: string;
  status: 'rotated' | 'already-new' | 'empty' | 'error';
  error?: string;
};

const OLD = process.env.OLD_ENCRYPTION_KEY;
const NEW = process.env.NEW_ENCRYPTION_KEY;
const CONFIRM = process.argv.includes('--confirm');

if (!OLD || !NEW) {
  console.error('OLD_ENCRYPTION_KEY and NEW_ENCRYPTION_KEY must both be set.');
  process.exit(1);
}

if (OLD === NEW) {
  console.error('OLD_ENCRYPTION_KEY and NEW_ENCRYPTION_KEY are identical; nothing to do.');
  process.exit(1);
}

if (NEW.length < 32) {
  console.error('NEW_ENCRYPTION_KEY must be at least 32 characters.');
  process.exit(1);
}

const prisma = new PrismaClient();

async function rotateColumn(
  table: string,
  pk: string,
  column: string,
  current: string | null | undefined
): Promise<Result> {
  if (!current || current.trim() === '') {
    return { table, pk, column, status: 'empty' };
  }

  // Idempotency check: if already decryptable with NEW key, skip.
  try {
    decryptWith(NEW!, current);
    return { table, pk, column, status: 'already-new' };
  } catch {
    // proceed with rotation
  }

  let plaintext: string;
  try {
    plaintext = decryptWith(OLD!, current);
  } catch (e: any) {
    return { table, pk, column, status: 'error', error: `decrypt-old-failed: ${e.message}` };
  }

  const newCipher = encryptWith(NEW!, plaintext);

  if (CONFIRM) {
    if (table === 'tenants') {
      await prisma.tenants.update({ where: { id: pk }, data: { [column]: newCipher } });
    } else if (table === 'platform_config') {
      await prisma.platform_config.update({ where: { id: pk }, data: { [column]: newCipher } });
    }
  }

  return { table, pk, column, status: 'rotated' };
}

async function rotateNestedSmtp(
  pk: string,
  settings: Record<string, any> | null
): Promise<Result> {
  const current = settings?.smtp?.password;
  if (!current || typeof current !== 'string' || current.trim() === '') {
    return { table: 'tenants', pk, column: 'settings.smtp.password', status: 'empty' };
  }

  try {
    decryptWith(NEW!, current);
    return { table: 'tenants', pk, column: 'settings.smtp.password', status: 'already-new' };
  } catch {
    // continue
  }

  let plaintext: string;
  try {
    plaintext = decryptWith(OLD!, current);
  } catch (e: any) {
    return {
      table: 'tenants',
      pk,
      column: 'settings.smtp.password',
      status: 'error',
      error: `decrypt-old-failed: ${e.message}`,
    };
  }

  const newCipher = encryptWith(NEW!, plaintext);
  const newSettings = {
    ...settings,
    smtp: {
      ...(settings?.smtp || {}),
      password: newCipher,
    },
  };

  if (CONFIRM) {
    await prisma.tenants.update({
      where: { id: pk },
      data: { settings: newSettings },
    });
  }

  return { table: 'tenants', pk, column: 'settings.smtp.password', status: 'rotated' };
}

async function main() {
  const mode = CONFIRM ? 'CONFIRM (will write)' : 'DRY-RUN (no writes)';
  console.log(`\nENCRYPTION_KEY rotation — ${mode}\n`);

  const results: Result[] = [];

  // tenants table
  const tenants = await prisma.tenants.findMany({
    select: { id: true, drGreenApiKey: true, drGreenSecretKey: true, settings: true },
  });

  console.log(`Scanning ${tenants.length} tenant rows...`);

  for (const t of tenants) {
    results.push(await rotateColumn('tenants', t.id, 'drGreenApiKey', t.drGreenApiKey));
    results.push(await rotateColumn('tenants', t.id, 'drGreenSecretKey', t.drGreenSecretKey));
    results.push(await rotateNestedSmtp(t.id, t.settings as Record<string, any> | null));
  }

  // platform_config table
  const configs = await prisma.platform_config.findMany();
  console.log(`Scanning ${configs.length} platform_config rows...`);

  for (const c of configs) {
    results.push(await rotateColumn('platform_config', c.id, 'awsAccessKeyId', c.awsAccessKeyId));
    results.push(
      await rotateColumn('platform_config', c.id, 'awsSecretAccessKey', c.awsSecretAccessKey)
    );
    results.push(await rotateColumn('platform_config', c.id, 'emailServer', c.emailServer));
    results.push(await rotateColumn('platform_config', c.id, 'redisUrl', c.redisUrl));
  }

  // Summary
  const counts = results.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log('\n=== Summary ===');
  console.log(`  rotated:     ${counts.rotated || 0}`);
  console.log(`  already-new: ${counts['already-new'] || 0}`);
  console.log(`  empty:       ${counts.empty || 0}`);
  console.log(`  error:       ${counts.error || 0}`);

  const errors = results.filter((r) => r.status === 'error');
  if (errors.length > 0) {
    console.log('\n=== Errors ===');
    for (const e of errors) {
      console.log(`  [${e.table}] pk=${e.pk} column=${e.column} — ${e.error}`);
    }
  }

  if (!CONFIRM && counts.rotated) {
    console.log('\nDry-run only. Re-run with --confirm to apply.');
  } else if (CONFIRM && counts.rotated) {
    console.log('\nRotation complete. Verify with smoke test before deploying NEW_ENCRYPTION_KEY to production.');
  }

  await prisma.$disconnect();

  if (errors.length > 0) process.exit(2);
}

main().catch(async (e) => {
  console.error('Fatal:', e);
  await prisma.$disconnect();
  process.exit(1);
});
