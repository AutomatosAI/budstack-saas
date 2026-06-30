"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Package, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getStorefrontDashboard } from "@/app/actions/dashboard";
import { OrderListItem } from "@/components/storefront/order-list-item";
import { StorefrontOrder } from "@/lib/orders/storefront-orders";
import { getTenantBasePath } from "@/lib/tenant/tenant-utils";

export default function OrdersPage() {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;
  const basePath = getTenantBasePath(slug);

  const [orders, setOrders] = useState<StorefrontOrder[] | null>(null);

  useEffect(() => {
    getStorefrontDashboard().then((d) => setOrders(d.orders));
  }, []);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.push(`${basePath}/login`);
  }, [isLoaded, isSignedIn, router, slug]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!isSignedIn) return null;

  return (
    <div
      className="min-h-screen pb-20 pt-24"
      style={{ backgroundColor: "hsl(var(--tenant-color-background, 210 40% 98%))" }}
    >
      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <Link
          href={`${basePath}/dashboard`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
        <h1
          className="mb-1 text-2xl font-bold tracking-tight text-foreground"
          style={{ fontFamily: "var(--tenant-font-heading, inherit)" }}
        >
          Your orders
        </h1>
        <p className="mb-6 text-muted-foreground">
          Track status and view details — updates refresh from Dr Green automatically.
        </p>

        {orders === null ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[68px] animate-pulse rounded-xl bg-muted/60" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <Card className="border-border/60 shadow-sm">
            <CardContent className="py-16 text-center">
              <Package className="mx-auto mb-4 h-14 w-14 text-muted-foreground/30" />
              <p className="mb-1 font-medium text-foreground">No orders yet</p>
              <p className="mb-5 text-sm text-muted-foreground">
                When you place an order it&apos;ll show up here.
              </p>
              <Link href={`${basePath}/products`}>
                <Button>
                  <ShoppingBag className="mr-2 h-4 w-4" /> Browse products
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <OrderListItem key={o.id} order={o} basePath={basePath} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
