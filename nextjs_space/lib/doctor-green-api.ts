/**
 * Doctor Green API Integration
 * Two-layer security: API key + ECDSA cryptographic signature
 */

import { callDrGreenAPI } from '@/lib/drgreen-api-client';

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
  SA: "ZAR",
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

export interface DoctorGreenConfig {
  apiKey: string;
  secretKey: string;
}

interface DoctorGreenAPIOptions {
  method?: 'GET' | 'POST' | 'DELETE' | 'PATCH';
  body?: any;
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
  const { method = "GET", body, headers = {}, config } = options;

  // Use config (mandatory)
  const apiKey = config?.apiKey;
  const secretKey = config?.secretKey;

  if (!apiKey || !secretKey) {
    throw new Error("MISSING_CREDENTIALS");
  }

  if (!apiKey) console.warn("Warning: No Dr Green API Key provided");

  return callDrGreenAPI(endpoint, {
    method,
    apiKey,
    secretKey,
    body,
    headers,
    baseUrl: API_URL,
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
  manufacturer?: string;
  certifications?: string[];
}

export interface DoctorGreenClient {
  id: string;
  nft_token_id: string;
  wallet_address: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  verified: boolean;
  created_at: string;
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
// Country code conversion (Alpha-2 to Alpha-3 ISO codes)
// Country code conversion (Alpha-2 to Alpha-3 ISO codes)
const COUNTRY_CODE_MAP: Record<string, string> = {
  PT: 'PRT',
  GB: 'GBR',
  ZA: 'ZAF',
  TH: 'THA',
  US: 'USA',
};

function toAlpha3(code: string): string {
  return COUNTRY_CODE_MAP[code.toUpperCase()] || code;
}

/**
 * Fetch all products from Doctor Green
 * @param country - Two-letter country code (e.g., 'PT' for Portugal, 'SA' for South Africa)
 * @default 'SA' - South Africa (only live site currently)
 */
export async function fetchProducts(
  country: string = "SA",
  config: DoctorGreenConfig,
): Promise<DoctorGreenProduct[]> {
  const alpha3Code = toAlpha3(country);
  const response = await doctorGreenRequest<{
    data: { strains: DoctorGreenProduct[] };
  }>(`/strains?country=${alpha3Code}`, { config });

  // Extract strains from the response and normalize the data
  const products = response.data?.strains || [];

  // Base URL for Doctor Green images
  // Use the API_URL environment variable base, removing /api/v1 if present
  // or default to staging base if not set
  const apiBase = API_URL.replace(/\/api\/v1\/?$/, '');
  const IMAGE_BASE_URL = apiBase || "https://api.drgreennft.com";

  // Get default currency for this country as fallback
  const defaultCurrency = getCurrencyByCountry(country);

  // Normalize fields for backwards compatibility with our UI
  return products.map((product) => {
    // Construct full image URL if imageUrl is relative
    let fullImageUrl = product.imageUrl;
    if (fullImageUrl && !fullImageUrl.startsWith("http")) {
      // Ensure we don't end up with double slashes
      const baseUrl = IMAGE_BASE_URL.endsWith('/') ? IMAGE_BASE_URL.slice(0, -1) : IMAGE_BASE_URL;
      const path = fullImageUrl.startsWith('/') ? fullImageUrl : `/${fullImageUrl}`;
      fullImageUrl = `${baseUrl}${path}`;
    }

    // Calculate stock from strainLocations array
    const locations = product.strainLocations || [];
    const totalStock = locations.reduce(
      (sum: number, loc: any) => sum + (loc.stockQuantity || 0),
      0,
    );
    const isAvailableAtAnyLocation = locations.some(
      (loc: any) => loc.isAvailable === true,
    );

    // Verify Currency
    const resolvedCurrency = product.currency || defaultCurrency;
    console.log(`[DrGreen Debug] ID: ${product.id} | Raw Currency: ${product.currency} | Default: ${defaultCurrency} | Resolved: ${resolvedCurrency} | Image: ${fullImageUrl}`);

    return {
      ...product,
      strain_type:
        (product.type?.toUpperCase() as "INDICA" | "SATIVA" | "HYBRID") ||
        "HYBRID",
      thc_content: product.thc || 0,
      cbd_content: product.cbd || 0,
      price: product.retailPrice || 0,
      currency: product.currency || defaultCurrency, // Use API currency if available, else fallback
      in_stock: isAvailableAtAnyLocation && totalStock > 0, // Available if any location has stock
      stock_quantity: totalStock, // Sum of all location stock
      image_url: fullImageUrl,
      imageUrl: fullImageUrl,
    };
  });
}

/**
 * Fetch a single product by ID
 * @default country='SA' - South Africa (only live site currently)
 */
export async function fetchProduct(
  productId: string,
  country: string = "SA",
  config: DoctorGreenConfig,
): Promise<DoctorGreenProduct> {
  const alpha3Code = toAlpha3(country);
  const response = await doctorGreenRequest<{ data: DoctorGreenProduct }>(
    `/strains/${productId}`,
    { config },
  );

  const product = response.data;

  // Base URL for Doctor Green images
  const apiBase = API_URL.replace(/\/api\/v1\/?$/, '');
  const IMAGE_BASE_URL = apiBase || "https://api.drgreennft.com";

  // Get default currency for this country as fallback
  const defaultCurrency = getCurrencyByCountry(country);

  // Construct full image URL if imageUrl is relative
  let fullImageUrl = product.imageUrl;
  if (fullImageUrl && !fullImageUrl.startsWith("http")) {
    // Ensure we don't end up with double slashes
    const baseUrl = IMAGE_BASE_URL.endsWith('/') ? IMAGE_BASE_URL.slice(0, -1) : IMAGE_BASE_URL;
    const path = fullImageUrl.startsWith('/') ? fullImageUrl : `/${fullImageUrl}`;
    fullImageUrl = `${baseUrl}${path}`;
  }

  // Calculate stock from strainLocations array
  const locations = product.strainLocations || [];
  const totalStock = locations.reduce(
    (sum: number, loc: any) => sum + (loc.stockQuantity || 0),
    0,
  );
  const isAvailableAtAnyLocation = locations.some(
    (loc: any) => loc.isAvailable === true,
  );

  // Normalize fields for backwards compatibility
  return {
    ...product,
    strain_type:
      (product.type?.toUpperCase() as "INDICA" | "SATIVA" | "HYBRID") ||
      "HYBRID",
    thc_content: product.thc || 0,
    cbd_content: product.cbd || 0,
    price: product.retailPrice || 0,
    currency: product.currency || defaultCurrency,
    in_stock: isAvailableAtAnyLocation && totalStock > 0,
    stock_quantity: totalStock,
    image_url: fullImageUrl,
    imageUrl: fullImageUrl,
  };
}

/**
 * Verify NFT ownership
 */
export async function verifyNFT(
  tokenId: string,
  config: DoctorGreenConfig,
): Promise<any> {
  return doctorGreenRequest(`/nfts/${tokenId}/verify`, { config });
}

/**
 * Get client information by NFT token
 */
export async function getClientByNFT(
  tokenId: string,
  config: DoctorGreenConfig,
): Promise<DoctorGreenClient> {
  return doctorGreenRequest<DoctorGreenClient>(`/clients/nft/${tokenId}`, {
    config,
  });
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
 * Fetch client orders
 */
export async function fetchClientOrders(
  clientId: string,
  config: DoctorGreenConfig,
): Promise<DoctorGreenOrder[]> {
  return doctorGreenRequest<DoctorGreenOrder[]>(`/clients/${clientId}/orders`, {
    config,
  });
}

/**
 * Add product to cart
 */
export async function addToCart(
  clientId: string,
  productId: string,
  quantity: number,
  config: DoctorGreenConfig,
): Promise<any> {
  return doctorGreenRequest(`/clients/${clientId}/cart`, {
    method: "POST",
    body: { product_id: productId, quantity },
    config,
  });
}
/**
 * Create a new patient/client record in Dr. Green system
 */
export async function createClient(
  clientData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    address: {
      street: string;
      city: string;
      postalCode: string;
      country: string;
    };
    medicalRecord?: {
      conditions: string;
      currentMedications?: string;
      allergies?: string;
      previousCannabisUse?: boolean;
      doctorApproval?: boolean;
    };
  },
  config: DoctorGreenConfig,
): Promise<{ clientId: string; kycLink?: string }> {
  const response = await doctorGreenRequest<{
    clientId: string;
    kycLink?: string;
  }>("/clients", {
    method: "POST",
    body: JSON.stringify({
      first_name: clientData.firstName,
      last_name: clientData.lastName,
      email: clientData.email,
      phone: clientData.phone,
      date_of_birth: clientData.dateOfBirth,
      address: {
        street: clientData.address.street,
        city: clientData.address.city,
        postal_code: clientData.address.postalCode,
        country: clientData.address.country,
      },
      medical_record: clientData.medicalRecord
        ? {
          conditions: clientData.medicalRecord.conditions,
          current_medications: clientData.medicalRecord.currentMedications,
          allergies: clientData.medicalRecord.allergies,
          previous_cannabis_use: clientData.medicalRecord.previousCannabisUse,
          doctor_approval: clientData.medicalRecord.doctorApproval,
        }
        : undefined,
    }),
    config,
  });

  return response;
}
