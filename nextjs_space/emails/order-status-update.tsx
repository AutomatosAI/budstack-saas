import {
    Body,
    Container,
    Head,
    Html,
    Img,
    Link,
    Preview,
    Section,
    Text,
    Tailwind,
} from '@react-email/components';
import React from 'react';

type OrderStatusType = 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'CONFIRMED' | 'PROCESSING';

interface OrderStatusUpdateEmailProps {
    userName: string;
    orderNumber: string;
    status: OrderStatusType;
    tenantName: string;
    trackingUrl?: string;
    logoUrl?: string;
    primaryColor?: string;
}

const STATUS_CONFIG: Record<OrderStatusType, { label: string; color: string; message: string }> = {
    SHIPPED: {
        label: '📦 Order Shipped',
        color: '#3b82f6',
        message: 'Your order has been shipped and is on its way to you.',
    },
    DELIVERED: {
        label: '✓ Order Delivered',
        color: '#10b981',
        message: 'Your order has been delivered. We hope you enjoy your products!',
    },
    CANCELLED: {
        label: '✗ Order Cancelled',
        color: '#ef4444',
        message: 'Your order has been cancelled. If you did not request this, please contact support.',
    },
    CONFIRMED: {
        label: '✓ Order Confirmed',
        color: '#10b981',
        message: 'Your order has been confirmed and is being prepared.',
    },
    PROCESSING: {
        label: '⏳ Order Processing',
        color: '#f59e0b',
        message: 'Your order is being processed.',
    },
};

export const OrderStatusUpdateEmail = ({
    userName = 'User',
    orderNumber = 'ORD-1234',
    status = 'SHIPPED',
    tenantName = 'BudStacks',
    trackingUrl,
    logoUrl,
    primaryColor = '#10b981',
}: OrderStatusUpdateEmailProps) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.PROCESSING;

    return (
        <Html>
            <Head />
            <Preview>Order #{orderNumber} — {config.label}</Preview>
            <Tailwind>
                <Body className="bg-white my-auto mx-auto font-sans">
                    <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
                        {logoUrl && (
                            <Section className="mt-[20px]">
                                <Img src={logoUrl} width="40" height="40" alt={tenantName} className="my-0 mx-auto" />
                            </Section>
                        )}
                        <Section
                            className="rounded p-2 text-center my-[20px]"
                            style={{ backgroundColor: config.color }}
                        >
                            <Text className="text-white text-[16px] font-bold m-0">
                                {config.label}
                            </Text>
                        </Section>
                        <Text className="text-black text-[14px] leading-[24px]">
                            Hi {userName},
                        </Text>
                        <Text className="text-black text-[14px] leading-[24px]">
                            {config.message}
                        </Text>
                        <Section className="bg-[#f9fafb] border border-solid border-[#eaeaea] rounded p-4 my-4">
                            <Text className="text-[13px] m-0">
                                <strong>Order Number:</strong> #{orderNumber}
                            </Text>
                            <Text className="text-[13px] m-0 mt-1">
                                <strong>Status:</strong> {status}
                            </Text>
                        </Section>
                        {trackingUrl && status === 'SHIPPED' && (
                            <Section className="text-center mt-[24px] mb-[24px]">
                                <Link
                                    className="p-3 px-6 rounded text-white text-[14px] font-semibold no-underline text-center"
                                    style={{ backgroundColor: primaryColor }}
                                    href={trackingUrl}
                                >
                                    Track Shipment
                                </Link>
                            </Section>
                        )}
                        <Text className="text-[#666666] text-[12px] leading-[24px]">
                            Best regards,<br />The {tenantName} Team
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default OrderStatusUpdateEmail;
