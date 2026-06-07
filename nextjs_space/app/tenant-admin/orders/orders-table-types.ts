export type OrderStatus =
  | "all"
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "CANCELLED";

export type DateRangePreset = "all" | "7days" | "30days" | "90days" | "custom";

export type OrderFilters = {
  status: OrderStatus;
  dateRange: DateRangePreset;
  dateFrom: string;
  dateTo: string;
} & Record<string, string>;

export type BulkActionType = "mark-processing" | "mark-completed" | null;

export interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  subtotal: number;
  shippingCost: number;
  createdAt: string;
  adminNotes?: string | null;
  items: OrderItem[];
  user: {
    name: string | null;
    email: string;
  };
}

export interface OrdersTableProps {
  orders: Order[];
  totalCount: number;
  statusCounts: {
    PENDING: number;
    PROCESSING: number;
    COMPLETED: number;
    CANCELLED: number;
  };
  onViewOrder: (order: Order) => void;
}
