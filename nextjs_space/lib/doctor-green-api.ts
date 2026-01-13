
/**
 * Doctor Green API Integration
 * Two-layer security: API key + ECDSA cryptographic signature
 */

import { callDrGreenAPI } from '@/lib/drgreen-api-client';

const API_URL = process.env.DOCTOR_GREEN_API_URL || 'https://stage-api.drgreennft.com/api/v1';

// Currency mapping by country code
const CURRENCY_MAP: Record<string, string> = {
  'PT': 'EUR',
  'ES': 'EUR',
  'FR': 'EUR',
  'DE': 'EUR',
  'IT': 'EUR',
  'NL': 'EUR',
  'BE': 'EUR',
  'AT': 'EUR',
  'IE': 'EUR',
  'GR': 'EUR',
  'SA': 'ZAR',
  'UK': 'GBP',
  'GB': 'GBP',
  'US': 'USD',
  'CA': 'CAD',
  'AU': 'AUD',
  'NZ': 'NZD',
  'CH': 'CHF',
  'SE': 'SEK',
  'NO': 'NOK',
  'DK': 'DKK',
  'PL': 'PLN',
  'CZ': 'CZK',
  'IL': 'ILS',
  'BR': 'BRL',
  'MX': 'MXN',
  'AR': 'ARS',
  'CL': 'CLP',
  'CO': 'COP',
  'TH': 'THB',
  'MY': 'MYR',
  'SG': 'SGD',
  'IN': 'INR',
  'PK': 'PKR',
  'PH': 'PHP',
  'ID': 'IDR',
  'JP': 'JPY',
  'KR': 'KRW',
  'CN': 'CNY',
  'HK': 'HKD',
  'TW': 'TWD',
};

export function getCurrencyByCountry(countryCode: string): string {
  return CURRENCY_MAP[countryCode.toUpperCase()] || 'ZAR';
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
  options: DoctorGreenAPIOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers = {}, config } = options;

  // Use config (mandatory)
  const apiKey = config?.apiKey;
  const secretKey = config?.secretKey;

  if (!apiKey || !secretKey) {
    throw new Error('MISSING_CREDENTIALS');
  }

  if (!apiKey) console.warn('Warning: No Dr Green API Key provided');

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
  strain_type?: 'INDICA' | 'SATIVA' | 'HYBRID';
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
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
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
const PRODUCT_IMAGE_FALLBACKS: Record<string, string> = {
  'Acapulco Gold': 'https://cdn.abacus.ai/images/f18d746e-06d5-4a86-93d1-aef2e7d1a4a6.png',
  'Wedding Crasher': 'https://cdn.abacus.ai/images/dbd04817-f7b5-4916-8b8c-867f43f506d7.png',
  'The Soap': 'https://cdn.abacus.ai/images/682bfd15-fad7-4194-b995-072b0e02afdd.png',
  'Gelato #33': 'https://cdn.abacus.ai/images/a460c225-4d56-45d2-bb03-7d5999b4e8f4.png',
  'Nerds': 'https://cdn.abacus.ai/images/f1c0b74b-c7cf-4c49-b0d5-82d25b8f4b39.png',
  'Godfather OG': 'https://cdn.abacus.ai/images/e93e05e9-d028-4d9c-9cd0-69d92300ed36.png',
  'Pink Panties': 'https://cdn.abacus.ai/images/6f89e66f-7d05-4f4f-bddf-f5ffec7abae2.png',
  'Skywalker OG': 'https://cdn.abacus.ai/images/d05ad43d-0470-4e62-8b21-beb43a3f28da.png',
  'Animal Mints': 'https://cdn.abacus.ai/images/ed270b17-ac4a-4e63-87f2-4db29bdd8baf.png',
  'Zkittlez': 'https://cdn.abacus.ai/images/9e1e39ad-b91b-49fc-9f95-9f35040d72b9.png',
};

/**
 * Fetch all products from Doctor Green
 * @param country - Two-letter country code (e.g., 'PT' for Portugal, 'SA' for South Africa)
 * @default 'SA' - South Africa (only live site currently)
 */
export async function fetchProducts(country: string = 'SA', config: DoctorGreenConfig): Promise<DoctorGreenProduct[]> {
  const response = await doctorGreenRequest<{ data: { strains: DoctorGreenProduct[] } }>(
    `/strains?country=${country}`,
    { config }
  );

  // Extract strains from the response and normalize the data
  const products = response.data?.strains || [];

  // Base URL for Doctor Green images (staging)
  const IMAGE_BASE_URL = 'https://stage-api.drgreennft.com';

  // Get currency for this country
  const currency = getCurrencyByCountry(country);

  // Normalize fields for backwards compatibility with our UI
  return products.map(product => {
    // Construct full image URL if imageUrl is relative
    let fullImageUrl = product.imageUrl;
    if (fullImageUrl && !fullImageUrl.startsWith('http')) {
      fullImageUrl = `${IMAGE_BASE_URL}/${fullImageUrl}`;
    }

    // Use fallback image - Doctor Green staging doesn't host actual images yet
    const fallbackImage = PRODUCT_IMAGE_FALLBACKS[product.name];
    if (fallbackImage) {
      fullImageUrl = fallbackImage;
    }

    // Calculate stock from strainLocations array
    const locations = product.strainLocations || [];
    const totalStock = locations.reduce((sum: number, loc: any) => sum + (loc.stockQuantity || 0), 0);
    const isAvailableAtAnyLocation = locations.some((loc: any) => loc.isAvailable === true);

    return {
      ...product,
      strain_type: (product.type?.toUpperCase() as 'INDICA' | 'SATIVA' | 'HYBRID') || 'HYBRID',
      thc_content: product.thc || 0,
      cbd_content: product.cbd || 0,
      price: product.retailPrice || 0,
      currency: currency, // Dynamic currency based on country
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
export async function fetchProduct(productId: string, country: string = 'SA', config: DoctorGreenConfig): Promise<DoctorGreenProduct> {
  const response = await doctorGreenRequest<{ data: DoctorGreenProduct }>(
    `/strains/${productId}`,
    { config }
  );

  const product = response.data;

  // Base URL for Doctor Green images (staging)
  const IMAGE_BASE_URL = 'https://stage-api.drgreennft.com';

  // Get currency for this country
  const currency = getCurrencyByCountry(country);

  // Construct full image URL if imageUrl is relative
  let fullImageUrl = product.imageUrl;
  if (fullImageUrl && !fullImageUrl.startsWith('http')) {
    fullImageUrl = `${IMAGE_BASE_URL}/${fullImageUrl}`;
  }

  // Calculate stock from strainLocations array
  const locations = product.strainLocations || [];
  const totalStock = locations.reduce((sum: number, loc: any) => sum + (loc.stockQuantity || 0), 0);
  const isAvailableAtAnyLocation = locations.some((loc: any) => loc.isAvailable === true);

  // Normalize fields for backwards compatibility
  return {
    ...product,
    strain_type: (product.type?.toUpperCase() as 'INDICA' | 'SATIVA' | 'HYBRID') || 'HYBRID',
    thc_content: product.thc || 0,
    cbd_content: product.cbd || 0,
    price: product.retailPrice || 0,
    currency: currency, // Dynamic currency based on country
    in_stock: isAvailableAtAnyLocation && totalStock > 0, // Available if any location has stock
    stock_quantity: totalStock, // Sum of all location stock
    image_url: fullImageUrl,
    imageUrl: fullImageUrl,
  };
}

/**
 * Verify NFT ownership
 */
export async function verifyNFT(tokenId: string, config: DoctorGreenConfig): Promise<any> {
  return doctorGreenRequest(`/nfts/${tokenId}/verify`, { config });
}

/**
 * Get client information by NFT token
 */
export async function getClientByNFT(tokenId: string, config: DoctorGreenConfig): Promise<DoctorGreenClient> {
  return doctorGreenRequest<DoctorGreenClient>(`/clients/nft/${tokenId}`, { config });
}

/**
 * Create a new order
 */
export async function createOrder(orderData: any, config: DoctorGreenConfig): Promise<DoctorGreenOrder> {
  return doctorGreenRequest<DoctorGreenOrder>('/orders', {
    method: 'POST',
    body: orderData,
    config,
  });
}

/**
 * Fetch client orders
 */
export async function fetchClientOrders(clientId: string, config: DoctorGreenConfig): Promise<DoctorGreenOrder[]> {
  return doctorGreenRequest<DoctorGreenOrder[]>(`/clients/${clientId}/orders`, { config });
}

/**
 * Add product to cart
 */
export async function addToCart(clientId: string, productId: string, quantity: number, config: DoctorGreenConfig): Promise<any> {
  return doctorGreenRequest(`/clients/${clientId}/cart`, {
    method: 'POST',
    body: { product_id: productId, quantity },
    config,
  });
}
/**
 * Create a new patient/client record in Dr. Green system
 */
export async function createClient(clientData: {
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
}, config: DoctorGreenConfig): Promise<{ clientId: string; kycLink?: string }> {
  const response = await doctorGreenRequest<{ clientId: string; kycLink?: string }>('/clients', {
    method: 'POST',
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
      medical_record: clientData.medicalRecord ? {
        conditions: clientData.medicalRecord.conditions,
        current_medications: clientData.medicalRecord.currentMedications,
        allergies: clientData.medicalRecord.allergies,
        previous_cannabis_use: clientData.medicalRecord.previousCannabisUse,
        doctor_approval: clientData.medicalRecord.doctorApproval,
      } : undefined,
    }),
    config,
  });

  return response;
}
