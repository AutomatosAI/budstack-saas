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
  process.env.DOCTOR_GREEN_API_URL || 'https://stage-api.drgreennft.com/api/v1';

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

  if (method !== 'GET' && payload) {
    requestHeaders['x-auth-signature'] = generateDrGreenSignature(payload, secretKey);
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
