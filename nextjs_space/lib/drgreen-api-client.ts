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

  if (!apiKey || !secretKey) {
    throw new Error('MISSING_CREDENTIALS');
  }

  const payload = body
    ? (typeof body === 'string' ? body : JSON.stringify(body))
    : '';
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-auth-apikey': apiKey,
    ...headers,
  };

  // Determine what to sign:
  // - For GET: Sign the query string (e.g., "countryCode=GBR&page=1")
  // - For POST/PUT/DELETE: Sign the body (JSON string)
  let signaturePayload = '';

  if (method === 'GET') {
    // Extract query string from endpoint (e.g., "/strains?country=GBR" -> "country=GBR")
    const parts = endpoint.split('?');
    if (parts.length > 1) {
      signaturePayload = parts[1];
    }
  } else {
    // For non-GET, sign the body
    signaturePayload = payload;
  }

  // Always generate signature if there is something to sign, or if strict mode requires it
  // Note: Even empty GET query strings might strictly require a signature of empty string? 
  // Findings say "Sign the query string". If empty, maybe not?
  // Let's assume we sign if there is a payload OR if it is a query string interaction.
  // Actually, easiest is: Always add signature if we have a payload string (which includes query string now).

  if (signaturePayload || method !== 'GET') {
    // For POST even with empty body, we sign empty string? 
    // Legacy code said: `if (method !== 'GET' && payload)`. 
    // Let's stick to signing whatever our payload target is.
    requestHeaders['x-auth-signature'] = generateDrGreenSignature(signaturePayload, secretKey);
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: requestHeaders,
    body: payload || undefined,
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Doctor Green API Error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
    );
  }

  const data = await response.json();

  if (validateSuccessFlag && data?.success !== 'true') {
    throw new Error(data?.message || 'Dr. Green API error');
  }

  return data as T;
}
