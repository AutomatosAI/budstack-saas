"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import {
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
  Printer,
  FileText,
  Check,
  ShoppingBag,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
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
  const sessionResult = useSession();
  const session = sessionResult?.data;
  const status = sessionResult?.status;
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
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
    if (
      status === "authenticated" &&
      session?.user?.role !== "TENANT_ADMIN" &&
      session?.user?.role !== "SUPER_ADMIN"
    ) {
      router.push("/auth/login");
    }
  }, [status, session, router]);

  // Build API URL with query params
  const buildApiUrl = useCallback(() => {
    const params = new URLSearchParams();

    // Pagination params
    const page = searchParams.get("page") || "1";
    const pageSize = searchParams.get("pageSize") || "20";
    params.set("page", page);
    params.set("pageSize", pageSize);

    // Search and filter params
    const search = searchParams.get("search");
    const statusFilter = searchParams.get("status");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    // Sort params
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
    if (session?.user?.id) {
      fetchOrders();
    }
  }, [session, fetchOrders]);

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
        // Update selected order if it's the one being updated
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-600 hover:bg-green-700";
      case "PROCESSING":
        return "bg-blue-600 hover:bg-blue-700";
      case "PENDING":
        return "bg-yellow-600 hover:bg-yellow-700";
      case "CANCELLED":
        return "bg-red-600 hover:bg-red-700";
      default:
        return "bg-gray-600 hover:bg-gray-700";
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

  // Save admin notes with debouncing (1 second delay)
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
        // Hide saved indicator after 2 seconds
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

  // Handle admin notes change with debouncing
  const handleAdminNotesChange = useCallback(
    (value: string, orderId: string) => {
      setAdminNotes(value);

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set new timeout to save after 1 second of no typing
      saveTimeoutRef.current = setTimeout(() => {
        saveAdminNotes(orderId, value);
      }, 1000);
    },
    [saveAdminNotes],
  );

  // Initialize admin notes when order is selected
  useEffect(() => {
    if (selectedOrder) {
      setAdminNotes(selectedOrder.adminNotes || "");
      setShowSavedIndicator(false);
    }
  }, [selectedOrder]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading orders...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  // Calculate total orders for stats (sum of all status counts)
  const totalOrders =
    statusCounts.PENDING +
    statusCounts.PROCESSING +
    statusCounts.COMPLETED +
    statusCounts.CANCELLED;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Flowa-style Header */}
      {/* Centered Header */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <div className="section-badge mb-4 inline-flex">
          <ShoppingBag className="h-4 w-4" />
          Orders
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Order Management
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground mx-auto">
          Manage and fulfill customer orders with clarity and speed.
        </p>
      </div>

      {/* Order Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="bg-white rounded-2xl border border-slate-200/50 shadow-2xl p-6">
          <CardHeader className="p-0 pb-4 space-y-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-600">
                Total Orders
              </CardTitle>
              <div className="rounded-xl bg-slate-100 p-2.5">
                <Package className="h-5 w-5 text-slate-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-3xl font-semibold text-slate-900">{totalOrders}</div>
          </CardContent>
        </Card>

        <Card className="bg-white rounded-2xl border border-slate-200/50 shadow-2xl p-6">
          <CardHeader className="p-0 pb-4 space-y-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-600">
                Pending
              </CardTitle>
              <div className="rounded-xl bg-amber-50 p-2.5">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-3xl font-semibold text-slate-900">{statusCounts.PENDING}</div>
          </CardContent>
        </Card>

        <Card className="bg-white rounded-2xl border border-slate-200/50 shadow-2xl p-6">
          <CardHeader className="p-0 pb-4 space-y-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-600">
                Processing
              </CardTitle>
              <div className="rounded-xl bg-blue-50 p-2.5">
                <Truck className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-3xl font-semibold text-slate-900">{statusCounts.PROCESSING}</div>
          </CardContent>
        </Card>

        <Card className="bg-white rounded-2xl border border-slate-200/50 shadow-2xl p-6">
          <CardHeader className="p-0 pb-4 space-y-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-600">
                Completed
              </CardTitle>
              <div className="rounded-xl bg-emerald-50 p-2.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-3xl font-semibold text-slate-900">{statusCounts.COMPLETED}</div>
          </CardContent>
        </Card>
      </div>

      {/* Orders Table with Search, Filters, and Pagination */}
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Order Details</DialogTitle>
            <DialogDescription>
              Order #{selectedOrder?.orderNumber.slice(-8).toUpperCase()}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6">
              {/* Order Header */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Customer</p>
                  <p className="font-semibold">
                    {selectedOrder.user?.name || "Guest"}
                  </p>
                  <p className="text-sm text-gray-600">
                    {selectedOrder.user?.email}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600 mb-1">Order Date</p>
                  <p className="font-semibold">
                    {format(
                      new Date(selectedOrder.createdAt),
                      "MMM d, yyyy • h:mm a",
                    )}
                  </p>
                </div>
              </div>

              {/* Order Status Management */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-3">Order Status</h3>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Select
                      value={selectedOrder.status}
                      onValueChange={(value) =>
                        updateOrderStatus(selectedOrder.id, value)
                      }
                      disabled={updatingStatus}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PENDING">Pending</SelectItem>
                        <SelectItem value="PROCESSING">Processing</SelectItem>
                        <SelectItem value="COMPLETED">Completed</SelectItem>
                        <SelectItem value="CANCELLED">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Badge
                    className={`${getStatusColor(selectedOrder.status)} text-white gap-1`}
                  >
                    {getStatusIcon(selectedOrder.status)}
                    {selectedOrder.status}
                  </Badge>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Update the order status to reflect fulfillment progress
                </p>
              </div>

              {/* Order Items */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Order Items</h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-center">Quantity</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.productName}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="text-right">
                            €{item.price.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            €{(item.quantity * item.price).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Order Summary */}
              <div className="border-t pt-4">
                <div className="space-y-2 max-w-md ml-auto">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>€{selectedOrder.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Shipping</span>
                    <span>€{selectedOrder.shippingCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold pt-2 border-t">
                    <span>Total</span>
                    <span>€{selectedOrder.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Admin Notes Section */}
              <div className="border rounded-lg p-4 bg-amber-50/30 border-amber-200">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-amber-600" />
                    <h3 className="font-semibold text-lg text-slate-900">
                      Admin Notes
                    </h3>
                  </div>
                  {showSavedIndicator && (
                    <div className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium animate-in fade-in duration-200">
                      <Check className="w-4 h-4" />
                      <span>Saved</span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-slate-600 mb-3">
                  Internal notes (not visible to customers)
                </p>
                <Textarea
                  value={adminNotes}
                  onChange={(e) =>
                    handleAdminNotesChange(e.target.value, selectedOrder.id)
                  }
                  placeholder="Add notes about special handling, gift messages, or other internal information..."
                  className="min-h-[120px] resize-y bg-white border-amber-200 focus-visible:ring-amber-400 focus-visible:border-amber-400"
                  disabled={isSavingNotes}
                />
                <p className="text-xs text-slate-500 mt-2">
                  {isSavingNotes
                    ? "Saving..."
                    : "Changes are saved automatically after 1 second of no typing"}
                </p>
              </div>

              {/* Quick Actions */}
              <div className="space-y-3 pt-4 border-t">
                {/* Print Packing Slip Button */}
                <Button
                  variant="outline"
                  className="w-full gap-2 border-slate-300 hover:bg-slate-50 hover:border-slate-400 font-medium"
                  onClick={() => {
                    const packingSlipUrl = `/tenant-admin/orders/${selectedOrder.id}/packing-slip`;
                    window.open(packingSlipUrl, "_blank");
                  }}
                >
                  <Printer className="w-4 h-4" />
                  Print Packing Slip
                </Button>

                {/* Status Action Buttons */}
                <div className="flex gap-3">
                  {selectedOrder.status === "PENDING" && (
                    <Button
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                      onClick={() =>
                        updateOrderStatus(selectedOrder.id, "PROCESSING")
                      }
                      disabled={updatingStatus}
                    >
                      <Truck className="w-4 h-4 mr-2" />
                      Start Processing
                    </Button>
                  )}
                  {selectedOrder.status === "PROCESSING" && (
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() =>
                        updateOrderStatus(selectedOrder.id, "COMPLETED")
                      }
                      disabled={updatingStatus}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Mark as Completed
                    </Button>
                  )}
                  {selectedOrder.status !== "CANCELLED" &&
                    selectedOrder.status !== "COMPLETED" && (
                      <Button
                        variant="outline"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() =>
                          updateOrderStatus(selectedOrder.id, "CANCELLED")
                        }
                        disabled={updatingStatus}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Cancel Order
                      </Button>
                    )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
