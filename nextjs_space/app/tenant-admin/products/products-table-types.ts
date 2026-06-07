export type CategoryFilter =
  | "all"
  | "flower"
  | "edibles"
  | "concentrates"
  | "pre-rolls"
  | "topicals"
  | "accessories";

export type StockFilter = "all" | "in-stock" | "out-of-stock";

export type BulkActionType =
  | "set-in-stock"
  | "set-out-of-stock"
  | "delete"
  | null;

export type ProductFilters = {
  category: CategoryFilter;
  stock: StockFilter;
} & Record<string, string>;

export interface Product {
  id: string;
  name: string;
  category: string;
  slug: string | null;
  thcContent: number | null;
  cbdContent: number | null;
  price: number;
  stock: number;
  displayOrder: number;
  createdAt: Date;
}

export interface ProductsTableProps {
  products: Product[];
  totalCount: number;
  inStockCount: number;
  outOfStockCount: number;
  categoryCounts: Record<string, number>;
  currencySymbol?: string;
}

export interface SortableProductRowProps {
  product: Product;
  isSelected: boolean;
  onSelectOne: (id: string, checked: boolean) => void;
  getStrainLabel: (name: string) => string;
  currencySymbol: string;
}
