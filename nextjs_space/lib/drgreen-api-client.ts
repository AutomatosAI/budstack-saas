interface DrGreenApiOptions {
  method?: 'GET' | 'POST' | 'DELETE' | 'PATCH';
  apiKey: string;
  secretKey: string;
  body?: any;
  signBody?: any; // Body to sign but NOT send (used for GET requests that need body-based signatures)
  queryParams?: Record<string, string | number>; // GET query params — appended to URL and signed
  headers?: Record<string, string>;
  baseUrl?: string;
  validateSuccessFlag?: boolean;
}

const DEFAULT_DOCTOR_GREEN_API_URL =
  process.env.DOCTOR_GREEN_API_URL || 'https://api.drgreennft.com/api/v1';

const isDev = process.env.NODE_ENV === 'development';

/**
 * Generate ECDSA signature for API request.
 * Uses explicit SHA-256 hashing — matches the working consultation submit route
 * and southhealing reference (which does sha256(data) then secp256k1.sign(hash)).
 *
 * crypto.sign(null, ...) was NOT hashing before signing, producing invalid signatures.
 */
function normalizePEM(input: string): string {
  let key = input.trim();

  if (key.includes("-----BEGIN ")) {
    const pemMatch = key.match(/(-----BEGIN [^-]+-----)([\s\S]*?)(-----END [^-]+-----)/);
    if (pemMatch) {
      const header = pemMatch[1];
      const body = pemMatch[2].replace(/\s+/g, "");
      const footer = pemMatch[3];
      const wrapped = body.match(/.{1,64}/g)?.join("\n") || body;
      return `${header}\n${wrapped}\n${footer}`;
    }
    return key;
  }

  try {
    const decoded = Buffer.from(key, "base64").toString("utf-8");
    if (decoded.includes("-----BEGIN ")) {
      return normalizePEM(decoded);
    }
  } catch {
    // Not valid base64
  }

  const cleaned = key.replace(/\s+/g, "");
  const wrapped = cleaned.match(/.{1,64}/g)?.join("\n") || cleaned;
  return `-----BEGIN PRIVATE KEY-----\n${wrapped}\n-----END PRIVATE KEY-----`;
}

export function generateDrGreenSignature(payload: string, secretKey: string): string {
  const crypto = require('crypto');

  const privateKeyPEM = normalizePEM(secretKey);

  const headerMatch = privateKeyPEM.match(/-----BEGIN ([^-]+)-----/);
  if (isDev) console.log(`[DrGreen Signature] PEM type: "${headerMatch?.[1] || "UNKNOWN"}" | len: ${privateKeyPEM.length}`);

  let privateKey;
  try {
    privateKey = crypto.createPrivateKey(privateKeyPEM);
  } catch (keyError: any) {
    console.error(`[DrGreen Signature] createPrivateKey failed: ${keyError.message}`);
    if (privateKeyPEM.includes("BEGIN PRIVATE KEY")) {
      const body = privateKeyPEM.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s+/g, "");
      const ecPEM = `-----BEGIN EC PRIVATE KEY-----\n${body.match(/.{1,64}/g)?.join("\n") || body}\n-----END EC PRIVATE KEY-----`;
      if (isDev) console.log("[DrGreen Signature] Retrying with EC PRIVATE KEY header...");
      privateKey = crypto.createPrivateKey(ecPEM);
    } else {
      throw keyError;
    }
  }

  const sign = crypto.createSign('SHA256');
  sign.update(payload);
  sign.end();

  return sign.sign(privateKey).toString('base64');
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
    queryParams,
    headers = {},
    baseUrl = DEFAULT_DOCTOR_GREEN_API_URL,
    validateSuccessFlag = false,
  } = options;

  // Build query string from queryParams if provided
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
  const maskedKey = apiKey ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : 'MISSING';
  const hasSecret = !!secretKey;

  // TEMP DEBUG — fingerprint keys so we can verify correct keys on Railway
  const crypto2 = require('crypto');
  const apiKeyHash = apiKey ? crypto2.createHash('sha256').update(apiKey).digest('hex').slice(0, 12) : 'NONE';
  const secretHash = secretKey ? crypto2.createHash('sha256').update(secretKey).digest('hex').slice(0, 12) : 'NONE';
  console.error(`[DrGreen API] >>> ${method} ${fullUrl} | keyHash: ${apiKeyHash} | secretHash: ${secretHash} | secretLen: ${secretKey?.length || 0}`);

  if (!apiKey || !secretKey) {
    console.error(`[DrGreen API] MISSING_CREDENTIALS — apiKey: ${!!apiKey}, secretKey: ${!!secretKey}`);
    throw new Error('MISSING_CREDENTIALS');
  }

  const payload = body
    ? (typeof body === 'string' ? body : JSON.stringify(body))
    : '';

  if (isDev && body) {
    console.log(`[DrGreen API]   body: ${payload.slice(0, 200)}`);
  }

  // Send API key as-is — the Dr Green API expects the full base64-encoded value
  // (extractPemBody was stripping it from 232→120 chars, causing 401s)
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-auth-apikey': apiKey,
    ...headers,
  };

  // Determine what to sign (matches green-go-remix working pattern):
  // - For GET with queryParams: Sign the query string (e.g. "take=200&page=1&orderBy=desc")
  // - For GET with signBody: Sign the signBody JSON
  // - For GET without either: Sign empty string ""
  // - For POST/PUT/DELETE: Sign the body (JSON string)
  let signaturePayload = '';

  if (method === 'GET' && queryString) {
    // GET with query params — sign the query string (green-go-remix pattern)
    signaturePayload = queryString;
  } else if (method === 'GET' && signBody) {
    signaturePayload = typeof signBody === 'string' ? signBody : JSON.stringify(signBody);
  } else if (method === 'GET') {
    // Standard GET with no params — sign empty string
    signaturePayload = '';
  } else {
    signaturePayload = payload;
  }

  console.error(`[DrGreen API]   signing: "${signaturePayload.slice(0, 100)}" (${signaturePayload.length} chars)`);

  const signature = generateDrGreenSignature(signaturePayload, secretKey);
  requestHeaders['x-auth-signature'] = signature;
  console.error(`[DrGreen API]   sig: ${signature.slice(0, 30)}... (${signature.length} chars)`);
  if (isDev) console.log(`[DrGreen API]   signature: ${signature.slice(0, 20)}... (${signature.length} chars)`);

  const startTime = Date.now();
  const response = await fetch(fullUrl, {
    method,
    headers: requestHeaders,
    body: payload || undefined,
    cache: 'no-store',
  });
  const elapsed = Date.now() - startTime;

  if (isDev) console.log(`[DrGreen API] <<< ${response.status} ${response.statusText} (${elapsed}ms)`);

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

  if (isDev) console.log(`[DrGreen API]   response data: ${JSON.stringify(data).slice(0, 300)}`);

  // Check success flag — handle both string "true" and boolean true
  if (validateSuccessFlag) {
    const successVal = data?.success;
    if (isDev) console.log(`[DrGreen API]   validateSuccessFlag: success=${JSON.stringify(successVal)} (type: ${typeof successVal})`);
    if (successVal !== 'true' && successVal !== true) {
      console.error(`[DrGreen API]   FAILED success check — message: ${data?.message}`);
      throw new Error(data?.message || 'Dr. Green API error');
    }
  }

  return data as T;
}
