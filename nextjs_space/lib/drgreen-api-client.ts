interface DrGreenApiOptions {
  method?: 'GET' | 'POST' | 'DELETE' | 'PATCH';
  apiKey: string;
  secretKey: string;
  body?: any;
  headers?: Record<string, string>;
  baseUrl?: string;
  validateSuccessFlag?: boolean;
}

const DEFAULT_DOCTOR_GREEN_API_URL =
  process.env.DOCTOR_GREEN_API_URL || 'https://api.drgreennft.com/api/v1';

/**
 * Extract inner key body from a Base64-encoded PEM string.
 * Dr Green API expects the raw key content (e.g., "MFYwEAYH...")
 * not the full PEM wrapper ("-----BEGIN PUBLIC KEY-----\nMFYw...\n-----END...")
 */
function extractPemBody(base64EncodedKey: string): string {
  try {
    const decoded = Buffer.from(base64EncodedKey, 'base64').toString('utf-8');
    if (decoded.includes('-----BEGIN')) {
      const body = decoded
        .replace(/-----BEGIN [A-Z0-9 ]+-----/g, '')
        .replace(/-----END [A-Z0-9 ]+-----/g, '')
        .replace(/[\r\n\s]/g, '')
        .trim();
      return body;
    }
  } catch {
    // Not base64-encoded, return as-is
  }
  return base64EncodedKey;
}

/**
 * Generate ECDSA signature for API request (using Node.js crypto)
 */
export function generateDrGreenSignature(payload: string, secretKey: string): string {
  const crypto = require('crypto');

  let privateKeyPEM = secretKey;
  if (!secretKey.includes('BEGIN PRIVATE KEY')) {
    try {
      privateKeyPEM = Buffer.from(secretKey, 'base64').toString('utf-8');
    } catch (error) {
      // Keep original key if not base64-encoded.
    }
  }

  const sign = crypto.createSign('SHA256');
  sign.update(payload);
  sign.end();

  return sign.sign(privateKeyPEM).toString('base64');
}

/**
 * Make authenticated request to Dr. Green API
 */
export async function callDrGreenAPI<T>(
  endpoint: string,
  options: DrGreenApiOptions
): Promise<T> {
  const {
    method = 'GET',
    apiKey,
    secretKey,
    body,
    headers = {},
    baseUrl = DEFAULT_DOCTOR_GREEN_API_URL,
    validateSuccessFlag = false,
  } = options;

  const fullUrl = `${baseUrl}${endpoint}`;
  const maskedKey = apiKey ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : 'MISSING';
  const hasSecret = !!secretKey;

  console.log(`[DrGreen API] >>> ${method} ${fullUrl}`);
  console.log(`[DrGreen API]   apiKey: ${maskedKey} | hasSecret: ${hasSecret} | baseUrl: ${baseUrl}`);

  if (!apiKey || !secretKey) {
    console.error(`[DrGreen API] MISSING_CREDENTIALS — apiKey: ${!!apiKey}, secretKey: ${!!secretKey}`);
    throw new Error('MISSING_CREDENTIALS');
  }

  const payload = body
    ? (typeof body === 'string' ? body : JSON.stringify(body))
    : '';

  if (body) {
    console.log(`[DrGreen API]   body: ${payload.slice(0, 200)}`);
  }

  // Extract inner key from PEM wrapper if API key is base64-encoded PEM
  const processedApiKey = extractPemBody(apiKey);
  console.log(`[DrGreen API]   apiKey processed: original=${apiKey.length}chars → extracted=${processedApiKey.length}chars (prefix: ${processedApiKey.slice(0, 12)}...)`);

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-auth-apikey': processedApiKey,
    ...headers,
  };

  // Determine what to sign:
  // - For GET: Sign empty JSON object "{}" (per Dr Green API docs)
  // - For POST/PUT/DELETE: Sign the body (JSON string)
  let signaturePayload = '';

  if (method === 'GET') {
    // Dr Green API requires GET requests to sign an empty object "{}"
    // Reference: southhealing drGreenRequestGet() implementation
    signaturePayload = '{}';
  } else {
    signaturePayload = payload;
  }

  console.log(`[DrGreen API]   signing: "${signaturePayload.slice(0, 100)}${signaturePayload.length > 100 ? '...' : ''}" (${signaturePayload.length} chars)`);

  const signature = generateDrGreenSignature(signaturePayload, secretKey);
  requestHeaders['x-auth-signature'] = signature;
  console.log(`[DrGreen API]   signature: ${signature.slice(0, 20)}... (${signature.length} chars)`);

  const startTime = Date.now();
  const response = await fetch(fullUrl, {
    method,
    headers: requestHeaders,
    body: payload || undefined,
    cache: 'no-store',
  });
  const elapsed = Date.now() - startTime;

  console.log(`[DrGreen API] <<< ${response.status} ${response.statusText} (${elapsed}ms)`);

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    let errorData: any = {};
    try { errorData = JSON.parse(errorText); } catch { /* not JSON */ }
    console.error(`[DrGreen API] ERROR response body: ${errorText.slice(0, 500)}`);
    console.error(`[DrGreen API] ERROR response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`);
    throw new Error(
      `Doctor Green API Error: ${response.status} ${response.statusText} - ${errorText.slice(0, 500)}`
    );
  }

  const responseText = await response.text();
  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch {
    console.error(`[DrGreen API] Non-JSON response: ${responseText.slice(0, 200)}`);
    throw new Error(`Doctor Green API returned non-JSON response: ${responseText.slice(0, 200)}`);
  }

  console.log(`[DrGreen API]   response data: ${JSON.stringify(data).slice(0, 300)}`);

  // Check success flag — handle both string "true" and boolean true
  if (validateSuccessFlag) {
    const successVal = data?.success;
    console.log(`[DrGreen API]   validateSuccessFlag: success=${JSON.stringify(successVal)} (type: ${typeof successVal})`);
    if (successVal !== 'true' && successVal !== true) {
      console.error(`[DrGreen API]   FAILED success check — message: ${data?.message}`);
      throw new Error(data?.message || 'Dr. Green API error');
    }
  }

  return data as T;
}
