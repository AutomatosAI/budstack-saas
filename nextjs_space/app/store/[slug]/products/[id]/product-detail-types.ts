export interface Product {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  thc: number;
  cbd: number;
  cbg?: number;
  type: string;
  flavour?: string;
  feelings?: string;
  helpsWith?: string;
  retailPrice: number;
  stockQuantity: number;
  popularity?: number;
  isAvailable: boolean;
  strain_type?: "INDICA" | "SATIVA" | "HYBRID";
  thc_content?: number;
  cbd_content?: number;
  price?: number;
  currency?: string;
  in_stock?: boolean;
  stock_quantity?: number;
  image_url?: string;
  expiryDate?: string;
  discount?: number;
  strainImages?: Array<{
    strainImageUrl?: string;
    altText?: string;
  }>;
}

export interface ApiResponse {
  success: boolean;
  data: Product;
  similarProducts?: Product[];
  error?: string;
}
