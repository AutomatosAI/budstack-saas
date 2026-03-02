/**
 * Dr Green API Client
 *
 * Signing copied from healingbudstacks/supabase/functions/drgreen-proxy/index.ts
 * Uses @noble/secp256k1 + @noble/hashes — same libraries, same versions.
 */
import * as secp256k1 from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { hmac } from '@noble/hashes/hmac';

// Required for noble secp256k1 signing — copied from template line 10-14
secp256k1.etc.hmacSha256Sync = (key: Uint8Array, ...messages: Uint8Array[]) => {
  const h = hmac.create(sha256, key);
  for (const msg of messages) h.update(msg);
  return h.digest();
};

interface DrGreenApiOptions {
  method?: 'GET' | 'POST' | 'DELETE' | 'PATCH';
  apiKey: string;
  secretKey: string;
  body?: any;
  signBody?: any;
  queryParams?: Record<string, string | number>;
  headers?: Record<string, string>;
  baseUrl?: string;
  validateSuccessFlag?: boolean;
}

const DEFAULT_DOCTOR_GREEN_API_URL =
  process.env.DOCTOR_GREEN_API_URL || process.env.DRGREEN_API_URL || 'https://api.drgreennft.com/api/v1';

const isDev = process.env.NODE_ENV === 'development';

// ── Signing — copied from template drgreen-proxy/index.ts ──

function cleanBase64(base64: string): string {
  let cleaned = (base64 || '').replace(/[\s\r\n"']/g, '').trim();
  cleaned = cleaned.replace(/-/g, '+').replace(/_/g, '/');
  const paddingNeeded = (4 - (cleaned.length % 4)) % 4;
  if (paddingNeeded > 0 && paddingNeeded < 4) {
    cleaned += '='.repeat(paddingNeeded);
  }
  return cleaned;
}

function base64ToBytes(base64: string): Uint8Array {
  const cleaned = cleanBase64(base64);
  if (!cleaned) throw new Error('Empty Base64 string');
  const binary = Buffer.from(cleaned, 'base64');
  return new Uint8Array(binary);
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function isBase64(str: string): boolean {
  const cleaned = cleanBase64(str);
  if (!cleaned || cleaned.length === 0) return false;
  return /^[A-Za-z0-9+/]*=*$/.test(cleaned);
}

/**
 * Extract raw 32-byte private key from PKCS#8 or SEC1 DER
 * Copied from template drgreen-proxy/index.ts lines 446-550
 */
function extractSecp256k1PrivateKey(derBytes: Uint8Array): Uint8Array {
  let offset = 0;

  function readLength(): number {
    const firstByte = derBytes[offset++];
    if (firstByte < 0x80) return firstByte;
    const numBytes = firstByte & 0x7f;
    let length = 0;
    for (let i = 0; i < numBytes; i++) {
      length = (length << 8) | derBytes[offset++];
    }
    return length;
  }

  function readInteger(): { value: number; rawBytes: Uint8Array } {
    if (derBytes[offset++] !== 0x02) throw new Error('Expected INTEGER');
    const len = readLength();
    const raw = derBytes.slice(offset, offset + len);
    let value = 0;
    for (let i = 0; i < len; i++) value = (value << 8) | derBytes[offset + i];
    offset += len;
    return { value, rawBytes: raw };
  }

  // Outer SEQUENCE
  if (derBytes[offset++] !== 0x30) throw new Error('Expected SEQUENCE');
  readLength();

  if (derBytes.length === 32) return derBytes;

  const nextTag = derBytes[offset];

  if (nextTag === 0x02) {
    const version = readInteger();

    if (version.value === 1) {
      // SEC1 format
      if (derBytes[offset++] !== 0x04) throw new Error('Expected OCTET STRING');
      const keyLen = readLength();
      if (keyLen !== 32) throw new Error(`Expected 32-byte key, got ${keyLen}`);
      return derBytes.slice(offset, offset + 32);
    } else if (version.value === 0) {
      // PKCS#8 format
      if (derBytes[offset++] !== 0x30) throw new Error('Expected SEQUENCE (algorithm)');
      const algLen = readLength();
      offset += algLen;
      if (derBytes[offset++] !== 0x04) throw new Error('Expected OCTET STRING');
      readLength();
      if (derBytes[offset++] !== 0x30) throw new Error('Expected SEQUENCE (SEC1)');
      readLength();
      if (derBytes[offset++] !== 0x02) throw new Error('Expected INTEGER (SEC1 version)');
      const sec1VersionLen = readLength();
      offset += sec1VersionLen;
      if (derBytes[offset++] !== 0x04) throw new Error('Expected OCTET STRING (private key)');
      const keyLen = readLength();
      if (keyLen !== 32) throw new Error(`Expected 32-byte key, got ${keyLen}`);
      return derBytes.slice(offset, offset + 32);
    } else {
      throw new Error(`Unexpected key version: ${version.value}`);
    }
  }

  if (nextTag === 0x04) {
    offset++;
    const keyLen = readLength();
    if (keyLen === 32) return derBytes.slice(offset, offset + 32);
  }

  throw new Error(`Unsupported key format. Tag: 0x${nextTag.toString(16)}, DER length: ${derBytes.length}`);
}

/**
 * Generate secp256k1 ECDSA signature — copied from template lines 556-703
 */
export function generateDrGreenSignature(payload: string, base64PrivateKey: string): string {
  const secret = (base64PrivateKey || '').trim();

  // Step 1: Base64 decode
  const decodedSecretBytes = base64ToBytes(secret);

  // Step 2: Detect PEM and extract DER
  const decodedAsText = Buffer.from(decodedSecretBytes).toString('utf-8');
  let keyDerBytes: Uint8Array;

  const isPem = decodedAsText.includes('-----BEGIN') ||
    decodedAsText.includes('BEGIN') ||
    (decodedSecretBytes.length >= 2 && decodedSecretBytes[0] === 0x2D && decodedSecretBytes[1] === 0x2D);

  function extractPemBase64Body(text: string): string {
    return text
      .replace(/-----BEGIN [A-Z0-9 ]+-----/g, '')
      .replace(/-----END [A-Z0-9 ]+-----/g, '')
      .replace(/-{2,}[^\n]*\n?/g, '')
      .replace(/[\r\n\s]/g, '')
      .trim();
  }

  if (isPem) {
    const pemBody = extractPemBase64Body(decodedAsText);
    if (!pemBody || !isBase64(pemBody)) throw new Error('Invalid private key PEM format');
    keyDerBytes = base64ToBytes(pemBody);
  } else if (decodedSecretBytes.length >= 150 && decodedSecretBytes.length <= 500) {
    const pemBody = extractPemBase64Body(decodedAsText);
    if (pemBody && isBase64(pemBody)) {
      keyDerBytes = base64ToBytes(pemBody);
    } else {
      keyDerBytes = decodedSecretBytes;
    }
  } else {
    keyDerBytes = decodedSecretBytes;
  }

  // Step 3: Extract 32-byte private key
  const privateKeyBytes = extractSecp256k1PrivateKey(keyDerBytes);

  // Step 4: SHA-256 hash the data and sign with secp256k1
  const dataBytes = new TextEncoder().encode(payload);
  const messageHash = sha256(dataBytes);
  const signature = secp256k1.sign(messageHash, privateKeyBytes);

  // Step 5: Convert compact (r || s) to DER — copied from template lines 660-695
  const compactSig = signature.toCompactRawBytes();
  const r = compactSig.slice(0, 32);
  const s = compactSig.slice(32, 64);

  function integerToDER(val: Uint8Array): Uint8Array {
    let start = 0;
    while (start < val.length - 1 && val[start] === 0) start++;
    const trimmed = val.slice(start);
    const needsPadding = trimmed[0] >= 0x80;
    const result = new Uint8Array((needsPadding ? 1 : 0) + trimmed.length);
    if (needsPadding) result[0] = 0x00;
    result.set(trimmed, needsPadding ? 1 : 0);
    return result;
  }

  const rDer = integerToDER(r);
  const sDer = integerToDER(s);
  const innerLen = 2 + rDer.length + 2 + sDer.length;
  const derSig = new Uint8Array(2 + innerLen);
  derSig[0] = 0x30;
  derSig[1] = innerLen;
  derSig[2] = 0x02;
  derSig[3] = rDer.length;
  derSig.set(rDer, 4);
  derSig[4 + rDer.length] = 0x02;
  derSig[5 + rDer.length] = sDer.length;
  derSig.set(sDer, 6 + rDer.length);

  return bytesToBase64(derSig);
}

// ── API request function ──

export async function callDrGreenAPI<T>(
  endpoint: string,
  options: DrGreenApiOptions
): Promise<T> {
  const {
    method = 'GET',
    apiKey,
    secretKey,
    body,
    signBody,
    queryParams,
    headers = {},
    baseUrl = DEFAULT_DOCTOR_GREEN_API_URL,
    validateSuccessFlag = false,
  } = options;

  let queryString = '';
  if (queryParams && Object.keys(queryParams).length > 0) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    }
    queryString = params.toString();
  }

  const fullUrl = queryString
    ? `${baseUrl}${endpoint}?${queryString}`
    : `${baseUrl}${endpoint}`;

  if (isDev) console.log(`[DrGreen API] >>> ${method} ${fullUrl}`);

  if (!apiKey || !secretKey) {
    throw new Error('MISSING_CREDENTIALS');
  }

  const payload = body
    ? (typeof body === 'string' ? body : JSON.stringify(body))
    : '';

  // Headers — same as template: Content-Type + x-auth-apikey + x-auth-signature
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-auth-apikey': apiKey,
    ...headers,
  };

  // What to sign — matches template drGreenRequestBody / drGreenRequestGet
  let signaturePayload = '';
  if (method === 'GET' && queryString) {
    signaturePayload = queryString;
  } else if (method === 'GET' && signBody) {
    signaturePayload = typeof signBody === 'string' ? signBody : JSON.stringify(signBody);
  } else if (method === 'GET') {
    signaturePayload = '';
  } else {
    // POST/PATCH/DELETE — sign the body (template: drGreenRequestBody signs JSON.stringify(body))
    signaturePayload = payload;
  }

  const signature = generateDrGreenSignature(signaturePayload, secretKey);
  requestHeaders['x-auth-signature'] = signature;

  const startTime = Date.now();
  const response = await fetch(fullUrl, {
    method,
    headers: requestHeaders,
    body: method !== 'GET' ? (payload || undefined) : undefined,
    cache: 'no-store',
  });
  const elapsed = Date.now() - startTime;

  if (isDev) console.log(`[DrGreen API] <<< ${response.status} ${response.statusText} (${elapsed}ms)`);

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error(`[DrGreen API] ERROR ${method} ${endpoint}: ${response.status} — ${errorText.slice(0, 300)}`);
    throw new Error(
      `Doctor Green API Error: ${response.status} ${response.statusText} - ${errorText.slice(0, 500)}`
    );
  }

  const responseText = await response.text();
  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(`Doctor Green API returned non-JSON response: ${responseText.slice(0, 200)}`);
  }

  if (validateSuccessFlag) {
    const successVal = data?.success;
    if (successVal !== 'true' && successVal !== true) {
      throw new Error(data?.message || 'Dr. Green API error');
    }
  }

  return data as T;
}
