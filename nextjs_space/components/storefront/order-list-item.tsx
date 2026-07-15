import Link from "next/link";
import { ArrowRight, Package } from "lucide-react";
import {
  orderPresentation,
  type OrderTone,
  type StorefrontOrder,
} from "@/lib/orders/order-presentation";

export const money = (n: number) => `R ${(n ?? 0).toFixed(2)}`;

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const TONE_CLASS: Record<OrderTone, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  info: "bg-blue-50 text-blue-700 ring-blue-600/20",
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  failed: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

export function OrderStatusBadge({
  status,
  paymentStatus,
}: {
  status: string;
  paymentStatus: string;
}) {
  const { label, tone } = orderPresentation(status, paymentStatus);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE_CLASS[tone]}`}
    >
      {label}
    </span>
  );
}

export function OrderListItem({
  order,
  basePath,
}: {
  order: StorefrontOrder;
  basePath: string;
}) {
  const itemCount = order.items.reduce((n, it) => n + (it.quantity || 0), 0);
  const firstName = order.items[0]?.productName;
  const summary =
    order.items.length === 0
      ? "Order"
      : order.items.length === 1
        ? firstName
        : `${firstName} +${order.items.length - 1} more`;

  return (
    <Link
      href={`${basePath}/orders/${order.id}`}
      className="flex items-center gap-4 rounded-xl border border-border/60 p-4 transition-colors hover:bg-muted/50"
    >
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Package className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{summary}</p>
          <OrderStatusBadge status={order.status} paymentStatus={order.paymentStatus} />
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {order.drGreenInvoiceNum || order.orderNumber} · {shortDate(order.createdAt)} · {itemCount} item
          {itemCount === 1 ? "" : "s"}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-foreground">{money(order.total)}</span>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </Link>
  );
}
