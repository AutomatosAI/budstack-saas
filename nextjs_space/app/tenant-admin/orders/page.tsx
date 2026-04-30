"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { format } from "date-fns";
import {
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Check,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { StatCard } from "@/components/admin/shared";
import { OrdersTable } from "./orders-table";

interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  price: number;
}

interface Order {
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

interface OrdersResponse {
  orders: Order[];
  totalCount: number;
  statusCounts: {
    PENDING: number;
    PROCESSING: number;
    COMPLETED: number;
    CANCELLED: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export default function TenantOrdersPage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [orders, setOrders] = useState<Order[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [statusCounts, setStatusCounts] = useState({
    PENDING: 0,
    PROCESSING: 0,
    COMPLETED: 0,
    CANCELLED: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [showSavedIndicator, setShowSavedIndicator] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/auth/login");
    }
    if (
      isLoaded &&
      isSignedIn &&
      user?.publicMetadata?.role !== "TENANT_ADMIN" &&
      user?.publicMetadata?.role !== "SUPER_ADMIN"
    ) {
      router.push("/auth/login");
    }
  }, [isLoaded, isSignedIn, user, router]);

  const buildApiUrl = useCallback(() => {
    const params = new URLSearchParams();

    const page = searchParams.get("page") || "1";
    const pageSize = searchParams.get("pageSize") || "20";
    params.set("page", page);
    params.set("pageSize", pageSize);

    const search = searchParams.get("search");
    const statusFilter = searchParams.get("status");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const sortBy = searchParams.get("sortBy");
    const sortOrder = searchParams.get("sortOrder");

    if (search) params.set("search", search);
    if (statusFilter && statusFilter !== "all")
      params.set("status", statusFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (sortBy) params.set("sortBy", sortBy);
    if (sortOrder) params.set("sortOrder", sortOrder);

    return `/api/tenant-admin/orders?${params.toString()}`;
  }, [searchParams]);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(buildApiUrl());
      if (response.ok) {
        const data: OrdersResponse = await response.json();
        setOrders(data.orders || []);
        setTotalCount(data.totalCount || 0);
        setStatusCounts(
          data.statusCounts || {
            PENDING: 0,
            PROCESSING: 0,
            COMPLETED: 0,
            CANCELLED: 0,
          },
        );
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [buildApiUrl]);

  useEffect(() => {
    if (user?.id) {
      fetchOrders();
    }
  }, [user, fetchOrders]);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const response = await fetch("/api/tenant-admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: newStatus }),
      });

      if (response.ok) {
        toast.success("Order status updated successfully");
        await fetchOrders();
        if (selectedOrder?.id === orderId) {
          setSelectedOrder({ ...selectedOrder, status: newStatus });
        }
      } else {
        toast.error("Failed to update order status");
      }
    } catch (error) {
      console.error("Error updating order status:", error);
      toast.error("Failed to update order status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusChipClass = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bs-chip bs-chip-green";
      case "PROCESSING":
        return "bs-chip bs-chip-info";
      case "PENDING":
      case "PENDING_SYNC":
        return "bs-chip bs-chip-warn";
      case "CANCELLED":
        return "bs-chip bs-chip-danger";
      default:
        return "bs-chip bs-chip-muted";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle2 className="w-4 h-4" />;
      case "PROCESSING":
        return <Truck className="w-4 h-4" />;
      case "PENDING":
        return <Clock className="w-4 h-4" />;
      case "CANCELLED":
        return <XCircle className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  const saveAdminNotes = useCallback(async (orderId: string, notes: string) => {
    setIsSavingNotes(true);
    try {
      const response = await fetch(
        `/api/tenant-admin/orders/${orderId}/admin-notes`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ adminNotes: notes }),
        },
      );

      if (response.ok) {
        setShowSavedIndicator(true);
        setTimeout(() => setShowSavedIndicator(false), 2000);
      } else {
        toast.error("Failed to save admin notes");
      }
    } catch (error) {
      console.error("Error saving admin notes:", error);
      toast.error("Failed to save admin notes");
    } finally {
      setIsSavingNotes(false);
    }
  }, []);

  const handleAdminNotesChange = useCallback(
    (value: string, orderId: string) => {
      setAdminNotes(value);

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        saveAdminNotes(orderId, value);
      }, 1000);
    },
    [saveAdminNotes],
  );

  useEffect(() => {
    if (selectedOrder) {
      setAdminNotes(selectedOrder.adminNotes || "");
      setShowSavedIndicator(false);
    }
  }, [selectedOrder]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  if (!isLoaded || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-4 border-bs-green border-t-transparent"></div>
          <p className="text-bs-fg-muted">Loading orders...</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn || !user) {
    return null;
  }

  const totalOrders =
    statusCounts.PENDING +
    statusCounts.PROCESSING +
    statusCounts.COMPLETED +
    statusCounts.CANCELLED;

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      <header className="bs-page-header-centered">
        <h1
          className="bs-page-title"
          style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
        >
          Order Management
        </h1>
        <p className="bs-page-subtitle">
          Manage and fulfill customer orders with clarity and speed.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <StatCard label="Total Orders" value={totalOrders} icon={Package} />
        <StatCard label="Pending" value={statusCounts.PENDING} icon={Clock} />
        <StatCard
          label="Processing"
          value={statusCounts.PROCESSING}
          icon={Truck}
        />
        <StatCard
          label="Completed"
          value={statusCounts.COMPLETED}
          icon={CheckCircle2}
        />
      </div>

      <OrdersTable
        orders={orders}
        totalCount={totalCount}
        statusCounts={statusCounts}
        onViewOrder={setSelectedOrder}
      />

      {/* Order Detail Modal */}
      <Dialog
        open={!!selectedOrder}
        onOpenChange={() => setSelectedOrder(null)}
      >
        <DialogContent className="bs-dialog-content max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle
              className="font-display text-[28px] text-bs-fg"
              style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
            >
              Order Details
            </DialogTitle>
            <DialogDescription className="font-mono text-bs-fg-muted">
              Order #{selectedOrder?.orderNumber.slice(-8).toUpperCase()}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 rounded-bs-md border border-bs-border-100 bg-bs-card-2 p-4">
                <div className="space-y-1">
                  <p className="bs-eyebrow">Customer</p>
                  <p className="font-semibold text-bs-fg">
                    {selectedOrder.user?.name || "Guest"}
                  </p>
                  <p className="text-sm text-bs-fg-muted">
                    {selectedOrder.user?.email}
                  </p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="bs-eyebrow">Order Date</p>
                  <p className="font-mono text-sm font-semibold text-bs-fg tabular-nums">
                    {format(
                      new Date(selectedOrder.createdAt),
                      "MMM d, yyyy • h:mm a",
                    )}
                  </p>
                </div>
              </div>

              <div className="rounded-bs-md border border-bs-border-100 bg-bs-card-2 p-4">
                <h3
                  className="mb-3 font-display text-[22px] text-bs-fg"
                  style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
                >
                  Order Status
                </h3>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <select
                      value={selectedOrder.status}
                      onChange={(e) =>
                        updateOrderStatus(selectedOrder.id, e.target.value)
                      }
                      disabled={updatingStatus}
                      className="bs-select w-full"
                    >
                      <option value="PENDING">Pending</option>
                      <option value="PROCESSING">Processing</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>
                  <span className={`${getStatusChipClass(selectedOrder.status)} gap-1`}>
                    {getStatusIcon(selectedOrder.status)}
                    {selectedOrder.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-bs-fg-muted">
                  Update the order status to reflect fulfillment progress
                </p>
              </div>

              <div>
                <h3
                  className="mb-3 font-display text-[22px] text-bs-fg"
                  style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
                >
                  Order Items
                </h3>
                <div className="overflow-hidden rounded-bs-md border border-bs-border-100">
                  <table className="bs-table w-full">
                    <thead>
                      <tr>
                        <th className="text-left">Product</th>
                        <th className="text-center">Quantity</th>
                        <th className="text-right">Price</th>
                        <th className="text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items.map((item) => (
                        <tr key={item.id}>
                          <td className="font-medium text-bs-fg">
                            {item.productName}
                          </td>
                          <td className="text-center font-mono text-bs-fg-muted tabular-nums">
                            {item.quantity}
                          </td>
                          <td className="text-right font-mono tabular-nums">
                            €{item.price.toFixed(2)}
                          </td>
                          <td className="text-right font-mono tabular-nums">
                            €{(item.quantity * item.price).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="border-t border-bs-border-100 pt-4">
                <div className="ml-auto max-w-md space-y-2">
                  <div className="flex justify-between text-bs-fg-muted">
                    <span>Subtotal</span>
                    <span className="font-mono tabular-nums">
                      €{selectedOrder.subtotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-bs-fg-muted">
                    <span>Shipping</span>
                    <span className="font-mono tabular-nums">
                      €{selectedOrder.shippingCost.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-bs-border-100 pt-2 text-xl font-bold text-bs-fg">
                    <span>Total</span>
                    <span className="font-mono tabular-nums">
                      €{selectedOrder.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Admin Notes Section */}
              <div className="rounded-bs-md border border-bs-border-100 bg-bs-card-2 p-4">
                <div className="mb-2 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-bs-gold" />
                    <h3
                      className="font-display text-[22px] text-bs-fg"
                      style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
                    >
                      Admin Notes
                    </h3>
                  </div>
                  {showSavedIndicator && (
                    <div className="flex items-center gap-1.5 text-sm font-medium text-bs-green-soft">
                      <Check className="h-4 w-4" />
                      <span>Saved</span>
                    </div>
                  )}
                </div>
                <p className="mb-3 text-sm text-bs-fg-muted">
                  Internal notes (not visible to customers)
                </p>
                <textarea
                  value={adminNotes}
                  onChange={(e) =>
                    handleAdminNotesChange(e.target.value, selectedOrder.id)
                  }
                  placeholder="Add notes about special handling, gift messages, or other internal information..."
                  className="bs-input min-h-[120px] w-full resize-y"
                  disabled={isSavingNotes}
                />
                <p className="mt-2 text-xs text-bs-fg-muted">
                  {isSavingNotes
                    ? "Saving..."
                    : "Changes are saved automatically after 1 second of no typing"}
                </p>
              </div>

              {/* Status Action Buttons (Print Packing Slip removed per PRD §4.5) */}
              <div className="flex gap-3 border-t border-bs-border-100 pt-4">
                {selectedOrder.status === "PENDING" && (
                  <button
                    type="button"
                    onClick={() =>
                      updateOrderStatus(selectedOrder.id, "PROCESSING")
                    }
                    disabled={updatingStatus}
                    className="bs-btn bs-btn-green flex-1"
                  >
                    <Truck className="h-4 w-4" />
                    <span>Start Processing</span>
                  </button>
                )}
                {selectedOrder.status === "PROCESSING" && (
                  <button
                    type="button"
                    onClick={() =>
                      updateOrderStatus(selectedOrder.id, "COMPLETED")
                    }
                    disabled={updatingStatus}
                    className="bs-btn bs-btn-green flex-1"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Mark as Completed</span>
                  </button>
                )}
                {selectedOrder.status !== "CANCELLED" &&
                  selectedOrder.status !== "COMPLETED" && (
                    <button
                      type="button"
                      onClick={() =>
                        updateOrderStatus(selectedOrder.id, "CANCELLED")
                      }
                      disabled={updatingStatus}
                      className="bs-btn bs-btn-danger"
                    >
                      <XCircle className="h-4 w-4" />
                      <span>Cancel Order</span>
                    </button>
                  )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
