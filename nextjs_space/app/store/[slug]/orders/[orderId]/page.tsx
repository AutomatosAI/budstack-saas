import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { order_items } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, Package, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

async function getOrder(orderId: string, slug: string) {
  const tenant = await prisma.tenants.findUnique({
    where: { subdomain: slug },
    select: { id: true },
  });

  if (!tenant) return null;

  const order = await prisma.orders.findFirst({
    where: {
      id: orderId,
      tenantId: tenant.id,
    },
    include: {
      order_items: true,
    },
  });

  return order;
}

export default async function OrderConfirmationPage({
  params,
}: {
  params: { slug: string; orderId: string };
}) {
  const order = await getOrder(params.orderId, params.slug);

  if (!order) {
    notFound();
  }

  const getStatusIcon = (paymentStatus: string) => {
    switch (paymentStatus) {
      case "PAID":
        return <CheckCircle className="h-16 w-16 text-green-500" />;
      case "PENDING":
        return <Clock className="h-16 w-16 text-yellow-500" />;
      case "FAILED":
      case "EXPIRED":
      case "CANCELLED":
        return <Package className="h-16 w-16 text-red-500" />;
      default:
        return <Clock className="h-16 w-16 text-gray-400" />;
    }
  };

  const getStatusMessage = (paymentStatus: string) => {
    switch (paymentStatus) {
      case "PAID":
        return {
          title: "Payment Received!",
          message: "Your order is being prepared for shipment.",
        };
      case "PENDING":
        return {
          title: "Order Submitted Successfully!",
          message: "Check your email for payment instructions.",
        };
      case "FAILED":
        return {
          title: "Payment Failed",
          message: "Please contact support or try placing a new order.",
        };
      default:
        return {
          title: "Order Received",
          message: "We are processing your order.",
        };
    }
  };

  const status = getStatusMessage(order.paymentStatus);

  return (
    <div className="container mx-auto px-4 pt-36 pb-8 max-w-3xl">
      {/* Success Header */}
      <Card className="mb-6">
        <CardContent className="flex flex-col items-center text-center py-12">
          {getStatusIcon(order.paymentStatus)}
          <h1 className="text-3xl font-bold mt-6 mb-2">{status.title}</h1>
          <p className="text-gray-600 mb-4">{status.message}</p>
          <p className="text-sm text-gray-500">
            Order Number:{" "}
            <span className="font-mono font-semibold">{order.orderNumber}</span>
          </p>
        </CardContent>
      </Card>

      {/* Payment Instructions */}
      {order.paymentStatus === "PENDING" && (
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-900">Next Steps</CardTitle>
          </CardHeader>
          <CardContent className="text-blue-800">
            <ol className="list-decimal list-inside space-y-2">
              <li>Check your email for payment instructions</li>
              <li>
                Choose your preferred payment method (crypto or credit card)
              </li>
              <li>Complete the payment using the provided link</li>
              <li>Your order will be shipped once payment is confirmed</li>
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Order Summary */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Order Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {order.order_items?.map((item: order_items) => {
              // Derive currency from order or item (cast to any since currency may not be in type)
              const currency = (order as any).currency || (item as any).currency || (order.order_items?.[0] as any)?.currency || 'ZAR';
              return (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>{item.productName} × {item.quantity}</span>
                  <span>{currency} {(item.price * item.quantity).toFixed(2)}</span>
                </div>
              );
            })}

            <div className="pt-4 space-y-2">
              {(() => {
                const currency = (order as any).currency || (order.order_items?.[0] as any)?.currency || 'ZAR';
                return (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal</span>
                      <span>{currency} {order.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Shipping</span>
                      <span>{currency} {order.shippingCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <span>Total</span>
                      <span>{currency} {order.total.toFixed(2)}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shipping Info */}
      {order.shippingInfo && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Shipping Address
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-1">
              <p>{(order.shippingInfo as any).address1}</p>
              {(order.shippingInfo as any).address2 && (
                <p>{(order.shippingInfo as any).address2}</p>
              )}
              <p>
                {(order.shippingInfo as any).city},{" "}
                {(order.shippingInfo as any).state}{" "}
                {(order.shippingInfo as any).postalCode}
              </p>
              <p>{(order.shippingInfo as any).country}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Link href={`/store/${params.slug}/products`} className="flex-1">
          <Button variant="outline" className="w-full">
            Continue Shopping
          </Button>
        </Link>
        <Link href={`/store/${params.slug}`} className="flex-1">
          <Button className="w-full">Return to Store</Button>
        </Link>
      </div>
    </div>
  );
}
