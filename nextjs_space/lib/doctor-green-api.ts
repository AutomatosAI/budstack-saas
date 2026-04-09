/**
 * Doctor Green API Integration
 * Two-layer security: API key + ECDSA cryptographic signature
 */

import { callDrGreenAPI } from '@/lib/drgreen-api-client';
import { convertFromEUR } from '@/lib/exchange-rates';

const API_URL = process.env.DOCTOR_GREEN_API_URL || 'https://api.drgreennft.com/api/v1';

// Currency mapping by country code
const CURRENCY_MAP: Record<string, string> = {
  PT: "EUR",
  ES: "EUR",
  FR: "EUR",
  DE: "EUR",
  IT: "EUR",
  NL: "EUR",
  BE: "EUR",
  AT: "EUR",
  IE: "EUR",
  GR: "EUR",
  ZA: "ZAR",
  SA: "SAR",
  UK: "GBP",
  GB: "GBP",
  US: "USD",
  CA: "CAD",
  AU: "AUD",
  NZ: "NZD",
  CH: "CHF",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  PL: "PLN",
  CZ: "CZK",
  IL: "ILS",
  BR: "BRL",
  MX: "MXN",
  AR: "ARS",
  CL: "CLP",
  CO: "COP",
  TH: "THB",
  MY: "MYR",
  SG: "SGD",
  IN: "INR",
  PK: "PKR",
  PH: "PHP",
  ID: "IDR",
  JP: "JPY",
  KR: "KRW",
  CN: "CNY",
  HK: "HKD",
  TW: "TWD",
};

export function getCurrencyByCountry(countryCode: string): string {
  return CURRENCY_MAP[countryCode.toUpperCase()] || "ZAR";
}

// Map ISO currency codes to display symbols
const CURRENCY_SYMBOL_MAP: Record<string, string> = {
  ZAR: "R", EUR: "€", GBP: "£", USD: "$", CAD: "C$",
  AUD: "A$", NZD: "NZ$", CHF: "CHF", SEK: "kr", NOK: "kr",
  DKK: "kr", BRL: "R$", SAR: "SAR", THB: "฿", MYR: "RM",
  SGD: "S$", INR: "₹", JPY: "¥", KRW: "₩", CNY: "¥",
};

export function getCurrencySymbol(isoCode: string): string {
  return CURRENCY_SYMBOL_MAP[isoCode.toUpperCase()] || isoCode;
}



export interface DoctorGreenConfig {
  apiKey: string;
  secretKey: string;
  apiUrl?: string; // Optional - if not provided, falls back to env var
}

interface DoctorGreenAPIOptions {
  method?: 'GET' | 'POST' | 'DELETE' | 'PATCH';
  body?: any;
  signBody?: any; // Body to sign but NOT send (for GET requests needing body-based signatures)
  queryParams?: Record<string, string | number>; // GET query params — appended to URL and signed
  headers?: Record<string, string>;
  config?: DoctorGreenConfig;
}

/**
 * Make authenticated request to Doctor Green API
 */
export async function doctorGreenRequest<T>(
  endpoint: string,
  options: DoctorGreenAPIOptions = {},
): Promise<T> {
  const { method = "GET", body, signBody, queryParams, headers = {}, config } = options;

  // Use config (mandatory)
  const apiKey = config?.apiKey;
  const secretKey = config?.secretKey;
  // Use apiUrl from config (database), fall back to env var only as last resort
  const baseUrl = config?.apiUrl || API_URL;

  if (!apiKey || !secretKey) {
    throw new Error("MISSING_CREDENTIALS");
  }

  return callDrGreenAPI(endpoint, {
    method,
    apiKey,
    secretKey,
    body,
    signBody,
    queryParams,
    headers,
    baseUrl,
  });
}

// ============================================
// API Methods
// ============================================

export interface DoctorGreenProduct {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  thc: number;
  cbd: number;
  cbg?: number;
  type: string; // e.g., "Indica", "Sativa", "Hybrid"
  flavour?: string;
  feelings?: string;
  helpsWith?: string;
  retailPrice: number;
  stockQuantity?: number; // Optional - may be in strainLocations instead
  popularity?: number;
  isAvailable?: boolean; // Optional - may be in strainLocations instead
  strainLocations?: Array<{
    isActive?: boolean;
    isAvailable?: boolean;
    stockQuantity?: number;
  }>;

  // Normalized fields for backwards compatibility
  strain_type?: "INDICA" | "SATIVA" | "HYBRID";
  thc_content?: number;
  cbd_content?: number;
  price?: number;
  currency?: string;
  in_stock?: boolean;
  stock_quantity?: number;
  image_url?: string;
  images?: string[];
  category?: string;
  prices?: Array<{
    currency: string;
    retailPrice: number;
    wholeSalePrice?: number;
  }>;
  expiryDate?: string;
  discount?: number;
  strainImages?: Array<{
    strainImageUrl?: string;
    altText?: string;
  }>;
}

export interface DoctorGreenClient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneCountryCode?: string;
  phoneCode?: string;
  contactNumber?: string;
  isActive: boolean;
  adminApproval: string; // "VERIFIED" | "PENDING" | "REJECTED"
  isKYCVerified: boolean;
  verifiedAt?: string;
  rejectedAt?: string;
  nft?: any;
  shippings?: any[];
  clientCart?: any;
  createdAt: string;
  updatedAt: string;
}

export interface DoctorGreenOrder {
  id: string;
  client_id: string;
  order_number: string;
  status: string;
  total_amount: number;
  currency: string;
  items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    price: number;
  }>;
  shipping_address?: any;
  created_at: string;
}

// Professional product image fallbacks (AI-generated medical-grade images)
// Doctor Green staging API returns image paths but files are not hosted (404 errors)
// Country code conversion — consolidated in lib/country-codes.ts
import { toAlpha3 } from './country-codes';

/**
 * Fetch all products from Doctor Green
 * @param country - Two-letter ISO 3166-1 alpha-2 code (e.g., 'PT' for Portugal, 'ZA' for South Africa)
 * @default 'ZA' - South Africa
 */
/**
 * Normalize a Dr Green product: resolve image URLs, calculate stock, map currency.
 */
// Dr Green DB stores relative S3 keys (e.g. "dr-green-strains/img.png").
// The backend should prepend the bucket URL but hasn't deployed that fix yet.
// Workaround: resolve relative image paths against the S3 bucket, not the API.
const S3_BUCKET_BASE_URL = "https://prod-profiles-backend.s3.amazonaws.com";

function resolveImageUrl(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  // Already a full URL — leave it alone
  if (raw.startsWith("http")) return raw;
  // Relative path → prepend S3 bucket
  const path = raw.startsWith("/") ? raw.slice(1) : raw;
  return `${S3_BUCKET_BASE_URL}/${path}`;
}

async function normalizeProduct(product: DoctorGreenProduct, country: string): Promise<DoctorGreenProduct> {
  const defaultCurrency = getCurrencyByCountry(country);

  const fullImageUrl = resolveImageUrl(product.imageUrl);

  // Calculate stock from strainLocations, fall back to product-level fields
  const locations = product.strainLocations || [];
  const locationStock = locations.reduce((sum: number, loc: any) => sum + (loc.stockQuantity || 0), 0);
  const isAvailableAtAnyLocation = locations.some((loc: any) => loc.isAvailable === true);
  const totalStock = locationStock > 0 ? locationStock : (product.stockQuantity || 0);
  const isAvailable = locations.length > 0
    ? isAvailableAtAnyLocation
    : (product.isAvailable !== false && totalStock > 0);

  // Dr Green local pricing priority (from their implementation doc):
  //   1. localRetailPrice + localCurrency  (not yet deployed)
  //   2. strainLocations[0].retailPrice + location.currency  (not yet deployed)
  //   3. retailPrice (currently EUR) → convert via exchange rates
  //   4. 0 / "Price unavailable"
  const loc0 = locations[0] as any;
  let price: number;
  let currencyCode: string;

  if ((product as any).localRetailPrice != null) {
    // Priority 1: Dr Green local pricing fields (future)
    price = (product as any).localRetailPrice;
    currencyCode = (product as any).localCurrency || defaultCurrency;
  } else if (loc0?.retailPrice != null && loc0?.location?.currency) {
    // Priority 2: strainLocations pricing (future)
    price = loc0.retailPrice;
    currencyCode = loc0.location.currency;
  } else {
    // Priority 3: retailPrice is EUR — convert to local currency
    const eurPrice = product.retailPrice || 0;
    price = await convertFromEUR(eurPrice, defaultCurrency);
    currencyCode = defaultCurrency;
  }

  const currency = getCurrencySymbol(currencyCode);

  // Resolve strainImages URLs too
  const resolvedStrainImages = product.strainImages?.map((img) => ({
    ...img,
    strainImageUrl: resolveImageUrl(img.strainImageUrl) || img.strainImageUrl,
  }));

  return {
    ...product,
    strain_type: (product.type?.toUpperCase() as "INDICA" | "SATIVA" | "HYBRID") || "HYBRID",
    thc_content: product.thc || 0,
    cbd_content: product.cbd || 0,
    price,
    currency,
    in_stock: isAvailable && totalStock > 0,
    isAvailable: isAvailable && totalStock > 0,
    stock_quantity: totalStock,
    stockQuantity: totalStock,
    image_url: fullImageUrl,
    imageUrl: fullImageUrl,
    strainImages: resolvedStrainImages,
  };
}

export async function fetchProducts(
  country: string = "ZA",
  config: DoctorGreenConfig,
): Promise<DoctorGreenProduct[]> {
  // Use /strains endpoint with countryCode param.
  // Currently returns EUR prices — normalizeProduct converts via exchange rates.
  // When Dr Green deploys localRetailPrice, it will be used automatically.
  const alpha3 = toAlpha3(country);
  console.log(`[fetchProducts] country=${country} alpha3=${alpha3}`);

  const response = await doctorGreenRequest<any>('/strains', {
    config,
    queryParams: {
      countryCode: alpha3,
      orderBy: 'desc',
      take: 100,
      page: 1,
    },
  });

  // Debug: log response shape and first product pricing
  const responseKeys = Object.keys(response || {});
  const dataKeys = response?.data ? Object.keys(response.data) : [];
  console.log(`[fetchProducts] Response keys: [${responseKeys}], data keys: [${dataKeys}]`);

  const products = response?.data?.strains || response?.strains || [];

  if (products.length > 0) {
    const p = products[0];
    console.log(`[fetchProducts] First product: "${p.name}" retailPrice=${p.retailPrice} localRetailPrice=${p.localRetailPrice ?? 'N/A'} localCurrency=${p.localCurrency ?? 'N/A'}`);
  } else {
    console.log(`[fetchProducts] No products returned`);
  }

  return Promise.all(products.map((product: DoctorGreenProduct) => normalizeProduct(product, country)));
}

// In-memory product cache to avoid re-fetching all products for single lookups
const productCache = new Map<string, { products: DoctorGreenProduct[]; expiresAt: number }>();
const PRODUCT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function fetchProduct(
  productId: string,
  country: string = "ZA",
  config: DoctorGreenConfig,
): Promise<DoctorGreenProduct> {
  // /strains/{id} requires auth that doesn't work — use the cached product list
  const cacheKey = `${country}:${config.apiUrl}`;
  const cached = productCache.get(cacheKey);
  let allProducts: DoctorGreenProduct[];

  if (cached && cached.expiresAt > Date.now()) {
    allProducts = cached.products;
  } else {
    allProducts = await fetchProducts(country, config);
    productCache.set(cacheKey, { products: allProducts, expiresAt: Date.now() + PRODUCT_CACHE_TTL_MS });
  }

  const product = allProducts.find(p => p.id === productId);
  if (!product) {
    throw new Error(`Product ${productId} not found`);
  }
  return product;
}

/**
 * Get client information by Client ID
 *
 * GET /dapp/clients/{id} returns 401 — this is a known Dr Green API limitation.
 * Both green-go-remix (production) and southhealing confirm this.
 * Workaround: List all clients via GET /dapp/clients and filter by ID.
 * Signs the query string for GET requests (matches green-go-remix pattern).
 */
export async function fetchClient(
  clientId: string,
  config: DoctorGreenConfig,
): Promise<DoctorGreenClient> {
  const PAGE_SIZE = 200;
  const MAX_PAGES = 3;

  for (let page = 1; page <= MAX_PAGES; page++) {
    console.log(`[fetchClient] Listing clients page ${page}/${MAX_PAGES} to find ${clientId}`);

    const response = await doctorGreenRequest<any>('/dapp/clients', {
      config,
      queryParams: { take: PAGE_SIZE, page, orderBy: 'desc' },
    });

    // Handle all known response shapes (API returns various nestings)
    let clients: any[] = [];
    if (Array.isArray(response)) {
      clients = response;
    } else if (Array.isArray(response?.data)) {
      clients = response.data;
    } else if (response?.data?.items && Array.isArray(response.data.items)) {
      clients = response.data.items;
    } else if (Array.isArray(response?.data?.data)) {
      clients = response.data.data;
    } else if (Array.isArray(response?.clients)) {
      clients = response.clients;
    } else if (response?.data?.clients && Array.isArray(response.data.clients)) {
      clients = response.data.clients;
    }

    if (!clients || clients.length === 0) {
      console.log(`[fetchClient] No more clients on page ${page}`);
      break;
    }

    const match = clients.find((c: any) => c.id === clientId);
    if (match) {
      console.log(`[fetchClient] Found client on page ${page} (${clients.length} clients on page)`);
      return match;
    }

    // Stop if last page (fewer results than page size)
    if (clients.length < PAGE_SIZE) {
      console.log(`[fetchClient] Last page reached (page ${page}, ${clients.length} clients)`);
      break;
    }
  }

  throw new Error(`Client ${clientId} not found after searching ${MAX_PAGES} pages`);
}

/**
 * Create a new order
 */
export async function createOrder(
  orderData: any,
  config: DoctorGreenConfig,
): Promise<DoctorGreenOrder> {
  return doctorGreenRequest<DoctorGreenOrder>("/orders", {
    method: "POST",
    body: orderData,
    config,
  });
}

/**
 * Find a Dr Green client by email address.
 * Lists all clients and filters by email match.
 * Returns the client object (including id) or null if not found.
 */
export async function fetchClientByEmail(
  email: string,
  config: DoctorGreenConfig,
): Promise<DoctorGreenClient | null> {
  const PAGE_SIZE = 200;
  const MAX_PAGES = 5;
  const normalizedEmail = email.toLowerCase().trim();

  for (let page = 1; page <= MAX_PAGES; page++) {
    console.log(`[fetchClientByEmail] Listing clients page ${page}/${MAX_PAGES} to find ${normalizedEmail}`);

    const response = await doctorGreenRequest<any>('/dapp/clients', {
      config,
      queryParams: { take: PAGE_SIZE, page, orderBy: 'desc' },
    });

    // Handle all known response shapes
    let clients: any[] = [];
    if (Array.isArray(response)) {
      clients = response;
    } else if (Array.isArray(response?.data)) {
      clients = response.data;
    } else if (response?.data?.items && Array.isArray(response.data.items)) {
      clients = response.data.items;
    } else if (Array.isArray(response?.data?.data)) {
      clients = response.data.data;
    } else if (Array.isArray(response?.clients)) {
      clients = response.clients;
    } else if (response?.data?.clients && Array.isArray(response.data.clients)) {
      clients = response.data.clients;
    }

    if (!clients || clients.length === 0) {
      break;
    }

    const match = clients.find(
      (c: any) => c.email?.toLowerCase().trim() === normalizedEmail
    );
    if (match) {
      console.log(`[fetchClientByEmail] Found client ${match.id} on page ${page}`);
      return match;
    }

    if (clients.length < PAGE_SIZE) {
      break;
    }
  }

  console.log(`[fetchClientByEmail] Client not found for email ${normalizedEmail}`);
  return null;
}

/**
 * Update an existing Dr Green client profile.
 * PATCH /dapp/clients/{clientId}
 * Confirmed working from Dr Green's own dApp theme (page-profile.php).
 */
export async function updateClient(
  clientId: string,
  updates: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phoneCode?: string;
    phoneCountryCode?: string;
    contactNumber?: string;
    shipping?: {
      address1?: string;
      address2?: string;
      city?: string;
      state?: string;
      country?: string;
      countryCode?: string;
      postalCode?: string;
    };
  },
  config: DoctorGreenConfig,
): Promise<any> {
  // Only include fields that are provided
  const payload: Record<string, any> = {};
  if (updates.firstName !== undefined) payload.firstName = updates.firstName;
  if (updates.lastName !== undefined) payload.lastName = updates.lastName;
  if (updates.email !== undefined) payload.email = updates.email;
  if (updates.phoneCode !== undefined) payload.phoneCode = updates.phoneCode;
  if (updates.phoneCountryCode !== undefined) payload.phoneCountryCode = updates.phoneCountryCode;
  if (updates.contactNumber !== undefined) payload.contactNumber = updates.contactNumber;
  if (updates.shipping !== undefined) payload.shipping = updates.shipping;

  console.log(`[updateClient] PATCH /dapp/clients/${clientId}`, Object.keys(payload));

  const response = await doctorGreenRequest<any>(`/dapp/clients/${clientId}`, {
    method: 'PATCH',
    body: payload,
    config,
  });

  return response;
}

/**
 * Create a new patient/client record in Dr. Green system
 * Payload must match the specialized structure:
 * - camelCase keys
 * - nested 'medicalRecord' with specific booleans (medicalHistory0..16)
 */
export async function createClient(
  clientData: {
    firstName: string;
    lastName: string;
    email: string;
    phoneCode: string;
    phoneCountryCode: string;
    contactNumber: string;
    shipping: {
      address1: string;
      address2?: string;
      landmark?: string;
      city: string;
      state: string;
      country: string;
      countryCode: string;
      postalCode: string;
    };
    medicalRecord: {
      dob: string;
      gender: string;
      medicalConditions: string[];
      otherMedicalCondition?: string;
      medicinesTreatments?: string[];
      otherMedicalTreatments?: string;
      medicalHistory0: boolean;
      medicalHistory1: boolean;
      medicalHistory2: boolean;
      medicalHistory3: boolean;
      medicalHistory4: boolean;
      medicalHistory5: string[];
      medicalHistory6?: boolean;
      medicalHistory7?: string[];
      medicalHistory7Relation?: string;
      medicalHistory8: boolean;
      medicalHistory9: boolean;
      medicalHistory10: boolean;
      medicalHistory11?: string;
      medicalHistory12: boolean;
      medicalHistory13: string;
      medicalHistory14: string[];
      medicalHistory15?: string;
      medicalHistory16?: boolean;
      prescriptionsSupplements?: string;
    };
  },
  config: DoctorGreenConfig,
): Promise<{ clientId: string; kycLink?: string }> {

  // The API expects this exact structure
  const payload = {
    firstName: clientData.firstName,
    lastName: clientData.lastName,
    email: clientData.email,
    phoneCode: clientData.phoneCode,
    phoneCountryCode: clientData.phoneCountryCode,
    contactNumber: clientData.contactNumber,
    shipping: clientData.shipping,
    medicalRecord: clientData.medicalRecord
  };

  // Response is nested: { success: true, data: { data: { clientId, kycLink } } }
  // OR sometimes: { success: true, data: { clientId, kycLink } } depending on proxy version
  // We type it as 'any' to handle the normalization manually
  const response = await doctorGreenRequest<any>("/client", { // Endpoint is /client singular? Findings say POST /client
    method: "POST",
    body: payload,
    config,
  });

  // Normalize response
  const rawData = response.data || {};
  const nestedData = rawData.data || rawData;

  const clientId = nestedData.clientId || rawData.clientId;
  const kycLink = nestedData.kycLink || rawData.kycLink;

  if (!clientId) {
    console.error("DrGreen createClient failed to return clientId", response);
    throw new Error("Failed to create client: No ID returned");
  }

  return { clientId, kycLink };
}
