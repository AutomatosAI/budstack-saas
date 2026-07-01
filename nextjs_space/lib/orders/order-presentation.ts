/**
 * Pure, client-safe order types + status presentation.
 *
 * Kept separate from storefront-orders.ts (which imports prisma + the Dr Green
 * client) so storefront row components can use orderPresentation/types WITHOUT
 * pulling server-only code — and its `async_hooks` dependency — into the browser
 * bundle.
 */

export interface StorefrontOrderItem {
  id: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface StorefrontOrder {
  id: string;
  orderNumber: string;
  total: number;
  subtotal: number;
  shippingCost: number;
  status: string; // budstacks OrderStatus
  paymentStatus: string; // budstacks PaymentStatus
  drGreenOrderId: string | null;
  createdAt: string; // ISO
  items: StorefrontOrderItem[];
}

export type OrderTone = "success" | "info" | "pending" | "failed";

export interface OrderPresentation {
  label: string;
  tone: OrderTone;
}

/**
 * Collapse (status, paymentStatus) into a single customer-facing label + tone.
 * Until an order is PAID the payment state leads (that is what the customer acts
 * on); once PAID, fulfilment leads.
 */
export function orderPresentation(
  status: string,
  paymentStatus: string,
): OrderPresentation {
  const pay = (paymentStatus || "").toUpperCase();
  const ful = (status || "").toUpperCase();

  if (pay !== "PAID") {
    switch (pay) {
      case "FAILED":
        return { label: "Payment failed", tone: "failed" };
      case "EXPIRED":
        return { label: "Payment expired", tone: "failed" };
      case "CANCELLED":
        return { label: "Cancelled", tone: "failed" };
      case "AWAITING_PROCESSING":
        return { label: "Confirming payment", tone: "pending" };
      default:
        return { label: "Awaiting payment", tone: "pending" };
    }
  }

  switch (ful) {
    case "DELIVERED":
      return { label: "Delivered", tone: "success" };
    case "SHIPPED":
      return { label: "Shipped", tone: "info" };
    case "PROCESSING":
    case "CONFIRMED":
      return { label: "Processing", tone: "info" };
    case "CANCELLED":
      return { label: "Cancelled", tone: "failed" };
    default:
      return { label: "Paid", tone: "success" };
  }
}
