"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { PackingSlip } from "@/components/admin/PackingSlip";
import { toast } from "@/components/ui/sonner";

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
  items: OrderItem[];
  user: {
    name: string | null;
    email: string;
  };
  shippingAddress?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string;
  };
}

/**
 * Packing Slip Page
 *
 * This page displays a print-optimized packing slip for an order.
 * It fetches order data by ID and renders the PackingSlip component.
 * Auto-prints on load via the autoPrint prop.
 */
export default function PackingSlipPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<{ businessName: string } | null>(null);

  const orderId = params.id as string;

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/auth/login");
    }
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!user?.id) return;

    const fetchOrderAndTenant = async () => {
      try {
        // Fetch order data
        const orderResponse = await fetch(
          `/api/tenant-admin/orders/${orderId}`,
        );
        if (!orderResponse.ok) {
          throw new Error("Failed to fetch order");
        }
        const orderData = await orderResponse.json();
        setOrder(orderData);

        // Fetch tenant data for business name
        const tenantResponse = await fetch("/api/tenant-admin/tenant");
        if (tenantResponse.ok) {
          const tenantData = await tenantResponse.json();
          setTenant(tenantData);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load packing slip");
      } finally {
        setLoading(false);
      }
    };

    fetchOrderAndTenant();
  }, [user, orderId]);

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-slate-700 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading packing slip...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-slate-600">Order not found</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <PackingSlip
      order={order}
      businessName={tenant?.businessName || "BudStack"}
      autoPrint={true}
    />
  );
}
