interface DrGreenApiOptions {
  method?: 'GET' | 'POST' | 'DELETE' | 'PATCH';
  apiKey: string;
  secretKey: string;
  body?: any;
  signBody?: any; // Body to sign but NOT send (used for GET requests that need body-based signatures)
  headers?: Record<string, string>;
  baseUrl?: string;
  validateSuccessFlag?: boolean;
}

const DEFAULT_DOCTOR_GREEN_API_URL =
  process.env.DOCTOR_GREEN_API_URL || 'https://api.drgreennft.com/api/v1';

/**
 * Generate signature for API request (matching Dr Green docs pattern exactly)
 *
 * From Dr Green API docs (via southhealing reference):
 *   const privateKeyBuffer = Buffer.from(secretKey, 'base64');
 *   const privateKeyObject = crypto.createPrivateKey(privateKeyBuffer);
 *   const signature = crypto.sign(null, Buffer.from(payload), privateKeyObject);
 *   const signatureBase64 = signature.toString('base64');
 */
export function generateDrGreenSignature(payload: string, secretKey: string): string {
  const crypto = require('crypto');

  // Step 1: Base64 decode the secret key to get raw bytes (PEM or DER)
  const privateKeyBuffer = Buffer.from(secretKey, 'base64');

  // Step 2: Create a KeyObject from the buffer
  // crypto.createPrivateKey auto-detects PEM vs DER format
  const privateKeyObject = crypto.createPrivateKey(privateKeyBuffer);

  // Step 3: Sign with null algorithm (let the key decide)
  // This matches the Dr Green docs pattern exactly
  const signature = crypto.sign(null, Buffer.from(payload), privateKeyObject);

  return signature.toString('base64');
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
    signBody,
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

  // Send API key as-is — the Dr Green API expects the full base64-encoded value
  // (extractPemBody was stripping it from 232→120 chars, causing 401s)
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-auth-apikey': apiKey,
    ...headers,
  };

  // Determine what to sign:
  // - For GET with signBody: Sign the signBody JSON (e.g. {"clientId":"..."}) — per southhealing get-client pattern
  // - For GET without signBody: Sign empty JSON object "{}" — per southhealing drGreenRequestGet() for list endpoints
  // - For POST/PUT/DELETE: Sign the body (JSON string)
  let signaturePayload = '';

  if (method === 'GET' && signBody) {
    // GET with explicit sign body (e.g. fetchClient signs {"clientId":"..."} but doesn't send it)
    signaturePayload = typeof signBody === 'string' ? signBody : JSON.stringify(signBody);
  } else if (method === 'GET') {
    // Standard GET — sign empty object
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
