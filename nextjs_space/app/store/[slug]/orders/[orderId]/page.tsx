import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Clock, Package, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { orders } from '@prisma/client';

async function getOrder(orderId: string, slug: string) {
    // This would call the API in a real scenario
    // For now, get from database directly
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
            items: true,
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
            case 'PAID':
                return <CheckCircle className="h-16 w-16 text-green-500" />;
            case 'PENDING':
                return <Clock className="h-16 w-16 text-yellow-500" />;
            case 'FAILED':
            case 'EXPIRED':
            case 'CANCELLED':
                return <Package className="h-16 w-16 text-red-500" />;
            default:
                return <Clock className="h-16 w-16 text-gray-400" />;
        }
    };

    const getStatusMessage = (paymentStatus: string) => {
        switch (paymentStatus) {
            case 'PAID':
                return {
                    title: 'Payment Received!',
                    message: 'Your order is being prepared for shipment.',
                };
            case 'PENDING':
                return {
                    title: 'Order Submitted Successfully!',
                    message: 'Check your email for payment instructions.',
                };
            case 'FAILED':
                return {
                    title: 'Payment Failed',
                    message: 'Please contact support or try placing a new order.',
                };
            default:
                return {
                    title: 'Order Received',
                    message: 'We are processing your order.',
                };
        }
    };

    const status = getStatusMessage(order.paymentStatus);

    return (
        <div className="container mx-auto px-4 py-8 max-w-3xl">
            {/* Success Header */}
            <Card className="mb-6">
                <CardContent className="flex flex-col items-center text-center py-12">
                    {getStatusIcon(order.paymentStatus)}
                    <h1 className="text-3xl font-bold mt-6 mb-2">{status.title}</h1>
                    <p className="text-gray-600 mb-4">{status.message}</p>
                    <p className="text-sm text-gray-500">
                        Order Number: <span className="font-mono font-semibold">{order.orderNumber}</span>
                    </p>
                </CardContent>
            </Card>

            {/* Payment Instructions */}
            {order.paymentStatus === 'PENDING' && (
                <Card className="mb-6 border-blue-200 bg-blue-50">
                    <CardHeader>
                        <CardTitle className="text-blue-900">Next Steps</CardTitle>
                    </CardHeader>
                    <CardContent className="text-blue-800">
                        <ol className="list-decimal list-inside space-y-2">
                            <li>Check your email for payment instructions</li>
                            <li>Choose your preferred payment method (crypto or credit card)</li>
                            <li>Complete the payment using the provided link</li>
                            <li>Your order will be shipped once payment is confirmed</li>
                        </ol>
                    </CardContent>
                </Card>
            )}

            {/* Order Details */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Order Details</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {order.items.map((item: any) => (
                            <div key={item.id} className="flex justify-between border-b pb-3">
                                <div>
                                    <p className="font-semibold">{item.productName}</p>
                                    <p className="text-sm text-gray-600">Quantity: {item.quantity}g</p>
                                </div>
                                <p className="font-semibold">${(item.price * item.quantity).toFixed(2)}</p>
                            </div>
                        ))}

                            <div className="pt-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Subtotal</span>
                                    <span>${order.subtotal.toFixed(2)}</span>
                                </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Shipping</span>
                                <span>${order.shippingCost.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-lg font-bold border-t pt-2">
                                <span>Total</span>
                                <span>${order.total.toFixed(2)}</span>
                            </div>
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
                                {(order.shippingInfo as any).city}, {(order.shippingInfo as any).state}{' '}
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
                    <Button className="w-full">
                        Return to Store
                    </Button>
                </Link>
            </div>
        </div>
    );
}
