/**
 * Dr Green Identity v2 — ID document upload client.
 *
 * Forwards a customer's identity document to Dr Green's storefront upload
 * endpoint (POST /identity/documents) using the tenant's existing
 * apiKey + secp256k1 signature. Budstacks persists nothing about the document.
 *
 * THE SIGNING CRUX: Dr Green's DualAuthGuard verifies a multipart request by
 * re-parsing the form (formidable), rebuilding an object of
 * { ...text fields, file: <Node Buffer> } and signing JSON.stringify(thatObject)
 * — see dr-green-backend src/strategy/daap.jwt.strategy.ts:170-242. So the string
 * we SIGN is NOT the multipart body we TRANSMIT: we must reproduce that exact
 * JSON. Because a Node Buffer serialises as {"type":"Buffer","data":[...]}, this
 * module MUST run on the Node.js runtime — a Uint8Array/Blob would serialise
 * differently and fail verification.
 */
import { generateDrGreenSignature, callDrGreenAPI } from './drgreen/drgreen-api-client';
import { DR_GREEN_SA_COUNTRY_CODE } from './verification-mode';

export type IdentityDocumentType = 'ID' | 'PASSPORT' | 'DRIVING_LICENCE';

export interface DrGreenIdentityConfig {
  apiKey: string;
  secretKey: string;
}

export interface UploadIdentityDocumentParams {
  clientId: string;
  documentType: IdentityDocumentType;
  documentNumber: string;
  file: Buffer;
  mimeType: string;
  fileName?: string;
  config: DrGreenIdentityConfig;
  baseUrl?: string;
}

export interface IdentityDocumentResult {
  id: string;
  documentType: string;
  reviewStatus: string;
  createdAt: string;
}

// CONTRACT: Dr Green identity v2 — POST /identity/documents (multipart/form-data)
const IDENTITY_DOCUMENTS_ENDPOINT = '/identity/documents';

const DEFAULT_DOCTOR_GREEN_API_URL =
  process.env.DOCTOR_GREEN_API_URL ||
  process.env.DRGREEN_API_URL ||
  'https://api.drgreennft.com/api/v1';

const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/pdf': '.pdf',
};

// Mirror Dr Green's server-side limits (identity.service.ts) so the proxy and
// the client can pre-validate before forwarding.
export const IDENTITY_DOCUMENT_TYPES: readonly IdentityDocumentType[] = [
  'ID',
  'PASSPORT',
  'DRIVING_LICENCE',
] as const;

export const ALLOWED_DOCUMENT_MIME_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const;

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Reproduce the EXACT string Dr Green's DualAuthGuard signs for a multipart
 * upload: the text fields in the order they appear in the body, then the file
 * as a Node Buffer, JSON.stringify'd. The file key MUST be last — Dr Green
 * appends files after fields regardless of body order. This is the SIGNED
 * payload, deliberately different from the transmitted multipart body.
 */
export function buildIdentityUploadSignaturePayload(params: {
  clientId: string;
  documentType: string;
  documentNumber: string;
  fileBuffer: Buffer;
}): string {
  if (!Buffer.isBuffer(params.fileBuffer)) {
    // A Uint8Array/Blob would JSON.stringify differently and fail verification.
    throw new Error(
      'buildIdentityUploadSignaturePayload: file must be a Node Buffer',
    );
  }
  // Insertion order MUST match the multipart append order in
  // uploadIdentityDocument: clientId, documentType, documentNumber, then file.
  const formData: Record<string, unknown> = {
    clientId: params.clientId,
    documentType: params.documentType,
    documentNumber: params.documentNumber,
    file: params.fileBuffer,
  };
  return JSON.stringify(formData);
}

export async function uploadIdentityDocument(
  params: UploadIdentityDocumentParams,
): Promise<IdentityDocumentResult> {
  const { clientId, documentType, documentNumber, file, mimeType, fileName, config } =
    params;

  if (!config?.apiKey || !config?.secretKey) {
    throw new Error('MISSING_CREDENTIALS');
  }
  if (!Buffer.isBuffer(file)) {
    throw new Error('uploadIdentityDocument: file must be a Node Buffer');
  }

  // 1) Sign the canonical payload Dr Green will reconstruct and verify.
  const signaturePayload = buildIdentityUploadSignaturePayload({
    clientId,
    documentType,
    documentNumber,
    fileBuffer: file,
  });
  const signature = generateDrGreenSignature(signaturePayload, config.secretKey);

  // 2) Build the multipart body. Append order MUST match the signed object:
  //    clientId, documentType, documentNumber, then file LAST.
  const form = new FormData();
  form.append('clientId', clientId);
  form.append('documentType', documentType);
  form.append('documentNumber', documentNumber);
  form.append(
    'file',
    new Blob([file], { type: mimeType }),
    fileName ?? `document${MIME_EXTENSION[mimeType] ?? ''}`,
  );

  const baseUrl = params.baseUrl || DEFAULT_DOCTOR_GREEN_API_URL;
  const url = `${baseUrl}${IDENTITY_DOCUMENTS_ENDPOINT}`;

  // Do NOT set Content-Type — fetch derives the multipart boundary itself.
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-auth-apikey': config.apiKey,
      'x-auth-signature': signature,
    },
    body: form,
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `Dr Green identity upload failed: ${response.status} ${response.statusText} - ${errorText.slice(0, 300)}`,
    );
  }

  const json = (await response.json()) as { data?: IdentityDocumentResult };
  if (!json?.data?.id) {
    throw new Error('Dr Green identity upload returned an unexpected response shape');
  }
  return json.data;
}

// CONTRACT: Dr Green — create client (design doc §5.0). The other client calls
// in doctor-green-api.ts use this same `/dapp/clients` path; the SA ID path
// adds `verificationType: "ID"` so First-AML/medical are skipped.
const DAPP_CLIENTS_ENDPOINT = '/dapp/clients';

export interface CreateSaIdClientParams {
  firstName: string;
  lastName: string;
  email: string;
  phoneCode: string;
  phoneCountryCode: string;
  contactNumber: string;
  shipping: {
    address1: string;
    address2?: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  config: DrGreenIdentityConfig;
  baseUrl?: string;
}

function extractClientId(response: any): string | undefined {
  const data = response?.data ?? response;
  const nested = data?.data ?? data;
  return (
    nested?.clientId ||
    nested?.client?.id ||
    response?.client?.id ||
    response?.clientId
  );
}

/**
 * Create a South-African client on the ID-upload path: `verificationType: "ID"`
 * + shipping `countryCode: "ZAF"` + NO medicalRecord. Dr Green skips First-AML
 * and the medical questionnaire only when SA_ID_ENABLED is on AND the shipping
 * countryCode is exactly "ZAF" (verification.config.ts). Anything else 400s
 * with "medical record required". Used by the slim ID-upload registration.
 */
export async function createSaIdClient(
  params: CreateSaIdClientParams,
): Promise<{ clientId: string }> {
  const { config } = params;
  if (!config?.apiKey || !config?.secretKey) {
    throw new Error('MISSING_CREDENTIALS');
  }

  const body = {
    firstName: params.firstName,
    lastName: params.lastName,
    email: params.email,
    phoneCode: params.phoneCode,
    phoneCountryCode: params.phoneCountryCode,
    contactNumber: params.contactNumber,
    verificationType: 'ID',
    shipping: {
      ...params.shipping,
      // Map ZA → ZAF: Dr Green only honours the skip for the ISO-3 code.
      countryCode: DR_GREEN_SA_COUNTRY_CODE,
    },
    // No medicalRecord on the ID path.
  };

  const response = await callDrGreenAPI<any>(DAPP_CLIENTS_ENDPOINT, {
    method: 'POST',
    apiKey: config.apiKey,
    secretKey: config.secretKey,
    baseUrl: params.baseUrl,
    body,
  });

  const clientId = extractClientId(response);
  if (!clientId) {
    throw new Error('Failed to create SA ID client: no clientId returned');
  }
  return { clientId };
}
